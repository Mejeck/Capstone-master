<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Update the user's profile settings.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        // 'name' is the form field (and the User model's computed display accessor),
        // but the real, fillable column backing it is 'full_name'.
        $request->user()->fill([
            'full_name' => $validated['name'],
            'email' => $validated['email'],
        ]);

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return to_route('profile.edit');
    }

    /**
     * Backup the database and download it.
     */
    public function backup(Request $request)
    {
        try {
            $connection = DB::connection();

            // Create backup filename with timestamp
            $filename = 'backup_' . $connection->getDatabaseName() . '_' . date('Y-m-d_H-i-s') . '.sql';

            $sql = $connection->getDriverName() === 'pgsql'
                ? $this->dumpPostgres()
                : $this->dumpMysql();

            // Keep a copy in the Capstone/backup folder where the host lets us
            // write to it (serverless hosts such as Vercel don't).
            $backupPath = base_path('backup');
            if ((is_dir($backupPath) || @mkdir($backupPath, 0755, true)) && is_writable($backupPath)) {
                file_put_contents($backupPath . '/' . $filename, $sql);
            }

            return response()->streamDownload(function () use ($sql) {
                echo $sql;
            }, $filename, ['Content-Type' => 'application/sql']);

        } catch (\Exception $e) {
            return back()->with('error', 'An error occurred while creating the backup: ' . $e->getMessage());
        }
    }

    /**
     * Structure + data dump for MySQL.
     */
    private function dumpMysql(): string
    {
        $database = DB::connection()->getDatabaseName();

        // Create SQL backup using PHP
        $sql = '';

        // Get all tables
        $tables = DB::select('SHOW TABLES');
        $tableField = 'Tables_in_' . $database;

        foreach ($tables as $table) {
            $tableName = $table->$tableField;

            // Get table structure
            $createTableQuery = DB::selectOne("SHOW CREATE TABLE `$tableName`");
            $sql .= $createTableQuery->{'Create Table'} . ";\n\n";

            // Get table data
            $rows = DB::select("SELECT * FROM `$tableName`");

            if (!empty($rows)) {
                $columns = array_keys((array)$rows[0]);
                $columnsStr = '`' . implode('`, `', $columns) . '`';
                $pdo = DB::connection()->getPdo();

                foreach ($rows as $row) {
                    $values = array_map(function($value) use ($pdo) {
                        if ($value === null) {
                            return 'NULL';
                        } else {
                            return $pdo->quote($value);
                        }
                    }, (array)$row);

                    $sql .= "INSERT INTO `$tableName` ($columnsStr) VALUES (" . implode(', ', $values) . ");\n";
                }
                $sql .= "\n";
            }
        }

        return $sql;
    }

    /**
     * Data-only dump for PostgreSQL (there is no SHOW CREATE TABLE, and the
     * schema is already defined by the migrations). It is a single transaction
     * that empties the backed-up tables and reloads them, so restoring
     * replaces the data (a freshly migrated database already holds a few
     * default rows). Tables come parents-first so foreign keys are satisfied,
     * and each id sequence is moved past the restored rows.
     */
    private function dumpPostgres(): string
    {
        $connection = DB::connection();
        $pdo = $connection->getPdo();
        $grammar = $connection->getQueryGrammar();

        $sql = "-- PostgreSQL data backup of \"{$connection->getDatabaseName()}\" created " . now()->toDateTimeString() . "\n"
            . "-- Data only. To restore: run \"php artisan migrate\" on the target database, then load this file.\n"
            . "-- WARNING: it REPLACES all rows in the tables below (it starts with TRUNCATE) and runs as one transaction.\n"
            . "-- Tables are ordered parents-first so foreign keys are satisfied; sessions, cache and migrations are left out.\n\n";

        $tables = $this->postgresTablesParentsFirst();

        $sql .= "begin;\n\n";
        $sql .= 'truncate table ' . implode(', ', array_map([$grammar, 'wrap'], $tables)) . " restart identity cascade;\n\n";

        foreach ($tables as $table) {
            $wrapped = $grammar->wrap($table);
            $rows = $connection->select("select * from {$wrapped} order by 1");

            if (empty($rows)) {
                continue;
            }

            $columns = implode(', ', array_map([$grammar, 'wrap'], array_keys((array) $rows[0])));

            foreach ($rows as $row) {
                $values = array_map(fn ($value) => match (true) {
                    $value === null => 'NULL',
                    is_bool($value) => $value ? 'true' : 'false',
                    is_int($value), is_float($value) => (string) $value,
                    default => $pdo->quote($value),
                }, (array) $row);

                $sql .= "insert into {$wrapped} ({$columns}) values (" . implode(', ', $values) . ");\n";
            }

            $sql .= "\n";
        }

        $sequences = $connection->select(
            "select table_name, column_name from information_schema.columns
             where table_schema = 'public' and (column_default like 'nextval(%' or is_identity = 'YES')
             order by table_name"
        );

        foreach ($sequences as $sequence) {
            if (! in_array($sequence->table_name, $tables, true)) {
                continue;
            }

            $table = $grammar->wrap($sequence->table_name);
            $column = $grammar->wrap($sequence->column_name);
            $sql .= "select setval(pg_get_serial_sequence('{$table}', '{$sequence->column_name}'), coalesce(max({$column}), 1), max({$column}) is not null) from {$table};\n";
        }

        return $sql . "\ncommit;\n";
    }

    /**
     * Backed-up public tables, each listed after the tables its foreign keys
     * point to (a self-reference doesn't count; a true cycle is broken
     * arbitrarily).
     *
     * @return list<string>
     */
    private function postgresTablesParentsFirst(): array
    {
        $skip = ['sessions', 'cache', 'cache_locks', 'migrations'];

        $remaining = [];
        foreach (DB::select("select tablename from pg_tables where schemaname = 'public' order by tablename") as $row) {
            if (! in_array($row->tablename, $skip, true)) {
                $remaining[$row->tablename] = [];
            }
        }

        $foreignKeys = DB::select(
            "select conrelid::regclass::text as child, confrelid::regclass::text as parent
             from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace"
        );

        foreach ($foreignKeys as $fk) {
            if ($fk->child !== $fk->parent && isset($remaining[$fk->child], $remaining[$fk->parent])) {
                $remaining[$fk->child][] = $fk->parent;
            }
        }

        $ordered = [];

        while ($remaining) {
            $ready = array_keys(array_filter(
                $remaining,
                fn (array $parents) => ! array_intersect($parents, array_keys($remaining)),
            ));

            if (! $ready) {
                $ready = [array_key_first($remaining)];
            }

            foreach ($ready as $table) {
                $ordered[] = $table;
                unset($remaining[$table]);
            }
        }

        return $ordered;
    }
}
