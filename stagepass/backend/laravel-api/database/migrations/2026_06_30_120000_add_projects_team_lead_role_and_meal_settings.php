<?php

use App\Models\Role;
use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Role::query()->firstOrCreate(
            ['name' => 'projects_team_lead'],
            ['label' => 'Projects Team Lead']
        );

        $defaults = [
            'meal_allowance_breakfast_time' => '07:00',
            'meal_allowance_lunch_time' => '13:00',
            'meal_allowance_dinner_time' => '20:00',
            'meal_allowance_leader_amount' => '500',
            'meal_allowance_crew_amount' => '200',
        ];

        foreach ($defaults as $key => $value) {
            if (Setting::query()->where('key', $key)->doesntExist()) {
                Setting::set($key, $value);
            }
        }
    }

    public function down(): void
    {
        Role::query()->where('name', 'projects_team_lead')->delete();
    }
};
