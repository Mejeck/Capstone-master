<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One free-text "Remarks" box replaces the separate optional address fields
 * (house no., street) on the delivery form: anything extra the rider should
 * know goes here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->text('delivery_remarks')->nullable()->after('delivery_landmark');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('delivery_remarks');
        });
    }
};
