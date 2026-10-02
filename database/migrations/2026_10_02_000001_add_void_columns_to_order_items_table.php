<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets a single line of a sale be voided on its own, instead of the whole
 * sale being the only unit a cashier or admin can undo.
 *
 * Mirrors sales.voided_at/voided_by/void_reason, which already exist for a
 * whole-sale void — same three columns, same meaning, now at the line level.
 * A line with a non-null voided_at is excluded from the sale's current
 * total; see CashierController::voidSaleItem().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->timestamp('voided_at')->nullable()->after('subtotal');
            $table->unsignedBigInteger('voided_by')->nullable()->after('voided_at');
            $table->string('void_reason')->nullable()->after('voided_by');

            $table->foreign('voided_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['voided_by']);
            $table->dropColumn(['voided_at', 'voided_by', 'void_reason']);
        });
    }
};
