<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A separate inventory category for bottles (empties and returnables), so
 * they are counted apart from the beverages they come with.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('categories')->where('category_name', 'Bottles')->exists()) {
            return;
        }

        DB::table('categories')->insert([
            'category_name' => 'Bottles',
            'description' => 'Empty and returnable bottles (stock only, not sold)',
        ]);
    }

    public function down(): void
    {
        DB::table('categories')
            ->where('category_name', 'Bottles')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('products')
                    ->whereColumn('products.category_id', 'categories.category_id');
            })
            ->delete();
    }
};
