<?php

namespace Database\Seeders;

use App\Models\AllowanceType;
use Illuminate\Database\Seeder;

class AllowanceTypesTableSeeder extends Seeder
{
    public function run(): void
    {
        $names = ['Taxi', 'Transport', 'Emergency', 'Other', 'Breakfast', 'Lunch', 'Dinner'];
        foreach ($names as $name) {
            AllowanceType::query()->firstOrCreate(
                ['name' => $name],
                ['is_active' => true]
            );
        }
    }
}
