<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventUser;
use App\Models\ReminderLog;
use App\Models\User;
use App\Services\AttendanceOvertimeService;
use Carbon\Carbon;
use App\Notifications\CrewAddedToEventReminder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventCrewController extends Controller
{
    public function __construct(
        private AttendanceOvertimeService $overtime
    ) {}

    private function canManageCrew(Request $request, Event $event): bool
    {
        $user = $request->user();
        if ($user->hasRole('super_admin') || $user->hasRole('director') || $user->hasRole('admin')) {
            return true;
        }
        if ((int) $event->team_leader_id === (int) $user->id) {
            return true;
        }
        // Event not yet assigned a team leader: allow onboarded team_leader role users who created the event or are on crew.
        if ($user->hasRole('team_leader') && blank($event->team_leader_id)) {
            return (int) $event->created_by_id === (int) $user->id
                || $event->crew()->whereKey($user->id)->exists();
        }

        return false;
    }

    public function assignUser(Request $request, Event $event): JsonResponse
    {
        if (! $this->canManageCrew($request, $event)) {
            return response()->json(['message' => 'You cannot add crew to this event.'], 403);
        }

        if (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED, Event::STATUS_DONE_FOR_DAY], true)) {
            return response()->json(['message' => 'Cannot add crew to an event that is already ended.'], 422);
        }

        $request->validate([
            'user_id' => 'required|exists:users,id',
            'role_in_event' => 'nullable|string|max:50',
        ]);

        if ($event->crew()->where('user_id', $request->user_id)->exists()) {
            return response()->json(['message' => 'User is already on the crew.'], 422);
        }

        // User must not be crew on another event that overlaps this event's dates (transfers are allowed via transfer endpoint).
        $otherAssignments = EventUser::where('user_id', $request->user_id)
            ->where('event_id', '!=', $event->id)
            ->with('event')
            ->get();
        foreach ($otherAssignments as $assignment) {
            if ($event->overlapsWith($assignment->event)) {
                return response()->json([
                    'message' => 'This person is already assigned to an event that overlaps these dates. They are not available for a new assignment but can be transferred from that event if needed.',
                ], 422);
            }
        }

        $event->crew()->attach($request->user_id, [
            'role_in_event' => $request->role_in_event,
        ]);

        $assignment = EventUser::where('event_id', $event->id)
            ->where('user_id', $request->user_id)
            ->with('user')
            ->first();

        $user = $assignment->user;
        if ($user) {
            $user->notify(new CrewAddedToEventReminder($event->fresh(), $request->role_in_event));
            ReminderLog::logSent($event->id, $user->id, ReminderLog::TYPE_ADDED, ReminderLog::CHANNEL_EMAIL);
            ReminderLog::logSent($event->id, $user->id, ReminderLog::TYPE_ADDED, ReminderLog::CHANNEL_SMS);
        }

        return response()->json($assignment, 201);
    }

    public function removeUser(Request $request, Event $event, User $user): JsonResponse
    {
        if (! $this->canManageCrew($request, $event)) {
            return response()->json(['message' => 'You cannot remove crew from this event.'], 403);
        }

        $event->crew()->detach($user->id);

        return response()->json(null, 204);
    }

    public function transferUser(Request $request, Event $event): JsonResponse
    {
        if (! $this->canManageCrew($request, $event)) {
            return response()->json(['message' => 'You cannot transfer crew for this event.'], 403);
        }

        if (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED, Event::STATUS_DONE_FOR_DAY], true)) {
            return response()->json(['message' => 'Cannot transfer crew from an event that is already ended.'], 422);
        }

        $request->validate([
            'user_id' => 'required|exists:users,id',
            'target_event_id' => 'required|exists:events,id',
        ]);

        $targetEvent = Event::findOrFail($request->target_event_id);
        if ($targetEvent->id === $event->id) {
            return response()->json(['message' => 'Source and target event must be different.'], 422);
        }
        if (in_array($targetEvent->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED, Event::STATUS_DONE_FOR_DAY], true)) {
            return response()->json(['message' => 'Cannot transfer crew to an event that is already ended.'], 422);
        }

        $assignment = EventUser::where('event_id', $event->id)
            ->where('user_id', $request->user_id)
            ->firstOrFail();

        $roleInEvent = $assignment->role_in_event;
        $transferredUserId = (int) $request->user_id;

        $targetEvent->crew()->attach($transferredUserId, [
            'role_in_event' => $roleInEvent,
        ]);
        $assignment->delete();

        $transferredUser = User::find($transferredUserId);
        if ($transferredUser) {
            $transferredUser->notify(new CrewAddedToEventReminder($targetEvent->fresh(), $roleInEvent));
            ReminderLog::logSent($targetEvent->id, $transferredUser->id, ReminderLog::TYPE_ADDED, ReminderLog::CHANNEL_EMAIL);
            ReminderLog::logSent($targetEvent->id, $transferredUser->id, ReminderLog::TYPE_ADDED, ReminderLog::CHANNEL_SMS);
        }

        return response()->json([
            'message' => 'User transferred successfully',
            'target_event_id' => $targetEvent->id,
        ]);
    }

    /**
     * Team leader (or admin): list crew with check-in status for manage check-in screen.
     */
    public function crewStatus(Request $request, Event $event): JsonResponse
    {
        if (! $this->canManageCrew($request, $event)) {
            return response()->json(['message' => 'You cannot view crew status for this event.'], 403);
        }

        $crew = $event->crew()->get();
        $data = $crew->map(function (User $user) {
            $pivot = $user->pivot;
            $checkinTime = $pivot->checkin_time ?? null;
            $checkoutTime = $pivot->checkout_time ?? null;
            if ($checkoutTime) {
                $status = 'checked_out';
            } elseif ($checkinTime) {
                $status = 'checked_in';
            } else {
                $status = 'pending';
            }
            $checkinFormatted = null;
            if ($checkinTime) {
                $checkinFormatted = $checkinTime instanceof Carbon
                    ? $checkinTime->format('g:i A')
                    : Carbon::parse($checkinTime)->format('g:i A');
            }
            $pausedForMinutes = (int) ($pivot->pause_duration ?? 0);
            if ($pivot->is_paused && $pivot->pause_start_time) {
                $pausedForMinutes += Carbon::parse($pivot->pause_start_time)->diffInMinutes(now());
            }
            return [
                'user_id' => $user->id,
                'name' => $user->name,
                'status' => $status,
                'checkin_time' => $checkinFormatted,
                'total_hours' => (float) ($pivot->total_hours ?? 0),
                'extra_hours' => (float) ($pivot->extra_hours ?? 0),
                'is_sunday' => (bool) ($pivot->is_sunday ?? false),
                'is_holiday' => (bool) ($pivot->is_holiday ?? false),
                'holiday_name' => $pivot->holiday_name ?? null,
                'day_type' => ($pivot->is_holiday ?? false) ? 'holiday' : (($pivot->is_sunday ?? false) ? 'sunday' : 'normal'),
                'is_paused' => (bool) ($pivot->is_paused ?? false),
                'pause_duration' => $pausedForMinutes,
                'pause_reason' => $pivot->pause_reason,
                'transport_type' => $pivot->transport_type,
                'transport_amount' => $pivot->transport_amount !== null ? (float) $pivot->transport_amount : null,
            ];
        })->values()->all();

        return response()->json(['data' => $data]);
    }

    /**
     * Team leader (or admin) marks a crew member as arrived manually when they cannot check in themselves.
     */
    public function manualCheckin(Request $request, Event $event, User $user): JsonResponse
    {
        if (! $this->canManageCrew($request, $event)) {
            return response()->json(['message' => 'You cannot manage attendance for this event.'], 403);
        }

        if (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED, Event::STATUS_DONE_FOR_DAY], true)) {
            return response()->json(['message' => 'Cannot record attendance for an event that is already ended.'], 422);
        }

        $assignment = EventUser::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($assignment->checkin_time) {
            return response()->json([
                'message' => 'Already checked in',
                'checkin_time' => $assignment->checkin_time->toIso8601String(),
            ], 422);
        }

        $now = now();
        $calc = $this->overtime->calculate($now, $now);
        $assignment->update([
            'checkin_time' => $now,
            'total_hours' => $calc['total_hours'],
            'extra_hours' => $calc['extra_hours'],
            'is_sunday' => $calc['is_sunday'],
            'is_holiday' => $calc['is_holiday'],
            'holiday_name' => $calc['holiday_name'],
        ]);

        $assignment->load('user');

        return response()->json([
            'message' => 'Marked as arrived',
            'checkin_time' => $assignment->checkin_time->toIso8601String(),
            'total_hours' => $calc['total_hours'],
            'extra_hours' => $calc['extra_hours'],
            'is_sunday' => $calc['is_sunday'],
            'is_holiday' => $calc['is_holiday'],
            'holiday_name' => $calc['holiday_name'],
            'day_type' => $calc['day_type'],
            'assignment' => $assignment,
        ]);
    }

    public function pauseCrew(Request $request, Event $event, User $user): JsonResponse
    {
        if (! $this->canManageCrew($request, $event)) {
            return response()->json(['message' => 'You cannot pause crew for this event.'], 403);
        }

        $validated = $request->validate([
            'reason' => 'nullable|string|max:255',
        ]);

        $assignment = EventUser::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if (! $assignment->checkin_time || $assignment->checkout_time) {
            return response()->json(['message' => 'Crew member must be actively checked in to pause.'], 422);
        }
        if ($assignment->is_paused) {
            return response()->json(['message' => 'Crew member is already paused.'], 422);
        }

        $assignment->update([
            'is_paused' => true,
            'pause_start_time' => now(),
            'pause_end_time' => null,
            'paused_by' => $request->user()->id,
            'pause_reason' => $validated['reason'] ?? null,
        ]);

        return response()->json([
            'message' => 'Crew paused successfully',
            'assignment' => $assignment->fresh(),
        ]);
    }

    public function resumeCrew(Request $request, Event $event, User $user): JsonResponse
    {
        if (! $this->canManageCrew($request, $event)) {
            return response()->json(['message' => 'You cannot resume crew for this event.'], 403);
        }

        $assignment = EventUser::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if (! $assignment->is_paused || ! $assignment->pause_start_time) {
            return response()->json(['message' => 'Crew member is not paused.'], 422);
        }

        $pauseMinutes = Carbon::parse($assignment->pause_start_time)->diffInMinutes(now());
        $assignment->update([
            'is_paused' => false,
            'pause_end_time' => now(),
            'pause_start_time' => null,
            'pause_duration' => (int) ($assignment->pause_duration ?? 0) + $pauseMinutes,
        ]);

        return response()->json([
            'message' => 'Crew resumed successfully',
            'assignment' => $assignment->fresh(),
        ]);
    }

    public function recordTransport(Request $request, Event $event, User $user): JsonResponse
    {
        if (! $this->canManageCrew($request, $event)) {
            return response()->json(['message' => 'You cannot record transport for this event.'], 403);
        }

        $validated = $request->validate([
            'transport_type' => 'required|in:organization,cab,none',
            'transport_amount' => 'nullable|numeric|min:0',
        ]);

        if ($validated['transport_type'] !== 'cab') {
            $validated['transport_amount'] = null;
        }

        $assignment = EventUser::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $assignment->update([
            'transport_type' => $validated['transport_type'],
            'transport_amount' => $validated['transport_amount'] ?? null,
            'transport_recorded_by' => $request->user()->id,
            'transport_recorded_at' => now(),
        ]);

        return response()->json([
            'message' => 'Transport recorded successfully',
            'assignment' => $assignment->fresh(),
        ]);
    }
}
