<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Category;
use App\Models\Product;
use App\Models\Inventory;
use App\Models\StockLog;
use App\Models\User;

class IcePlantSeeder extends Seeder
{
    public function run(): void
    {
        // Stock logs below need a user to be attributed to. Prefer the existing
        // 'admin' account, then whoever already administers this install.
        $admin = User::where('username', 'admin')->first()
            ?? User::whereIn('role', ['SuperAdmin', 'Admin'])->orderBy('id')->first();

        if (! $admin) {
            // Only reached on a local install with no admin at all: this
            // placeholder has a well-known password, so never create it live.
            if (app()->isProduction()) {
                throw new \RuntimeException(
                    'No SuperAdmin/Admin account exists to attribute stock to. Run CreateLoggedInUserSeeder first.'
                );
            }

            $admin = User::create([
                'username' => 'admin',
                'full_name' => 'System Administrator',
                'email' => 'admin@mejeckiceplant.com',
                'password' => bcrypt('password'),
                'role' => 'Admin',
                'is_active' => 1,
                'email_verified_at' => now(),
            ]);
        }
        
        $adminUserId = $admin->id; // Use id instead of user_id

        // Create ice product categories
        $categories = [
            ['category_name' => 'Ice Tubes', 'description' => 'Clear cylindrical ice tubes for beverages'],
            ['category_name' => 'Ice Cubes', 'description' => 'Standard square ice cubes'],
            ['category_name' => 'Block Ice', 'description' => 'Large blocks for industrial use'],
            ['category_name' => 'Dry Ice', 'description' => 'Solid carbon dioxide for special applications'],
            ['category_name' => 'Beverages', 'description' => 'Alcoholic beverages'],
            ['category_name' => 'Bottles', 'description' => 'Empty and returnable bottles (stock only, not sold)'],
        ];

        foreach ($categories as $category) {
            Category::firstOrCreate(['category_name' => $category['category_name']], $category);
        }

        // Create sample products
        $products = [
            ['category_id' => 1, 'product_name' => 'Purified Ice Tube', 'description' => 'Crystal-clear ice tubes designed to keep your beverages perfectly chilled without diluting taste.', 'unit' => '1kg', 'price' => 10.00, 'image' => 'images/icetube.jpg'],
            ['category_id' => 1, 'product_name' => 'Purified Ice Tube', 'description' => 'Crystal-clear ice tubes designed to keep your beverages perfectly chilled without diluting taste.', 'unit' => '3kg', 'price' => 28.00, 'image' => 'images/icetube.jpg'],
            ['category_id' => 1, 'product_name' => 'Purified Ice Tube', 'description' => 'Crystal-clear ice tubes designed to keep your beverages perfectly chilled without diluting taste.', 'unit' => '5kg', 'price' => 40.00, 'image' => 'images/icetube.jpg'],
            ['category_id' => 1, 'product_name' => 'Purified Ice Tube', 'description' => 'Crystal-clear ice tubes designed to keep your beverages perfectly chilled without diluting taste.', 'unit' => '10kg', 'price' => 90.00, 'image' => 'images/icetube.jpg'],
            ['category_id' => 1, 'product_name' => 'Purified Ice Tube', 'description' => 'Crystal-clear ice tubes designed to keep your beverages perfectly chilled without diluting taste.', 'unit' => '20kg', 'price' => 160.00, 'image' => 'images/icetube.jpg'],
            ['category_id' => 1, 'product_name' => 'Purified Ice Tube', 'description' => 'Crystal-clear ice tubes designed to keep your beverages perfectly chilled without diluting taste.', 'unit' => '30kg', 'price' => 210.00, 'image' => 'images/icetube.jpg'],
            ['category_id' => 1, 'product_name' => 'Purified Ice Tube', 'description' => 'Crystal-clear ice tubes designed to keep your beverages perfectly chilled without diluting taste.', 'unit' => '40kg', 'price' => 230.00, 'image' => 'images/icetube.jpg'],
            ['category_id' => 1, 'product_name' => 'Purified Ice Tube', 'description' => 'Crystal-clear ice tubes designed to keep your beverages perfectly chilled without diluting taste.', 'unit' => '50kg', 'price' => 250.00, 'image' => 'images/icetube.jpg'],
            ['category_id' => 5, 'product_name' => 'Redhorse Beer', 'description' => 'The extra-strong beer for bold moments and great times with friends. Case: 12 bottles (₱770), Bottle: ₱65 each.', 'unit' => 'case', 'price' => 770.00, 'price_per_case' => 770.00, 'price_per_bottle' => 65, 'image' => 'images/redhorse.jpg'],
            ['category_id' => 5, 'product_name' => 'San Mig Light', 'description' => 'Light and refreshing beer perfect for easy drinking and social gatherings. Case: 24 bottles (₱1,300), Bottle: ₱55 each.', 'unit' => 'case', 'price' => 1300.00, 'price_per_case' => 1300.00, 'price_per_bottle' => 55, 'image' => 'images/sanmiglight.jpg'],
            ['category_id' => 5, 'product_name' => 'San Mig Apple', 'description' => 'Sweet apple-flavored beer with a crisp and refreshing taste. Case: 24 bottles (₱1,100), Bottle: ₱45 each.', 'unit' => 'case', 'price' => 1100.00, 'price_per_case' => 1100.00, 'price_per_bottle' => 45, 'image' => 'images/sanmigapple.jpg'],
            ['category_id' => 5, 'product_name' => 'San Mig Pilsen', 'description' => 'Classic Filipino beer with traditional taste and quality. Case: 24 bottles (₱1,150), Bottle: 50 each.', 'unit' => 'case', 'price' => 1150.00, 'price_per_case' => 1150.00, 'price_per_bottle' => 50, 'image' => 'images/pilsen.jpg'],
        ];

        foreach ($products as $product) {
            Product::updateOrCreate(
                ['product_name' => $product['product_name'], 'unit' => $product['unit']],
                $product
            );
        }

        // Delete products that are no longer in the list
        $validProductNames = array_column($products, 'product_name');
        Product::whereNotIn('product_name', $validProductNames)->delete();

        // Create inventory records with 0 initial stock for manual admin input
        $allProducts = Product::all();
        foreach ($allProducts as $product) {
            // Set min_stock_level to 5 for beverages, 10 for other products
            $minStockLevel = $product->category_id == 5 ? 5 : 10;

            $inventory = Inventory::firstOrCreate(['product_id' => $product->product_id], [
                'current_quantity' => 0,
                'min_stock_level' => $minStockLevel,
            ]);

            // No stock logs created - admin will manually add stock
        }
    }
}
