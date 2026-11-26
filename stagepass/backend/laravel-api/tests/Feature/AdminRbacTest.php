<?php

namespace Tests\Feature;

use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\Role;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class AdminRbacTest extends TestCase
{
    use RefreshDatabase;

    private function adminHeaders(User $user): array
    {
        Auth::forgetGuards();
        return ['Authorization' => 'Bearer '.$user->createToken('admin-panel', ['admin-panel'])->plainTextToken];
    }

    public function test_hr_can_open_workforce_dashboard_but_not_financial_payments(): void
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('name', 'hr')->firstOrFail()->id);
        $this->assertFalse($user->hasSuperAdminAccess());
        $this->assertFalse($user->hasPermission('payments.view'));

        $this->withHeaders($this->adminHeaders($user))->getJson('/api/admin/dashboard')->assertOk();
        $this->withHeaders($this->adminHeaders($user))->getJson('/api/payments')->assertForbidden();
        $this->withHeaders($this->adminHeaders($user))->postJson('/api/payments/earned-allowances', [])->assertForbidden();
        $this->withHeaders($this->adminHeaders($user))->postJson('/api/events', [])->assertForbidden();
    }

    public function test_accounts_can_open_financial_payments_but_not_attendance_records(): void
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('name', 'accounts')->firstOrFail()->id);

        $this->withHeaders($this->adminHeaders($user))->getJson('/api/payments')->assertOk();
        $this->withHeaders($this->adminHeaders($user))->getJson('/api/checkins')->assertForbidden();
    }

    public function test_last_active_super_administrator_cannot_be_deleted(): void
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('name', 'super_admin')->firstOrFail()->id);

        $this->withHeaders($this->adminHeaders($user))
            ->deleteJson('/api/users/'.$user->id)
            ->assertStatus(422)
            ->assertJsonPath('message', 'The last active Super Administrator cannot be deleted.');
    }

    public function test_hr_has_only_the_workforce_and_holiday_views_granted_by_default(): void
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('name', 'hr')->firstOrFail()->id);
        $this->assertFalse($user->hasSuperAdminAccess());
        $this->assertFalse($user->hasPermission('tasks.view'));
        $headers = $this->adminHeaders($user);

        $this->withHeaders($headers)->getJson('/api/holidays')->assertOk();
        $this->withHeaders($headers)->getJson('/api/clients')->assertForbidden();
        $this->withHeaders($headers)->getJson('/api/tasks')->assertForbidden();
    }

    public function test_granular_task_permissions_are_enforced_by_api(): void
    {
        $role = Role::query()->create(['name' => 'task_reader', 'label' => 'Task Reader']);
        $role->permissions()->attach(Permission::where('name', 'tasks.view')->firstOrFail()->id);
        $user = User::factory()->create();
        $user->roles()->attach($role->id);
        $headers = $this->adminHeaders($user);

        $this->withHeaders($headers)->getJson('/api/tasks')->assertOk();
        $this->withHeaders($headers)->postJson('/api/tasks', ['title' => 'Unauthorized task'])->assertForbidden();
    }

    public function test_mobile_crew_keeps_assigned_task_access_but_cannot_manage_clients(): void
    {
        $crewRole = Role::query()->firstOrCreate(['name' => 'crew'], ['label' => 'Crew']);
        $user = User::factory()->create();
        $user->roles()->attach($crewRole->id);
        $headers = ['Authorization' => 'Bearer '.$user->createToken('mobile', ['mobile'])->plainTextToken];

        $this->withHeaders($headers)->getJson('/api/tasks')->assertOk();
        $this->withHeaders($headers)->getJson('/api/clients')->assertForbidden();
    }

    public function test_hr_verifies_allowance_before_accounts_can_approve_it(): void
    {
        $hr = User::factory()->create();
        $hr->roles()->attach(Role::where('name', 'hr')->firstOrFail()->id);
        $this->assertTrue($hr->hasPermission('allowances.verify'));
        $accounts = User::factory()->create();
        $accounts->roles()->attach(Role::where('name', 'accounts')->firstOrFail()->id);
        $crew = User::factory()->create();
        $event = Event::create([
            'name' => 'Allowance Verification Event',
            'date' => now()->toDateString(),
            'start_time' => '10:00',
            'team_leader_id' => $hr->id,
            'created_by_id' => $hr->id,
            'status' => Event::STATUS_ACTIVE,
        ]);
        $type = AllowanceType::create(['name' => 'Verification Test', 'is_active' => true]);
        $allowance = EventAllowance::create([
            'event_id' => $event->id,
            'crew_id' => $crew->id,
            'allowance_type_id' => $type->id,
            'amount' => 1250,
            'recorded_by' => $crew->id,
            'recorded_at' => now(),
            'status' => EventAllowance::STATUS_PENDING,
            'source' => EventAllowance::SOURCE_MANUAL,
        ]);

        $accountsHeaders = $this->adminHeaders($accounts);
        $this->withHeaders($accountsHeaders)
            ->postJson('/api/payments/earned-allowances/'.$allowance->id.'/status', ['status' => 'approved'])
            ->assertStatus(422);
        $this->withHeaders($this->adminHeaders($hr))
            ->postJson('/api/payments/earned-allowances/'.$allowance->id.'/status', ['status' => 'approved'])
            ->assertForbidden();
        Auth::forgetGuards();
        $this->withHeaders($accountsHeaders)
            ->postJson('/api/payments/earned-allowances/'.$allowance->id.'/verify', ['verified' => true])
            ->assertForbidden();

        Auth::forgetGuards();
        $this->withHeaders($this->adminHeaders($hr))
            ->postJson('/api/payments/earned-allowances/'.$allowance->id.'/verify', ['verified' => true, 'note' => 'Attendance reconciled'])
            ->assertOk()
            ->assertJsonPath('hr_verified', true)
            ->assertJsonPath('hr_verification_note', 'Attendance reconciled');

        Auth::forgetGuards();
        $this->withHeaders($accountsHeaders)
            ->postJson('/api/payments/earned-allowances/'.$allowance->id.'/status', ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('status', 'approved');
        $this->assertDatabaseHas('audit_logs', ['action' => 'allowance.hr_verified', 'subject_id' => $allowance->id]);
    }
}
