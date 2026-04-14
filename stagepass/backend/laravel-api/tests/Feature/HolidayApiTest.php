<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HolidayApiTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        $token = $user->createToken('test')->plainTextToken;
        return ['Authorization' => 'Bearer ' . $token];
    }

    public function test_admin_can_crud_holidays(): void
    {
        $admin = User::factory()->create();
        $role = Role::firstOrCreate(['name' => 'super_admin'], ['label' => 'Super Admin']);
        $admin->roles()->syncWithoutDetaching([$role->id]);

        $created = $this->withHeaders($this->auth($admin))->postJson('/api/holidays', [
            'name' => 'Madaraka Day',
            'date' => '2026-06-01',
            'description' => 'National holiday',
            'is_active' => true,
        ])->assertStatus(201);

        $id = $created->json('id');
        $this->withHeaders($this->auth($admin))
            ->getJson('/api/holidays')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Madaraka Day');

        $this->withHeaders($this->auth($admin))
            ->putJson('/api/holidays/' . $id, ['name' => 'Madaraka Day Updated'])
            ->assertOk()
            ->assertJsonPath('name', 'Madaraka Day Updated');

        $this->withHeaders($this->auth($admin))
            ->deleteJson('/api/holidays/' . $id)
            ->assertStatus(204);
    }
}
