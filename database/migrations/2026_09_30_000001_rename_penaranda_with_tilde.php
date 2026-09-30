<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Spell the home town the way it is spelled: Peñaranda.
 *
 * The name is stored on every saved address and on every delivery order, and
 * it is what decides the in-town delivery fee. Leaving the old rows as
 * "Penaranda" while the constant gained a tilde would have quietly charged
 * the shop's own town the farther fee.
 *
 * DeliveryFeeSetting::isInTown() folds the tilde away before comparing, so a
 * row this pass somehow misses is still charged correctly. This is about the
 * data reading true, not about keeping the fee working.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->rename('Penaranda', 'Peñaranda');
    }

    public function down(): void
    {
        $this->rename('Peñaranda', 'Penaranda');
    }

    private function rename(string $from, string $to): void
    {
        DB::table('user_addresses')
            ->where('municipality', $from)
            ->update(['municipality' => $to]);

        DB::table('orders')
            ->where('delivery_municipality', $from)
            ->update(['delivery_municipality' => $to]);
    }
};
