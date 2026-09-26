<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;

class CashierSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        echo "Creating cashier accounts...\n\n";

        $cashiers = [
            [
                'username' => 'cashier1',
                'full_name' => 'Ana Santos',
                'email' => 'ana.santos@iceplant.com',
                'password' => bcrypt('cashier123'),
                'contact_number' => '0912-345-6789',
                'role' => 'cashier',
                'is_active' => 1,
                'is_approved' => 1,
                'approved_at' => now(),
                'approved_by' => 1, // SuperAdmin ID
                'email_verified_at' => now(),
            ],
            [
                'username' => 'cashier2',
                'full_name' => 'Carlos Reyes',
                'email' => 'carlos.reyes@iceplant.com',
                'password' => bcrypt('cashier123'),
                'contact_number' => '0913-456-7890',
                'role' => 'cashier',
                'is_active' => 1,
                'is_approved' => 1,
                'approved_at' => now(),
                'approved_by' => 1, // SuperAdmin ID
                'email_verified_at' => now(),
            ],
            [
                'username' => 'cashier3',
                'full_name' => 'Diana Martinez',
                'email' => 'diana.martinez@iceplant.com',
                'password' => bcrypt('cashier123'),
                'contact_number' => '0914-567-8901',
                'role' => 'cashier',
                'is_active' => 1,
                'is_approved' => 1,
                'approved_at' => now(),
                'approved_by' => 1, // SuperAdmin ID
                'email_verified_at' => now(),
            ],
        ];

        foreach ($cashiers as $cashierData) {
            // The password is applied only when the account is first
            // created. updateOrCreate() used to write the whole row every
            // run, so re-seeding silently put this file's default back on
            // an account whose password an admin had since changed —
            // handing the old, published one back to anyone who knew it.
            $cashier = User::firstOrNew(['username' => $cashierData['username']]);
            $existing = $cashier->exists;

            $cashier->fill(collect($cashierData)
                ->except($existing ? ['password'] : [])
                ->all());

            $cashier->save();

            echo ($existing ? "✓ Cashier updated (password left alone): " : "✓ Cashier created: ")
                . "{$cashier->full_name}\n";
            echo "  - Username: {$cashier->username}\n";
            echo "  - Email: {$cashier->email}\n";
            echo "  - Role: {$cashier->role}\n";
            echo "  - Status: " . ($cashier->is_active ? 'Active' : 'Inactive') . "\n\n";
        }

        echo "🎉 CASHIER ACCOUNTS SUCCESSFULLY CREATED!\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "Cashier accounts added:\n";
        echo "1. Ana Santos (cashier1)\n";
        echo "2. Carlos Reyes (cashier2)\n";
        echo "3. Diana Martinez (cashier3)\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "Default password for cashiers created just now: cashier123\n";
        echo "Accounts that already existed kept the password they had.\n\n";
    }
}
