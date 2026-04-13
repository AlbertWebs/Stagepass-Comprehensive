<?php

namespace Tests\Feature;

use App\Mail\UserCreatedMail;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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
                && $mail->mobilePin === '1234'
                && $mail->isResend === false;
        });
    }

    public function test_super_admin_can_send_welcome_email_for_existing_user(): void
    {
        Mail::fake();
        Role::firstOrCreate(['name' => 'super_admin'], ['label' => 'Super Admin']);
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::where('name', 'super_admin')->firstOrFail()->id);
        $target = User::factory()->create(['email' => 'existing@example.com', 'name' => 'Existing User']);

        $this->withHeaders($this->auth($admin))
            ->postJson("/api/users/{$target->id}/welcome-email", [])
            ->assertOk()
            ->assertJsonPath('message', 'Welcome email sent.');

        Mail::assertSent(UserCreatedMail::class, function (UserCreatedMail $mail) use ($target): bool {
            return $mail->isResend === true
                && $mail->user->id === $target->id
                && $mail->webPassword === null
                && $mail->mobilePin === null;
        });
    }

    public function test_send_welcome_email_updates_password_when_provided(): void
    {
        Mail::fake();
        Role::firstOrCreate(['name' => 'super_admin'], ['label' => 'Super Admin']);
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::where('name', 'super_admin')->firstOrFail()->id);
        $target = User::factory()->create(['email' => 'pwtest@example.com']);

        $this->withHeaders($this->auth($admin))
            ->postJson("/api/users/{$target->id}/welcome-email", [
                'password' => 'newpass99',
            ])
            ->assertOk();

        Mail::assertSent(UserCreatedMail::class, function (UserCreatedMail $mail) use ($target): bool {
            return $mail->isResend === true
                && $mail->user->id === $target->id
                && $mail->webPassword === 'newpass99';
        });

        $target->refresh();
        $this->assertTrue(Hash::check('newpass99', $target->password));
    }

    public function test_non_admin_cannot_send_welcome_email(): void
    {
        Mail::fake();
        Role::firstOrCreate(['name' => 'permanent_employee'], ['label' => 'Permanent employee']);
        $crew = User::factory()->create();
        $crew->roles()->attach(Role::where('name', 'permanent_employee')->firstOrFail()->id);
        $target = User::factory()->create(['email' => 'other@example.com']);

        $this->withHeaders($this->auth($crew))
            ->postJson("/api/users/{$target->id}/welcome-email", [])
            ->assertForbidden();

        Mail::assertNothingSent();
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
