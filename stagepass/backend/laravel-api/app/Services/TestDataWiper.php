<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TestDataWiper
{
    public const SCOPE_EVENTS = 'events';

    public const SCOPE_USERS = 'users';

    public const SCOPE_OPERATIONAL = 'operational';

    public const SCOPE_ALL = 'all';

    public const CONFIRM_PHRASE = 'DELETE TEST DATA';

    private const PROTECTED_ROLES = ['super_admin', 'director', 'admin'];

    private const EVENT_TABLES = [
        'overtime_notification_logs',
        'event_attendance_sessions',
        'event_allowances',
        'event_checklist_items',
        'event_equipment',
        'event_expenses',
        'event_meals',
        'event_notes',
        'event_payments',
        'event_user',
        'event_vehicle',
        'reminder_logs',
        'events',
    ];

    private const OPERATIONAL_TABLES = [
        'task_comments',
        'task_user',
        'tasks',
        'time_off_request_attachments',
        'time_off_requests',
        'equipment',
        'vehicles',
        'clients',
        'holidays',
        'allowance_types',
        'daily_office_checkins',
        'communications',
        'audit_logs',
        'notifications',
        'activity_logs',
        'geocoded_locations',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
    ];

    /**
     * @param  list<string>  $scopes
     * @return array{wiped_tables: list<string>, deleted_users: int, scopes: list<string>}
     */
    public function wipe(array $scopes, User $actor): array
    {
        $scopes = $this->normalizeScopes($scopes);
        $tables = $this->tablesForScopes($scopes);
        $wipedTables = [];
        $deletedUsers = 0;

        Schema::disableForeignKeyConstraints();

        try {
            foreach ($tables as $table) {
                if (! Schema::hasTable($table)) {
                    continue;
                }

                DB::table($table)->truncate();
                $wipedTables[] = $table;
            }

            if (in_array(self::SCOPE_USERS, $scopes, true)) {
                $deletedUsers = $this->deleteAllNonProtectedUsers($actor);
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        return [
            'wiped_tables' => $wipedTables,
            'deleted_users' => $deletedUsers,
            'scopes' => $scopes,
        ];
    }

    /**
     * @param  list<string>  $scopes
     * @return list<string>
     */
    public function normalizeScopes(array $scopes): array
    {
        $scopes = array_values(array_unique(array_map('strval', $scopes)));

        if (in_array(self::SCOPE_ALL, $scopes, true)) {
            return [self::SCOPE_EVENTS, self::SCOPE_OPERATIONAL, self::SCOPE_USERS];
        }

        return array_values(array_filter($scopes, fn (string $scope): bool => in_array($scope, [
            self::SCOPE_EVENTS,
            self::SCOPE_USERS,
            self::SCOPE_OPERATIONAL,
        ], true)));
    }

    /**
     * @param  list<string>  $scopes
     * @return list<string>
     */
    public function tablesForScopes(array $scopes): array
    {
        $tables = [];

        if (in_array(self::SCOPE_EVENTS, $scopes, true)) {
            $tables = array_merge($tables, self::EVENT_TABLES);
        }

        if (in_array(self::SCOPE_OPERATIONAL, $scopes, true)) {
            $tables = array_merge($tables, self::OPERATIONAL_TABLES);
        }

        return array_values(array_unique($tables));
    }

    /**
     * Delete every user except admins / directors / the actor.
     * Used by danger-zone wipe and Crew “delete all” (many crew have no role assigned).
     */
    public function deleteAllNonProtectedUsers(User $actor): int
    {
        $protectedUserIds = DB::table('role_user')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->whereIn('roles.name', self::PROTECTED_ROLES)
            ->pluck('role_user.user_id')
            ->push($actor->id)
            ->unique()
            ->values();

        $userIds = User::query()
            ->whereNotIn('id', $protectedUserIds)
            ->pluck('id');

        if ($userIds->isEmpty()) {
            return 0;
        }

        $ids = $userIds->all();

        if (Schema::hasTable('personal_access_tokens')) {
            DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->whereIn('tokenable_id', $ids)
                ->delete();
        }

        if (Schema::hasTable('sessions')) {
            DB::table('sessions')->whereIn('user_id', $ids)->delete();
        }

        if (Schema::hasTable('password_reset_tokens')) {
            $emails = User::query()->whereIn('id', $ids)->pluck('email');
            if ($emails->isNotEmpty()) {
                DB::table('password_reset_tokens')->whereIn('email', $emails->all())->delete();
            }
        }

        if (Schema::hasTable('notifications')) {
            DB::table('notifications')
                ->where('notifiable_type', User::class)
                ->whereIn('notifiable_id', $ids)
                ->delete();
        }

        if (Schema::hasTable('role_user')) {
            DB::table('role_user')->whereIn('user_id', $ids)->delete();
        }

        return User::query()->whereIn('id', $ids)->delete();
    }
}
