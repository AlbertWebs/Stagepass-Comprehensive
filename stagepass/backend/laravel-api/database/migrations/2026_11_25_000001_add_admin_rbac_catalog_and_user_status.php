<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const CATALOG = [
        'dashboard.view' => ['Dashboard', 'Overview'],
        'employees.view' => ['View employees and crew', 'Workforce'],
        'employees.create' => ['Create employees and crew', 'Workforce'],
        'employees.edit' => ['Edit employees and crew', 'Workforce'],
        'employees.delete' => ['Deactivate or delete employees', 'Workforce'],
        'events.view' => ['View events', 'Events'],
        'events.create' => ['Create events', 'Events'],
        'events.edit' => ['Edit events', 'Events'],
        'events.delete' => ['Delete events', 'Events'],
        'clients.view' => ['View clients', 'Events'],
        'clients.create' => ['Create clients', 'Events'],
        'clients.edit' => ['Edit clients', 'Events'],
        'clients.delete' => ['Delete clients', 'Events'],
        'equipment.view' => ['View equipment', 'Operations'],
        'equipment.create' => ['Create equipment', 'Operations'],
        'equipment.edit' => ['Edit equipment', 'Operations'],
        'equipment.delete' => ['Delete equipment', 'Operations'],
        'transport.view' => ['View transport', 'Operations'],
        'transport.create' => ['Create transport', 'Operations'],
        'transport.edit' => ['Edit transport', 'Operations'],
        'transport.delete' => ['Delete transport', 'Operations'],
        'holidays.view' => ['View public holidays', 'Workforce'],
        'holidays.manage' => ['Manage public holidays', 'Workforce'],
        'tasks.view' => ['View tasks', 'Tasks'],
        'tasks.create' => ['Create tasks', 'Tasks'],
        'tasks.edit' => ['Edit tasks', 'Tasks'],
        'tasks.delete' => ['Delete tasks', 'Tasks'],
        'attendance.view' => ['View attendance', 'Attendance'],
        'attendance.edit' => ['Adjust attendance', 'Attendance'],
        'attendance.verify' => ['Verify attendance', 'Attendance'],
        'attendance.export' => ['Export attendance reports', 'Attendance'],
        'timeoff.view' => ['Review employee time off', 'Workforce'],
        'timeoff.edit' => ['Manage employee time off', 'Workforce'],
        'timeoff.approve' => ['Approve or decline time off', 'Workforce'],
        'allowances.view' => ['View allowances', 'Finance'],
        'allowances.create' => ['Create allowance records', 'Finance'],
        'allowances.edit' => ['Edit allowance records', 'Finance'],
        'allowances.verify' => ['Verify allowance eligibility', 'Finance'],
        'allowances.approve' => ['Approve allowances', 'Finance'],
        'allowances.export' => ['Export allowance reports', 'Finance'],
        'payments.view' => ['View payments', 'Finance'],
        'payments.process' => ['Process payments', 'Finance'],
        'payments.approve' => ['Approve payments', 'Finance'],
        'payments.export' => ['Export payment reports', 'Finance'],
        'reports.hr.view' => ['View HR reports', 'Reports'],
        'reports.hr.export' => ['Export HR reports', 'Reports'],
        'reports.financial.export' => ['Export financial reports', 'Reports'],
        'reports.financial.view' => ['View financial reports', 'Reports'],
        'reports.all.view' => ['View all reports', 'Reports'],
        'reports.all.export' => ['Export all reports', 'Reports'],
        'roles.manage' => ['Manage roles and permissions', 'Administration'],
        'users.view' => ['View user accounts', 'Administration'],
        'users.create' => ['Create user accounts', 'Administration'],
        'users.edit' => ['Edit user accounts', 'Administration'],
        'users.delete' => ['Deactivate or delete user accounts', 'Administration'],
        'settings.manage' => ['Manage system settings', 'Administration'],
        'audit.view' => ['View audit logs', 'Administration'],
        'notifications.manage' => ['Manage notifications', 'Administration'],
        'communications.view' => ['View announcements', 'Administration'],
        'communications.manage' => ['Manage announcements', 'Administration'],
        'backup.manage' => ['Manage backups', 'Administration'],
        'locations.manage' => ['Manage office locations', 'Administration'],
        'approvals.manage' => ['Manage approvals', 'Administration'],
        'exports.manage' => ['Export data', 'Reports'],
    ];

    public function up(): void
    {
        Schema::table('permissions', function (Blueprint $table): void {
            $table->string('module')->nullable()->index();
            $table->string('action')->nullable();
        });
        Schema::table('roles', function (Blueprint $table): void {
            $table->boolean('is_system')->default(false);
        });
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('is_active')->default(true)->index();
        });
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->string('action')->nullable()->index();
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable()->index();
            $table->json('before_values')->nullable();
            $table->json('after_values')->nullable();
        });

        DB::transaction(function (): void {
            foreach (self::CATALOG as $name => [$label, $module]) {
                [$prefix, $action] = explode('.', $name, 2);
                Permission::query()->updateOrCreate(['name' => $name], [
                    'label' => $label,
                    'module' => $module,
                    'action' => $action,
                ]);
            }

            $allPermissions = Permission::query()->pluck('id')->all();
            foreach ([
                'super_admin' => 'Super Administrator',
                'admin' => 'Administrator',
                'director' => 'Director',
                'hr' => 'Human Resources',
                'accounts' => 'Accounts',
            ] as $name => $label) {
                $role = Role::query()->updateOrCreate(['name' => $name], [
                    'label' => $label,
                    'is_system' => true,
                ]);

                if (in_array($name, ['super_admin', 'admin', 'director'], true)) {
                    $role->permissions()->syncWithoutDetaching($allPermissions);
                }
            }

            $hr = Role::query()->where('name', 'hr')->firstOrFail();
            $hrPermissions = Permission::query()->whereIn('name', [
                'dashboard.view', 'employees.view', 'employees.create', 'employees.edit', 'events.view', 'attendance.view',
                'attendance.verify', 'attendance.export', 'allowances.view',
                'allowances.verify', 'reports.hr.view', 'reports.hr.export',
                'timeoff.view', 'timeoff.edit', 'timeoff.approve', 'holidays.view',
            ])->pluck('id')->all();
            $hr->permissions()->syncWithoutDetaching($hrPermissions);

            $accounts = Role::query()->where('name', 'accounts')->firstOrFail();
            $accountPermissions = Permission::query()->whereIn('name', [
                'dashboard.view', 'allowances.view', 'allowances.approve', 'allowances.export',
                'payments.view', 'payments.process', 'payments.approve', 'payments.export',
                'reports.financial.view', 'reports.financial.export', 'holidays.view',
            ])->pluck('id')->all();
            $accounts->permissions()->syncWithoutDetaching($accountPermissions);

            $teamLeadRoles = Role::query()->whereIn('name', ['team_leader', 'teamleader'])->get();
            if ($teamLeadRoles->isEmpty()) {
                $teamLeadRoles = collect([Role::query()->create(['name' => 'team_leader', 'label' => 'Team Leader', 'is_system' => true])]);
            }
            $teamLeadPermissionIds = Permission::query()->whereIn('name', ['dashboard.view', 'events.view', 'tasks.view'])->pluck('id')->all();
            foreach ($teamLeadRoles as $teamLeadRole) {
                $teamLeadRole->is_system = true;
                $teamLeadRole->save();
                $teamLeadRole->permissions()->syncWithoutDetaching($teamLeadPermissionIds);
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('is_active'));
        Schema::table('roles', fn (Blueprint $table) => $table->dropColumn('is_system'));
        Schema::table('permissions', fn (Blueprint $table) => $table->dropColumn(['module', 'action']));
        Schema::table('audit_logs', fn (Blueprint $table) => $table->dropColumn(['action', 'subject_type', 'subject_id', 'before_values', 'after_values']));
    }
};
