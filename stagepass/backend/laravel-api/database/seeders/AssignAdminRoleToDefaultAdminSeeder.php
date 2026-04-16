<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class AssignAdminRoleToDefaultAdminSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->where('email', 'admin@stagepass.com')->first();
        if (!$user) {
            return;
        }

        $role = Role::query()->firstOrCreate(
            ['name' => 'admin'],
            ['label' => 'Admin']
        );

        $user->roles()->syncWithoutDetaching([$role->id]);
    }
}

