<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Call the CreateLoggedInUserSeeder to create the initial SuperAdmin account
        $this->call(CreateLoggedInUserSeeder::class);

        // Sample delivery boys/cashiers (known default passwords) and fake
        // suppliers are for local testing only. On a live system create the
        // real ones through the admin Staff Accounts / Suppliers screens.
        if (app()->isProduction()) {
            $this->command?->warn('Production: skipping sample delivery boys, cashiers and suppliers.');
        } else {
            // Call the DeliveryBoySeeder to create test delivery boys
            $this->call(DeliveryBoySeeder::class);

            // Call the CashierSeeder to create cashier accounts
            $this->call(CashierSeeder::class);

            // Call the SupplierSeeder to create supplier accounts
            $this->call(SupplierSeeder::class);
        }

        // Call the IcePlantSeeder to create products and inventory
        $this->call(IcePlantSeeder::class);

        // Call the AddBeerProductsSeeder to add beer products
        $this->call(AddBeerProductsSeeder::class);

        // Must run after the two seeders above: both write price_per_case as
        // the *cold* price and neither sets price_per_case_cold, so without
        // this last pass a re-seed leaves the regular and cold case prices
        // identical — the cold option then costs the customer nothing extra.
        $this->call(AddColdBeveragePricingSeeder::class);

        // Call the AddInitialStocksSeeder to add initial stock quantities
        $this->call(AddInitialStocksSeeder::class);

        // Call the FixOrderItemsSeeder to fix order items
        $this->call(FixOrderItemsSeeder::class);

        // Call the ActivateCustomerAccount to activate customer accounts
        $this->call(ActivateCustomerAccount::class);

        // User::factory(10)->create();
    }
}
