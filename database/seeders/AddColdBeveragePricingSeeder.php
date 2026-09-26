<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * Splits the existing beer case price into a "regular" (price_per_case,
 * the default/no-toggle price) and a "cold" (price_per_case_cold, only
 * offered when buying by the case) price. Run once via:
 *   php artisan db:seed --class=Database\\Seeders\\AddColdBeveragePricingSeeder
 *
 * The current price_per_case values in the database were, in practice,
 * always the "cold" price the store actually charges, so they move to
 * price_per_case_cold and price_per_case drops to the lower regular price.
 * price_per_bottle is untouched: no cold option is offered by the bottle.
 */
class AddColdBeveragePricingSeeder extends Seeder
{
    public function run(): void
    {
        // Red Horse exists under two names: IcePlantSeeder creates it as
        // 'Redhorse Beer' and AddBeerProductsSeeder as 'Red Horse', and
        // both run from DatabaseSeeder — so both rows can be in the
        // database. Price every name a product is known by, or the row
        // this seeder misses keeps a null cold price and never offers
        // the option to the customer.
        // [[names...], regular case price, cold case price]
        $pricing = [
            [['Redhorse Beer', 'Red Horse'], 750.00, 770.00],
            [['San Mig Light'], 1250.00, 1300.00],
            [['San Mig Pilsen'], 1100.00, 1150.00],
            [['San Mig Apple'], 1050.00, 1100.00],
        ];

        foreach ($pricing as [$names, $regular, $cold]) {
            $products = Product::whereIn('product_name', $names)->get();

            if ($products->isEmpty()) {
                echo "! No product found named '" . implode("' or '", $names) . "', skipped.\n";
                continue;
            }

            foreach ($products as $product) {
                $product->price = $regular;
                $product->price_per_case = $regular;
                $product->price_per_case_cold = $cold;
                $product->save();

                echo "✓ {$product->product_name} (ID {$product->product_id}): regular case ₱{$regular}, cold case ₱{$cold}\n";
            }
        }
    }
}
