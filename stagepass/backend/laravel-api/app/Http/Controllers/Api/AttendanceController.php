<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyOfficeCheckin;
use App\Models\Event;
use App\Models\EventUser;
use App\Models\Setting;
use App\Services\AttendanceOvertimeService;
use App\Services\EventCrewAttendanceService;
use App\Services\GeofenceService;
use App\Support\EventAttendanceEligibility;
use App\Support\OfficeCheckinRequiredDays;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AttendanceController extends Controller
{
    public function __construct(
        private GeofenceService $geofence,
        private AttendanceOvertimeService $overtime,
        private EventCrewAttendanceService $eventCrewAttendance
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

        if (! OfficeCheckinRequiredDays::isRequiredForInstant($now)) {
            return response()->json([
                'message' => 'Office check-in is not required today.',
            ], 422);
        }

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
        $configured = (int) Setting::get('office_radius_m', 100);
        $officeRadius = $configured > 0 ? $configured : 100;
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
            $calc = $this->overtime->calculate($now, $now, $tz);
            $checkin = DailyOfficeCheckin::create([
                'user_id' => $user->id,
                'date' => $today,
                'checkin_time' => $now,
                'total_hours' => $calc['total_hours'],
                'standard_hours' => $calc['standard_hours'],
                'extra_hours' => $calc['extra_hours'],
                'is_sunday' => $calc['is_sunday'],
                'is_holiday' => $calc['is_holiday'],
                'holiday_name' => $calc['holiday_name'],
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
            'total_hours' => (float) $checkin->total_hours,
            'standard_hours' => (float) $checkin->standard_hours,
            'extra_hours' => (float) $checkin->extra_hours,
            'is_sunday' => (bool) $checkin->is_sunday,
            'is_holiday' => (bool) $checkin->is_holiday,
            'holiday_name' => $checkin->holiday_name,
            'day_type' => $checkin->is_holiday ? 'holiday' : ($checkin->is_sunday ? 'sunday' : 'normal'),
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

        $checkout = Carbon::now($tz);
        $calc = $this->overtime->calculate($record->checkin_time, $checkout, $tz);
        $record->checkout_time = $checkout;
        $record->total_hours = $calc['total_hours'];
        $record->standard_hours = $calc['standard_hours'];
        $record->extra_hours = $calc['extra_hours'];
        $record->save();

        return response()->json([
            'message' => 'Checked out successfully',
            'checkout_time' => $record->checkout_time->toIso8601String(),
            'total_hours' => (float) $record->total_hours,
            'standard_hours' => (float) $record->standard_hours,
            'extra_hours' => (float) $record->extra_hours,
            'is_sunday' => (bool) $record->is_sunday,
            'is_holiday' => (bool) $record->is_holiday,
            'holiday_name' => $record->holiday_name,
            'day_type' => $record->is_holiday ? 'holiday' : ($record->is_sunday ? 'sunday' : 'normal'),
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

        if (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED, Event::STATUS_DONE_FOR_DAY], true)) {
            return response()->json(['message' => 'Cannot check in to an event that is already ended.'], 422);
        }

        if (! EventAttendanceEligibility::canCheckIn($event)) {
            return response()->json(['message' => 'This event’s scheduled time has already passed. Check-in is no longer available.'], 422);
        }

        $assignment = EventUser::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $pre = $this->eventCrewAttendance->prepareForCheckin($event, $assignment);
        if ($pre !== null) {
            return $pre;
        }
        $assignment->refresh();

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
        $calc = $this->overtime->calculate($now, $now);
        $assignment->update([
            'checkin_time' => $now,
            'total_hours' => $calc['total_hours'],
            'standard_hours' => $calc['standard_hours'],
            'extra_hours' => $calc['extra_hours'],
            'is_sunday' => $calc['is_sunday'],
            'is_holiday' => $calc['is_holiday'],
            'holiday_name' => $calc['holiday_name'],
            'checkin_latitude' => (float) $request->latitude,
            'checkin_longitude' => (float) $request->longitude,
        ]);

        event(new \App\Events\CrewCheckedIn($assignment));

        return response()->json([
            'message' => 'Checked in successfully',
            'checkin_time' => $now->toIso8601String(),
            'total_hours' => $calc['total_hours'],
            'standard_hours' => $calc['standard_hours'],
            'extra_hours' => $calc['extra_hours'],
            'is_sunday' => $calc['is_sunday'],
            'is_holiday' => $calc['is_holiday'],
            'holiday_name' => $calc['holiday_name'],
            'day_type' => $calc['day_type'],
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
        if (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED, Event::STATUS_DONE_FOR_DAY], true)) {
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
        $pausedMinutes = (int) ($assignment->pause_duration ?? 0);
        if ($assignment->is_paused && $assignment->pause_start_time) {
            $pausedMinutes += Carbon::parse($assignment->pause_start_time)->diffInMinutes($checkout);
        }
        $calc = $this->overtime->calculate(Carbon::parse($assignment->checkin_time), $checkout, null, $pausedMinutes);

        if ($this->eventCrewAttendance->isMultiDayEvent($event)) {
            $session = $this->eventCrewAttendance->finalizeCheckoutWithSession(
                $event,
                $assignment,
                $checkout,
                $calc,
                $pausedMinutes
            );
            $assignment->refresh();

            event(new \App\Events\CrewCheckedOut($assignment, $session));

            return response()->json([
                'message' => 'Checked out successfully',
                'checkout_time' => $session->checkout_time->toIso8601String(),
                'work_date' => $session->work_date?->format('Y-m-d') ?? (string) $session->work_date,
                'total_hours' => $session->total_hours,
                'standard_hours' => $session->standard_hours,
                'extra_hours' => $session->extra_hours,
                'is_sunday' => (bool) $session->is_sunday,
                'is_holiday' => (bool) $session->is_holiday,
                'holiday_name' => $session->holiday_name,
                'day_type' => $session->is_holiday ? 'holiday' : ($session->is_sunday ? 'sunday' : 'normal'),
                'pause_duration' => (int) ($session->pause_duration ?? 0),
            ]);
        }

        $assignment->update([
            'checkout_time' => $checkout,
            'total_hours' => $calc['total_hours'],
            'standard_hours' => $calc['standard_hours'],
            'extra_hours' => $calc['extra_hours'],
            'is_paused' => false,
            'pause_start_time' => null,
            'pause_end_time' => $assignment->is_paused ? $checkout : $assignment->pause_end_time,
            'pause_duration' => $pausedMinutes,
        ]);
        $assignment->refresh();

        $this->eventCrewAttendance->updateMealEligibility(
            $event,
            (int) $assignment->user_id,
            Carbon::parse($assignment->checkin_time),
            $checkout,
            $this->eventCrewAttendance->workDateForEventSession($assignment->checkin_time)
        );

        event(new \App\Events\CrewCheckedOut($assignment, null));

        return response()->json([
            'message' => 'Checked out successfully',
            'checkout_time' => $checkout->toIso8601String(),
            'total_hours' => $assignment->total_hours,
            'standard_hours' => $assignment->standard_hours,
            'extra_hours' => $assignment->extra_hours,
            'is_sunday' => (bool) $assignment->is_sunday,
            'is_holiday' => (bool) $assignment->is_holiday,
            'holiday_name' => $assignment->holiday_name,
            'day_type' => $assignment->is_holiday ? 'holiday' : ($assignment->is_sunday ? 'sunday' : 'normal'),
            'pause_duration' => (int) ($assignment->pause_duration ?? 0),
        ]);
    }
}
