<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventMeal;
use App\Models\EventUser;
use App\Services\GeofenceService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function __construct(
        private GeofenceService $geofence
    ) {}

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

        $this->updateMealEligibility($assignment, $checkout);

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
