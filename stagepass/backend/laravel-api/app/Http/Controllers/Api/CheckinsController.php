<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyOfficeCheckin;
use App\Models\EventUser;
use App\Models\TimeOffRequest;
use App\Models\User;
use App\Services\FcmSender;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class CheckinsController extends Controller
{
    /**
     * Return the server's current date in the app timezone (YYYY-MM-DD).
     * Use this so the Checkins page "Today" matches the date used when recording office check-ins.
     */
    public function serverDate(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('director') && ! $user->hasRole('admin')) {
            return response()->json(['message' => 'Only admins can view check-ins.'], 403);
        }

        $tz = config('app.timezone', 'Africa/Nairobi');
        $date = Carbon::now($tz)->toDateString();

        return response()->json([
            'date' => $date,
            'timezone' => $tz,
        ]);
    }

    /**
     * List all employees with their daily office check-in status for a single date.
     * Query: date (optional, default today). Returns one row per user.
     */
    public function dailyEmployeeStatus(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('director') && ! $user->hasRole('admin')) {
            return response()->json(['message' => 'Only admins can view daily status.'], 403);
        }

        $tz = config('app.timezone', 'Africa/Nairobi');
        $date = $request->filled('date')
            ? Carbon::parse($request->date, $tz)->toDateString()
            : Carbon::now($tz)->toDateString();

        $officeCheckins = DailyOfficeCheckin::query()
            ->whereDate('date', $date)
            ->with('user:id,name,email')
            ->get()
            ->keyBy('user_id');

        $usersOffOnDate = TimeOffRequest::query()
            ->where('status', TimeOffRequest::STATUS_APPROVED)
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->pluck('user_id')
            ->flip()
            ->all();

        $users = User::query()
            ->with('roles:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'is_permanent_employee']);

        $list = $users->map(function (User $u) use ($officeCheckins, $usersOffOnDate) {
            $checkin = $officeCheckins->get($u->id);
            $isOff = isset($usersOffOnDate[$u->id]);
            $expectedToReport = $u->is_permanent_employee
                || $u->hasRole('admin')
                || $u->hasRole('team_leader');
            $checkedOut = $checkin && $checkin->checkout_time !== null;
            return [
                'user_id' => $u->id,
                'user_name' => $u->name,
                'user_email' => $u->email,
                'checked_in' => $checkin !== null,
                'checkin_time' => $checkin ? $checkin->checkin_time->format('H:i') : null,
                'checkin_time_iso' => $checkin ? $checkin->checkin_time->toIso8601String() : null,
                'checked_out' => $checkedOut,
                'checkout_time' => $checkin && $checkin->checkout_time ? $checkin->checkout_time->format('H:i') : null,
                'checkout_time_iso' => $checkin && $checkin->checkout_time ? $checkin->checkout_time->toIso8601String() : null,
                'total_hours' => $checkin ? (float) ($checkin->total_hours ?? 0) : 0,
                'extra_hours' => $checkin ? (float) ($checkin->extra_hours ?? 0) : 0,
                'is_sunday' => $checkin ? (bool) $checkin->is_sunday : false,
                'is_holiday' => $checkin ? (bool) $checkin->is_holiday : false,
                'holiday_name' => $checkin?->holiday_name,
                'day_type' => $checkin ? ($checkin->is_holiday ? 'holiday' : ($checkin->is_sunday ? 'sunday' : 'normal')) : 'normal',
                'is_off' => $isOff,
                'expected_to_report' => $expectedToReport,
            ];
        })->values()->all();

        return response()->json([
            'date' => $date,
            'employees' => $list,
        ]);
    }

    /**
     * Set a user as off or on for a single date.
     * Body: user_id (int), date (YYYY-MM-DD), off (bool).
     * off=true: create approved single-day time-off for that date (idempotent if already off).
     * off=false: remove single-day approved time-off for that date; returns 422 if user has multi-day time off.
     */
    public function setEmployeeOff(Request $request): JsonResponse
    {
        $admin = $request->user();
        if (! $admin->hasRole('super_admin') && ! $admin->hasRole('director') && ! $admin->hasRole('admin')) {
            return response()->json(['message' => 'Only admins can set employee off/on.'], 403);
        }

        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'date' => 'required|date',
            'off' => 'required|boolean',
        ]);

        $userId = (int) $request->user_id;
        $date = Carbon::parse($request->date)->toDateString();

        if ($request->boolean('off')) {
            $exists = TimeOffRequest::query()
                ->where('user_id', $userId)
                ->where('status', TimeOffRequest::STATUS_APPROVED)
                ->whereDate('start_date', '<=', $date)
                ->whereDate('end_date', '>=', $date)
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'User is already marked off for this date.', 'ok' => true]);
            }
            TimeOffRequest::create([
                'user_id' => $userId,
                'start_date' => $date,
                'end_date' => $date,
                'reason' => 'Marked off (check-ins)',
                'status' => TimeOffRequest::STATUS_APPROVED,
                'processed_by' => $admin->id,
                'processed_at' => now(),
            ]);
            return response()->json(['message' => 'User marked off for this date.', 'ok' => true]);
        }

        $timeOffRequest = TimeOffRequest::query()
            ->where('user_id', $userId)
            ->where('status', TimeOffRequest::STATUS_APPROVED)
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->first();

        if (! $timeOffRequest) {
            return response()->json(['message' => 'User is not off for this date.', 'ok' => true]);
        }

        if ($timeOffRequest->start_date->toDateString() !== $date || $timeOffRequest->end_date->toDateString() !== $date) {
            $user = $timeOffRequest->user;
            return response()->json([
                'message' => 'User has multi-day time off covering this date. Edit or remove it under Time off.',
                'user_id' => $userId,
                'user_name' => $user?->name,
            ], 422);
        }

        $timeOffRequest->update([
            'status' => TimeOffRequest::STATUS_REJECTED,
            'processed_by' => $admin->id,
            'processed_at' => now(),
        ]);

        return response()->json(['message' => 'User marked on for this date.', 'ok' => true]);
    }

    /**
     * List all check-ins (office + event) for a date range or single date.
     * Query: from, to (date range) OR date (single day).
     * Returns unified list with type (office|event), color-coding info, and report-ready structure.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('director') && ! $user->hasRole('admin')) {
            return response()->json(['message' => 'Only admins can view check-ins.'], 403);
        }

        $from = null;
        $to = null;

        $tz = config('app.timezone', 'Africa/Nairobi');
        if ($request->filled('date')) {
            $date = Carbon::parse($request->date, $tz)->startOfDay();
            $from = $date->copy();
            $to = $date->copy()->endOfDay();
        } elseif ($request->filled('from') && $request->filled('to')) {
            $request->validate([
                'from' => 'required|date',
                'to' => 'required|date|after_or_equal:from',
            ]);
            $from = Carbon::parse($request->from, $tz)->startOfDay();
            $to = Carbon::parse($request->to, $tz)->endOfDay();
        } else {
            $today = Carbon::now($tz)->startOfDay();
            $from = $today->copy();
            $to = $today->copy()->endOfDay();
        }

        $fromStr = $from->toDateString();
        $toStr = $to->toDateString();
        $officeCheckinsQuery = DailyOfficeCheckin::query()
            ->with('user:id,name,email')
            ->orderBy('date')
            ->orderBy('checkin_time');
        if ($fromStr === $toStr) {
            $officeCheckinsQuery->whereDate('date', $fromStr);
        } else {
            $officeCheckinsQuery->whereBetween('date', [$fromStr, $toStr]);
        }
        $officeCheckins = $officeCheckinsQuery->get();

        // Event check-ins: filter by when the check-in occurred (in app timezone), not by event date span.
        $fromUtc = $from->copy()->setTimezone('UTC');
        $toUtc = $to->copy()->setTimezone('UTC');
        $eventCheckins = EventUser::query()
            ->whereNotNull('checkin_time')
            ->whereBetween('checkin_time', [$fromUtc, $toUtc])
            ->with(['user:id,name,email', 'event:id,name,date,location_name'])
            ->orderBy('checkin_time')
            ->get();

        $list = $this->buildCheckinsList($officeCheckins, $eventCheckins);

        $summary = [
            'total' => count($list),
            'office' => $officeCheckins->count(),
            'event' => $eventCheckins->count(),
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
        ];

        return response()->json([
            'summary' => $summary,
            'checkins' => $list,
        ]);
    }

    /**
     * @param  Collection<int, DailyOfficeCheckin>  $officeCheckins
     * @param  Collection<int, EventUser>  $eventCheckins
     * @return array<int, array<string, mixed>>
     */
    private function buildCheckinsList(Collection $officeCheckins, Collection $eventCheckins): array
    {
        $items = [];

        foreach ($officeCheckins as $c) {
            $dateStr = $c->date ? \Carbon\Carbon::parse($c->date)->format('Y-m-d') : '';
            $checkinTime = $c->checkin_time ? \Carbon\Carbon::parse($c->checkin_time)->format('H:i') : '—';
            $checkinTimeIso = $c->checkin_time ? \Carbon\Carbon::parse($c->checkin_time)->toIso8601String() : '';
            $checkoutTime = $c->checkout_time ? \Carbon\Carbon::parse($c->checkout_time)->format('H:i') : null;
            $checkoutTimeIso = $c->checkout_time ? \Carbon\Carbon::parse($c->checkout_time)->toIso8601String() : null;
            $items[] = [
                'type' => 'office',
                'id' => 'office-' . $c->id,
                'date' => $dateStr,
                'checkin_time' => $checkinTime,
                'checkin_time_iso' => $checkinTimeIso,
                'checkout_time' => $checkoutTime,
                'checkout_time_iso' => $checkoutTimeIso,
                'user_id' => $c->user_id,
                'user_name' => $c->user?->name ?? 'User #' . $c->user_id,
                'user_email' => $c->user?->email ?? null,
                'event_id' => null,
                'event_name' => null,
                'location' => 'Office',
                'total_hours' => (float) ($c->total_hours ?? 0),
                'extra_hours' => (float) ($c->extra_hours ?? 0),
                'is_sunday' => (bool) $c->is_sunday,
                'is_holiday' => (bool) $c->is_holiday,
                'holiday_name' => $c->holiday_name,
                'day_type' => $c->is_holiday ? 'holiday' : ($c->is_sunday ? 'sunday' : 'normal'),
            ];
        }

        foreach ($eventCheckins as $a) {
            $items[] = [
                'type' => 'event',
                'id' => 'event-' . $a->event_id . '-' . $a->user_id,
                'date' => $a->event?->date?->format('Y-m-d') ?? $a->checkin_time?->format('Y-m-d'),
                'checkin_time' => $a->checkin_time?->format('H:i') ?? '—',
                'checkin_time_iso' => $a->checkin_time?->toIso8601String(),
                'checkout_time' => $a->checkout_time ? $a->checkout_time->format('H:i') : null,
                'checkout_time_iso' => $a->checkout_time?->toIso8601String(),
                'user_id' => $a->user_id,
                'user_name' => $a->user?->name ?? 'User #' . $a->user_id,
                'user_email' => $a->user?->email ?? null,
                'event_id' => $a->event_id,
                'event_name' => $a->event?->name ?? 'Event #' . $a->event_id,
                'location' => $a->event?->location_name ?? $a->event?->name ?? 'Event',
                'total_hours' => (float) ($a->total_hours ?? 0),
                'extra_hours' => (float) ($a->extra_hours ?? 0),
                'is_sunday' => (bool) $a->is_sunday,
                'is_holiday' => (bool) $a->is_holiday,
                'holiday_name' => $a->holiday_name,
                'day_type' => $a->is_holiday ? 'holiday' : ($a->is_sunday ? 'sunday' : 'normal'),
                'pause_duration' => (int) ($a->pause_duration ?? 0),
                'is_paused' => (bool) ($a->is_paused ?? false),
                'transport_type' => $a->transport_type,
                'transport_amount' => $a->transport_amount !== null ? (float) $a->transport_amount : null,
            ];
        }

        usort($items, function ($a, $b) {
            $d = strcmp($b['date'], $a['date']);
            if ($d !== 0) {
                return $d;
            }
            return strcmp($b['checkin_time'] ?? '', $a['checkin_time'] ?? '');
        });

        return array_values($items);
    }

    /**
     * Send a push notification to a user's mobile app (admin only).
     * Body: user_id (required), title (optional), body (optional).
     */
    public function sendPush(Request $request): JsonResponse
    {
        $admin = $request->user();
        if (! $admin->hasRole('super_admin') && ! $admin->hasRole('director') && ! $admin->hasRole('admin')) {
            return response()->json(['message' => 'Only admins can send push notifications.'], 403);
        }

        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'title' => 'nullable|string|max:255',
            'body' => 'nullable|string|max:1000',
        ]);

        $user = User::find($request->user_id);
        if (! $user->fcm_token) {
            return response()->json([
                'message' => 'This user has no device registered for push notifications.',
            ], 422);
        }

        $title = $request->input('title', 'Stagepass');
        $body = $request->input('body', 'Please check in when you\'re ready.');

        $sent = app(FcmSender::class)->send($user->fcm_token, $title, $body, []);

        if (! $sent) {
            return response()->json([
                'message' => 'Failed to send push notification. Check server logs and FCM configuration.',
            ], 502);
        }

        return response()->json([
            'message' => 'Push notification sent.',
            'ok' => true,
        ]);
    }
}
