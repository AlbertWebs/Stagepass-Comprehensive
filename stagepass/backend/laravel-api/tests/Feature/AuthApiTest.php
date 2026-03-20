<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_with_email_password_returns_token_and_user(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@stagepass.test',
            'password' => bcrypt('secret123'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'admin@stagepass.test',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['token', 'token_type', 'user'])
            ->assertJson(['token_type' => 'Bearer']);
        $this->assertNotEmpty($response->json('token'));
    }

    public function test_login_with_username_pin_returns_token_and_user(): void
    {
        $user = User::factory()->withPin('5678')->create([
            'username' => 'johndoe',
        ]);

        $response = $this->postJson('/api/login', [
            'username' => 'johndoe',
            'pin' => '5678',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['token', 'token_type', 'user'])
            ->assertJsonPath('user.username', 'johndoe');
    }

    public function test_login_with_invalid_credentials_returns_422(): void
    {
        User::factory()->create(['email' => 'admin@stagepass.test']);

        $response = $this->postJson('/api/login', [
            'email' => 'admin@stagepass.test',
            'password' => 'wrong',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_login_display_name_by_username_returns_404_when_not_found(): void
    {
        $response = $this->getJson('/api/login-display-name?username=nobody');
        $response->assertStatus(404);
    }

    public function test_login_display_name_by_username_returns_name_when_found(): void
    {
        User::factory()->create(['username' => 'jane', 'name' => 'Jane Doe']);

        $response = $this->getJson('/api/login-display-name?username=jane');
        $response->assertStatus(200)->assertJson(['name' => 'Jane Doe']);
    }

    public function test_logout_returns_success_and_deletes_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;
        $this->assertGreaterThan(0, $user->tokens()->count());

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/logout');
        $response->assertStatus(200)->assertJson(['message' => 'Logged out successfully']);

        $user->refresh();
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_me_returns_user_when_authenticated(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/me');

        $response->assertStatus(200)
            ->assertJsonPath('id', $user->id)
            ->assertJsonPath('email', $user->email);
    }

    public function test_me_returns_401_when_unauthenticated(): void
    {
        $response = $this->getJson('/api/me');
        $response->assertStatus(401);
    }
}
