<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\TestDataWiper;
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
        'events',
        'equipment',
        'vehicles',
        'clients',
        'holidays',
        'allowance_types',
        'daily_office_checkins',
        'communications',
        'audit_logs',
        'reminder_logs',
        'notifications',
        'activity_logs',
        'geocoded_locations',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
    ];

    public function __construct(private readonly TestDataWiper $testDataWiper) {}

    /**
     * Wipe all data from non-user tables. Admin only. Irreversible.
     */
    public function wipeNonUserData(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
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

    /**
     * Selectively wipe test data (events, users, operational). Admin only. Irreversible.
     */
    public function wipeTestData(Request $request): JsonResponse
    {
        if ($response = $this->authorizeAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'scopes' => 'required|array|min:1',
            'scopes.*' => 'string|in:events,users,operational,all',
            'confirm' => 'required|string',
        ]);

        if (trim($validated['confirm']) !== TestDataWiper::CONFIRM_PHRASE) {
            return response()->json([
                'message' => 'Confirmation phrase does not match. Type exactly: '.TestDataWiper::CONFIRM_PHRASE,
            ], 422);
        }

        $scopes = $this->testDataWiper->normalizeScopes($validated['scopes']);
        if ($scopes === []) {
            return response()->json(['message' => 'Select at least one data category to delete.'], 422);
        }

        $result = $this->testDataWiper->wipe($scopes, $request->user());

        return response()->json([
            'message' => 'Selected test data deleted successfully.',
            'scopes' => $result['scopes'],
            'wiped_tables' => $result['wiped_tables'],
            'deleted_users' => $result['deleted_users'],
        ]);
    }

    private function authorizeAdmin(Request $request): ?JsonResponse
    {
        $user = $request->user();
        if (! $user || (! $user->hasRole('super_admin') && ! $user->hasRole('director') && ! $user->hasRole('admin'))) {
            return response()->json(['message' => 'Forbidden. Admin only.'], 403);
        }

        return null;
    }
}
