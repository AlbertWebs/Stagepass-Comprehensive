<?php

namespace Tests\Feature;

use App\Mail\UserCreatedMail;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class UsersApiTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        $token = $user->createToken('test')->plainTextToken;
        return ['Authorization' => 'Bearer ' . $token];
    }

    public function test_users_index_returns_paginated_list(): void
    {
        $admin = User::factory()->create();
        User::factory()->count(2)->create();
        $response = $this->withHeaders($this->auth($admin))->getJson('/api/users');
        $response->assertStatus(200);
        $this->assertArrayHasKey('data', $response->json());
    }

    public function test_users_show_returns_user(): void
    {
        $admin = User::factory()->create();
        $target = User::factory()->create(['name' => 'Target User']);
        $response = $this->withHeaders($this->auth($admin))
            ->getJson('/api/users/' . $target->id);
        $response->assertStatus(200)->assertJsonPath('id', $target->id)->assertJsonPath('name', 'Target User');
    }

    public function test_users_store_creates_user(): void
    {
        Mail::fake();
        Role::firstOrCreate(['name' => 'super_admin'], ['label' => 'Super Admin']);
        $admin = User::factory()->create();
        $response = $this->withHeaders($this->auth($admin))
            ->postJson('/api/users', [
                'name' => 'New Crew',
                'email' => 'newcrew@test.com',
                'password' => 'password123',
                'username' => 'newcrew',
                'pin' => '1234',
            ]);
        $response->assertStatus(201)->assertJsonPath('name', 'New Crew')->assertJsonPath('email', 'newcrew@test.com');
        $this->assertDatabaseHas('users', ['email' => 'newcrew@test.com']);
        Mail::assertSent(UserCreatedMail::class, function (UserCreatedMail $mail): bool {
            return $mail->user->email === 'newcrew@test.com'
                && $mail->webPassword === 'password123'
                && $mail->mobilePin === '1234';
        });
    }

    public function test_users_update_modifies_user(): void
    {
        $admin = User::factory()->create();
        $target = User::factory()->create(['name' => 'Old Name']);
        $response = $this->withHeaders($this->auth($admin))
            ->putJson('/api/users/' . $target->id, ['name' => 'New Name']);
        $response->assertStatus(200)->assertJsonPath('name', 'New Name');
    }
}
