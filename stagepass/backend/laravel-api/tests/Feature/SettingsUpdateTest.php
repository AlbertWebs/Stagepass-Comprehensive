<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SettingsUpdateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RoleSeeder::class, SettingsSeeder::class]);
    }

    public function test_super_admin_can_update_settings_via_nested_json(): void
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('name', 'super_admin')->firstOrFail()->id);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/settings', [
            'settings' => [
                'app_name' => 'Stagepass QA',
                'company_name' => 'Stagepass QA Co',
            ],
        ]);

        $response->assertOk();
        $response->assertJsonFragment(['app_name' => 'Stagepass QA']);
        $this->assertSame('Stagepass QA', Setting::get('app_name'));
    }

    public function test_director_can_update_settings(): void
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('name', 'director')->firstOrFail()->id);
        Sanctum::actingAs($user);

        $this->postJson('/api/settings', [
            'settings' => ['timezone' => 'UTC'],
        ])->assertOk();

        $this->assertSame('UTC', Setting::get('timezone'));
    }

    public function test_crew_cannot_update_settings(): void
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('name', 'permanent_employee')->firstOrFail()->id);
        Sanctum::actingAs($user);

        $this->postJson('/api/settings', [
            'settings' => ['app_name' => 'Hacked'],
        ])->assertForbidden();
    }
}
