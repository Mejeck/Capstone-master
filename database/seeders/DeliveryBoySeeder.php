<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DeliveryBoySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $deliveryBoys = [
            [
                'username' => 'deliveryboy1',
                'full_name' => 'Juan Dela Cruz',
                'email' => 'deliveryboy1@example.com',
                'password' => Hash::make('password123'),
                'contact_number' => '+639123456789',
                'role' => 'delivery_boy',
                'is_active' => true,
                'email_verified_at' => now(),
            ],
            [
                'username' => 'deliveryboy2',
                'full_name' => 'Maria Santos',
                'email' => 'deliveryboy2@example.com',
                'password' => Hash::make('password123'),
                'contact_number' => '+639987654321',
                'role' => 'delivery_boy',
                'is_active' => true,
                'email_verified_at' => now(),
            ],
        ];

        foreach ($deliveryBoys as $data) {
            // Keyed on username so a second run updates rather than
            // failing on the unique constraint, and the password is set
            // only on creation: re-seeding must never hand back this
            // file's published default to an account whose password has
            // since been changed.
            $rider = User::firstOrNew(['username' => $data['username']]);
            $existing = $rider->exists;

            $rider->fill(collect($data)->except($existing ? ['password'] : [])->all());
            $rider->save();

            $this->command->info($existing
                ? "Delivery boy {$rider->username} updated (password left alone)."
                : "Delivery boy {$rider->username} created.");
        }
    }
}
