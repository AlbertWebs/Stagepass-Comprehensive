<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            'permanent_employee',
            'temporary_employee',
            'team_leader',
            'hr',
            'accounts',
            'accountant',
            'logistics',
            'project_manager',
            'operations',
            'director',
            'super_admin',
        ];

        foreach ($roles as $name) {
            Role::firstOrCreate(
                ['name' => $name],
                ['label' => ucfirst(str_replace('_', ' ', $name))]
            );
        }
    }
}
