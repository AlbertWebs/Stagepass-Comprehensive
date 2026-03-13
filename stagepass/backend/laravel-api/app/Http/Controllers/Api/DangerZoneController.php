<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DangerZoneController extends Controller
{
    /**
     * Tables we never touch (users and user-related auth/roles).
     */
    private const PROTECTED_TABLES = [
        'users',
        'password_reset_tokens',
        'sessions',
        'roles',
        'permissions',
        'role_user',
        'permission_role',
        'personal_access_tokens',
    ];

    /**
     * All application tables that hold data we may wipe (non-user).
     * Order: child/junction tables first, then parents, so truncation works with FK checks on.
     */
    private const WIPEABLE_TABLES = [
        'task_comments',
        'task_user',
        'tasks',
        'time_off_request_attachments',
        'time_off_requests',
        'event_checklist_items',
        'event_equipment',
        'event_expenses',
        'event_meals',
        'event_notes',
        'event_payments',
        'event_user',
        'event_vehicle',
        'events',
        'equipment',
        'vehicles',
        'daily_office_checkins',
        'communications',
        'audit_logs',
        'clients',
        'reminder_logs',
        // 'settings' – excluded: do not delete site/office check-in config etc.
        'notifications',
        'activity_logs',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
    ];

    /**
     * Wipe all data from non-user tables. Admin only. Irreversible.
     */
    public function wipeNonUserData(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user || (! $user->hasRole('super_admin') && ! $user->hasRole('director') && ! $user->hasRole('admin'))) {
            return response()->json(['message' => 'Forbidden. Admin only.'], 403);
        }

        Schema::disableForeignKeyConstraints();

        try {
            $wiped = [];

            foreach (self::WIPEABLE_TABLES as $table) {
                if (! Schema::hasTable($table)) {
                    continue;
                }
                if (in_array($table, self::PROTECTED_TABLES, true)) {
                    continue;
                }

                DB::table($table)->truncate();
                $wiped[] = $table;
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        return response()->json([
            'message' => 'Non-user data wiped successfully.',
            'wiped_tables' => $wiped,
        ]);
    }
}
