<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One contact number, one account — enforced by the database, not only by
 * the request rules.
 *
 * The unique rule in the controllers reads and then writes, so two
 * registrations arriving together can both pass it and both insert. Only an
 * index makes that impossible.
 *
 * A unique index compares strings, though, and the column holds several
 * spellings of the same number: "09123456789", "0912-345-6789" and
 * "+639123456789" are one phone but three values, and an index would happily
 * keep all three. So the rows are brought to the single +639XXXXXXXXX form
 * the app has used since PhoneInput was introduced before the index goes on.
 *
 * That pass also repairs those rows: the regex rule on every profile form
 * already demands +639XXXXXXXXX, so a legacy value fails validation the
 * moment its owner saves their profile, even untouched.
 *
 * The column stays nullable. SQL treats each NULL as distinct, so any number
 * of accounts may still have no number at all; what it cannot hold is the
 * same number twice.
 */
return new class extends Migration
{
    public function up(): void
    {
        // An empty string is not a number, but unlike NULL it collides with
        // itself, so two blank rows would fail the index. Nothing writes ''
        // today — ConvertEmptyStringsToNull turns a blank field into null
        // before a controller sees it — but older rows predate that path.
        DB::table('users')->where('contact_number', '')->update(['contact_number' => null]);

        $this->normaliseExistingNumbers();
        $this->guardAgainstDuplicates();

        Schema::table('users', function (Blueprint $table) {
            $table->unique('contact_number');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['contact_number']);
        });

        // The normalised values are left as they are: +639XXXXXXXXX is what
        // the app's own rules ask for, so putting the old spellings back
        // would only reintroduce rows that fail validation.
    }

    /**
     * Rewrite every stored number to +639XXXXXXXXX where it can be read as a
     * Philippine mobile number. This mirrors deriveLocalDigits() in
     * resources/js/components/phone-input.tsx, which is what already decides
     * how a legacy value is shown to its owner.
     *
     * A value that cannot be read that way is left untouched rather than
     * discarded — it is somebody's contact detail, and guessing at it would
     * be worse than leaving it visibly odd.
     */
    private function normaliseExistingNumbers(): void
    {
        DB::table('users')
            ->whereNotNull('contact_number')
            ->orderBy('id')
            ->each(function ($user) {
                $normalised = $this->toCanonicalForm($user->contact_number);

                if ($normalised !== null && $normalised !== $user->contact_number) {
                    DB::table('users')
                        ->where('id', $user->id)
                        ->update(['contact_number' => $normalised]);
                }
            });
    }

    private function toCanonicalForm(string $value): ?string
    {
        $digits = preg_replace('/\D/', '', $value);

        // "+639171234567" and "639171234567" both arrive here as 639171234567.
        if (str_starts_with($digits, '63')) {
            $digits = substr($digits, 2);
        } elseif (str_starts_with($digits, '0')) {
            // The old local trunk prefix: "09171234567".
            $digits = substr($digits, 1);
        }

        // What is left must be exactly a 10-digit mobile number starting at 9.
        return preg_match('/^9\d{9}$/', $digits) ? '+63' . $digits : null;
    }

    /**
     * Two rows that were different strings can be the same number once
     * normalised. Report that plainly instead of letting the index fail with
     * a constraint error that names neither account.
     */
    private function guardAgainstDuplicates(): void
    {
        $duplicates = DB::table('users')
            ->select('contact_number', DB::raw('COUNT(*) as total'))
            ->whereNotNull('contact_number')
            ->groupBy('contact_number')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('total', 'contact_number');

        if ($duplicates->isEmpty()) {
            return;
        }

        $detail = $duplicates
            ->map(fn ($total, $number) => "{$number} ({$total} accounts)")
            ->implode(', ');

        throw new RuntimeException(
            'Cannot make users.contact_number unique: the same number is on more than one account — '
            . $detail
            . '. Clear or change the duplicates, then run this migration again.'
        );
    }
};
