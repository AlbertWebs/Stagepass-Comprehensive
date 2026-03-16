<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyOfficeCheckin;
use App\Models\Event;
use App\Models\EventMeal;
use App\Models\EventUser;
use App\Models\Setting;
use App\Services\GeofenceService;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AttendanceController extends Controller
{
    public function __construct(
        private GeofenceService $geofence
    ) {}

    /**
     * Daily office check-in for permanent crew. Location must be within configured office radius (if set).
     * One check-in per user per day. Preferred time window is configurable (office_checkin_start_time / end_time);
     * check-in is allowed outside the window and recorded; response may include outside_window for reporting.
     */
    public function officeCheckin(Request $request): JsonResponse
    {
        $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
        ]);

        $user = $request->user();
        // Use fixed timezone so "today" matches /me and business location (Nairobi).
        $tz = 'Africa/Nairobi';
        $now = Carbon::now($tz);
        $today = $now->toDateString();

        Log::info('Office check-in request', [
            'user_id' => $user->id,
            'user_name' => $user->name ?? null,
            'latitude' => (float) $request->latitude,
            'longitude' => (float) $request->longitude,
            'requested_at' => $now->toIso8601String(),
        ]);

        $startTime = Setting::get('office_checkin_start_time', '09:00');
        $endTime = Setting::get('office_checkin_end_time', '12:00');
        $windowStart = Carbon::parse($today . ' ' . $startTime, $tz);
        $windowEnd = Carbon::parse($today . ' ' . $endTime, $tz);
        $withinWindow = $now->gte($windowStart) && $now->lte($windowEnd);

        $existing = DailyOfficeCheckin::where('user_id', $user->id)->where('date', $today)->first();
        if ($existing) {
            Log::info('Office check-in result: already_checked_in', [
                'user_id' => $user->id,
                'date' => $today,
                'existing_checkin_time' => $existing->checkin_time->toIso8601String(),
            ]);
            return response()->json([
                'message' => 'Already checked in today.',
                'checkin_time' => $existing->checkin_time->toIso8601String(),
            ], 422);
        }

        $officeLat = Setting::get('office_latitude');
        $officeLon = Setting::get('office_longitude');
        $officeRadius = max(30, (int) Setting::get('office_radius_m', 30));
        if ($officeLat !== null && $officeLat !== '' && $officeLon !== null && $officeLon !== '') {
            $userLat = (float) $request->latitude;
            $userLon = (float) $request->longitude;
            $officeLatF = (float) $officeLat;
            $officeLonF = (float) $officeLon;
            $inside = $this->geofence->isWithinRadius($userLat, $userLon, $officeLatF, $officeLonF, $officeRadius);
            if (! $inside) {
                $distanceMeters = (int) round($this->geofence->haversineDistance($userLat, $userLon, $officeLatF, $officeLonF));
                Log::info('Office check-in result: outside_geofence', [
                    'user_id' => $user->id,
                    'date' => $today,
                    'latitude' => $userLat,
                    'longitude' => $userLon,
                    'distance_meters' => $distanceMeters,
                    'radius_meters' => $officeRadius,
                ]);
                return response()->json([
                    'message' => 'You must be within ' . $officeRadius . ' m of the office to check in. You\'re about ' . $distanceMeters . ' m away. If you\'re at the office, ask an admin to increase the radius in Settings.',
                ], 403);
            }
        }

        try {
            $checkin = DailyOfficeCheckin::create([
                'user_id' => $user->id,
                'date' => $today,
                'checkin_time' => $now,
                'latitude' => (float) $request->latitude,
                'longitude' => (float) $request->longitude,
            ]);
            Log::info('Office check-in result: success', [
                'user_id' => $user->id,
                'date' => $today,
                'daily_office_checkin_id' => $checkin->id,
                'checkin_time' => $checkin->checkin_time->toIso8601String(),
                'within_window' => $withinWindow,
            ]);
        } catch (UniqueConstraintViolationException $e) {
            $existing = DailyOfficeCheckin::where('user_id', $user->id)->where('date', $today)->first();
            Log::info('Office check-in result: already_checked_in (race)', [
                'user_id' => $user->id,
                'date' => $today,
                'existing_checkin_time' => $existing?->checkin_time?->toIso8601String(),
            ]);
            return response()->json([
                'message' => 'Already checked in today.',
                'checkin_time' => $existing?->checkin_time?->toIso8601String() ?? $now->toIso8601String(),
            ], 422);
        }

        $payload = [
            'message' => 'Checked in successfully',
            'checkin_time' => $checkin->checkin_time->toIso8601String(),
        ];
        if (! $withinWindow) {
            $payload['outside_window'] = true;
            $payload['window'] = $startTime . '–' . $endTime;
        }

        return response()->json($payload);
    }

    /**
     * Daily office check-out. Records checkout_time on today's office check-in row.
     */
    public function officeCheckout(Request $request): JsonResponse
    {
        $user = $request->user();
        $tz = 'Africa/Nairobi';
        $today = Carbon::now($tz)->toDateString();
        $record = DailyOfficeCheckin::where('user_id', $user->id)->whereDate('date', $today)->first();

        if (! $record) {
            Log::info('Office checkout: no check-in found', [
                'user_id' => $user->id,
                'today' => $today,
            ]);
            return response()->json(['message' => 'You have not checked in today.'], 422);
        }
        if ($record->checkout_time) {
            return response()->json([
                'message' => 'Already checked out.',
                'checkout_time' => $record->checkout_time->toIso8601String(),
            ], 422);
        }

        $record->checkout_time = Carbon::now($tz);
        $record->save();

        return response()->json([
            'message' => 'Checked out successfully',
            'checkout_time' => $record->checkout_time->toIso8601String(),
        ]);
    }

    public function checkin(Request $request): JsonResponse
    {
        $request->validate([
            'event_id' => 'required|exists:events,id',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
        ]);

        $event = Event::findOrFail($request->event_id);
        $user = $request->user();

        if (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED], true)) {
            return response()->json(['message' => 'Cannot check in to an event that is already ended.'], 422);
        }

        $assignment = EventUser::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($assignment->checkin_time) {
            return response()->json([
                'message' => 'Already checked in',
                'checkin_time' => $assignment->checkin_time,
            ], 422);
        }

        // Geofencing: event must have location; check-in only allowed within radius
        if (! $event->latitude || ! $event->longitude) {
            return response()->json([
                'message' => 'Event location is not set. Geofence check-in is required. Ask the event organizer to set the event location.',
            ], 422);
        }

        $radius = (int) $event->geofence_radius;
        $inside = $this->geofence->isWithinRadius(
            (float) $request->latitude,
            (float) $request->longitude,
            (float) $event->latitude,
            (float) $event->longitude,
            $radius
        );
        if (! $inside) {
            return response()->json([
                'message' => 'You are outside the event geofence. Please move within ' . $radius . ' m of the event location to check in.',
            ], 403);
        }

        $now = now();
        $assignment->update([
            'checkin_time' => $now,
            'checkin_latitude' => (float) $request->latitude,
            'checkin_longitude' => (float) $request->longitude,
        ]);

        event(new \App\Events\CrewCheckedIn($assignment));

        return response()->json([
            'message' => 'Checked in successfully',
            'checkin_time' => $now->toIso8601String(),
        ]);
    }

    /**
     * Combined attendance stats: events (days when admin assigned to events) + office (weekdays Mon–Fri, last 30 days).
     * Pull-up rate = (event_checkins + office_checkins) / (total_assigned + expected_office_weekdays) * 100.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $tz = config('app.timezone', 'Africa/Nairobi');
        $today = Carbon::now($tz);
        $todayStr = $today->toDateString();
        $from = $today->copy()->subDays(30)->toDateString();

        // Include events on or before today so today's assignment and check-in count.
        $totalAssigned = EventUser::where('user_id', $user->id)
            ->whereHas('event', function ($q) use ($todayStr) {
                $q->whereDate('date', '<=', $todayStr);
            })
            ->count();

        $checkedIn = EventUser::where('user_id', $user->id)
            ->whereNotNull('checkin_time')
            ->whereHas('event', function ($q) use ($todayStr) {
                $q->whereDate('date', '<=', $todayStr);
            })
            ->count();

        $eventMissed = $totalAssigned - $checkedIn;

        $officeCheckinsLast30 = DailyOfficeCheckin::query()
            ->where('user_id', $user->id)
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $todayStr)
            ->count();

        $expectedOfficeWeekdays = $this->countWeekdaysInRange($from, $todayStr);

        $totalObligations = $totalAssigned + $expectedOfficeWeekdays;
        $fulfilled = $checkedIn + $officeCheckinsLast30;
        $pullUpPercentage = $totalObligations === 0
            ? 100
            : round((float) ($fulfilled / $totalObligations) * 100, 1);

        // Office streak: 100% minus each missed weekday in period (~22 days/month). No expected days = 100%.
        $officeStreakPercentage = $expectedOfficeWeekdays === 0
            ? 100
            : round((float) ($officeCheckinsLast30 / $expectedOfficeWeekdays) * 100, 1);

        // Events streak: 100% minus each allocated event where crew did not check in. No assignments = 100%.
        $eventsStreakPercentage = $totalAssigned === 0
            ? 100
            : round((float) ($checkedIn / $totalAssigned) * 100, 1);

        return response()->json([
            'total_assigned' => $totalAssigned,
            'checked_in' => $checkedIn,
            'missed' => $eventMissed,
            'attendance_percentage' => $totalAssigned === 0 ? 100 : round((float) ($checkedIn / $totalAssigned) * 100, 1),
            'office_checkins_last_30' => $officeCheckinsLast30,
            'expected_office_weekdays' => $expectedOfficeWeekdays,
            'pull_up_percentage' => $pullUpPercentage,
            'office_streak_percentage' => $officeStreakPercentage,
            'events_streak_percentage' => $eventsStreakPercentage,
        ]);
    }

    /** Count weekdays (Mon–Fri) in the date range [from, to] inclusive. */
    private function countWeekdaysInRange(string $from, string $to): int
    {
        $start = Carbon::parse($from)->startOfDay();
        $end = Carbon::parse($to)->startOfDay();
        if ($start->gt($end)) {
            return 0;
        }
        $count = 0;
        $d = $start->copy();
        while ($d->lte($end)) {
            $dayOfWeek = $d->dayOfWeek;
            if ($dayOfWeek >= 1 && $dayOfWeek <= 5) {
                $count++;
            }
            $d->addDay();
        }
        return $count;
    }

    public function checkout(Request $request): JsonResponse
    {
        $request->validate([
            'event_id' => 'required|exists:events,id',
        ]);

        $assignment = EventUser::where('event_id', $request->event_id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $event = $assignment->event;
        if (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED], true)) {
            return response()->json(['message' => 'Cannot check out from an event that is already ended.'], 422);
        }

        if (! $assignment->checkin_time) {
            return response()->json(['message' => 'You have not checked in yet'], 422);
        }

        if ($assignment->checkout_time) {
            return response()->json([
                'message' => 'Already checked out',
                'checkout_time' => $assignment->checkout_time,
            ], 422);
        }

        $checkout = now();
        $totalHours = Carbon::parse($assignment->checkin_time)->diffInMinutes($checkout) / 60;
        $assignment->update([
            'checkout_time' => $checkout,
            'total_hours' => round($totalHours, 2),
        ]);
        $assignment->refresh();

        $this->updateMealEligibility($assignment, $checkout);

        event(new \App\Events\CrewCheckedOut($assignment));

        return response()->json([
            'message' => 'Checked out successfully',
            'checkout_time' => $checkout->toIso8601String(),
            'total_hours' => $assignment->total_hours,
        ]);
    }

    private function updateMealEligibility(EventUser $assignment, Carbon $checkout): void
    {
        $event = $assignment->event;
        $breakfastCutoff = Carbon::parse($event->date->format('Y-m-d').' 07:00:00');
        $dinnerStart = Carbon::parse($event->date->format('Y-m-d').' 19:30:00');

        $meals = EventMeal::firstOrCreate(
            ['event_id' => $event->id, 'user_id' => $assignment->user_id],
            ['breakfast' => false, 'lunch' => false, 'dinner' => false]
        );

        if ($assignment->checkin_time && Carbon::parse($assignment->checkin_time)->lt($breakfastCutoff)) {
            $meals->breakfast = true;
        }
        $meals->lunch = true;
        if ($checkout->gte($dinnerStart)) {
            $meals->dinner = true;
        }
        $meals->save();
    }
}
