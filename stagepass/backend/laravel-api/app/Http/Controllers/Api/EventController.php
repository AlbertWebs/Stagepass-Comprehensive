<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventController extends Controller
{
    /**
     * Get the current user's event assigned for today (for crew/leader home).
     * Includes events where the user is in crew OR is the team leader.
     * Uses X-Local-Date (Y-m-d) from the app when present so "today" matches the user's timezone.
     */
    public function myEventToday(Request $request): JsonResponse
    {
        $localDate = $request->header('X-Local-Date');
        $today = $localDate && preg_match('/^\d{4}-\d{2}-\d{2}$/', $localDate)
            ? $localDate
            : now()->toDateString();
        $userId = $request->user()->id;
        $event = Event::query()
            ->with(['teamLeader', 'crew'])
            ->spansDate($today)
            ->where(function ($q) use ($userId) {
                $q->where('team_leader_id', $userId)
                    ->orWhereHas('crew', fn ($q) => $q->where('user_id', $userId));
            })
            ->orderBy('start_time')
            ->first();

        if (! $event) {
            return response()->json(['event' => null]);
        }

        $event->load(['teamLeader', 'crew']);
        return response()->json(['event' => $event]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Event::query()->with(['teamLeader', 'crew', 'client']);

        if ($request->user()->hasRole('super_admin') || $request->user()->hasRole('director')) {
            // admins see all
        } elseif ($request->user()->hasRole('team_leader')) {
            $query->where(function ($q) use ($request) {
                $q->where('team_leader_id', $request->user()->id)
                    ->orWhere('created_by_id', $request->user()->id)
                    ->orWhereHas('crew', fn ($q) => $q->where('user_id', $request->user()->id));
            });
        } else {
            $query->where(function ($q) use ($request) {
                $q->where('created_by_id', $request->user()->id)
                    ->orWhereHas('crew', fn ($q) => $q->where('user_id', $request->user()->id));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $events = $query->orderBy('date', 'desc')->paginate($perPage);

        return response()->json($events);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:date',
            'start_time' => 'required|date_format:H:i',
            'expected_end_time' => 'nullable|date_format:H:i',
            'location_name' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'geofence_radius' => 'nullable|integer|min:50|max:5000',
            'daily_allowance' => 'nullable|numeric|min:0',
            'team_leader_id' => 'nullable|exists:users,id',
            'client_id' => 'nullable|exists:clients,id',
        ]);

        $validated['geofence_radius'] = $validated['geofence_radius'] ?? 100;
        $validated['status'] = Event::STATUS_CREATED;
        $validated['created_by_id'] = $request->user()->id;

        $event = Event::create($validated);

        // So the creator always sees the event in the list (list filters by team_leader or crew)
        $event->crew()->attach($request->user()->id, ['role_in_event' => null]);

        return response()->json($event->load(['teamLeader', 'client']), 201);
    }

    public function show(Event $event): JsonResponse
    {
        $event->load(['teamLeader', 'crew', 'client', 'notes.user', 'eventEquipment.equipment', 'endedBy', 'closedBy']);
        return response()->json($event);
    }

    public function end(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();
        $isTeamLeader = (int) $event->team_leader_id === (int) $user->id;
        $isAdmin = $user->hasRole('super_admin') || $user->hasRole('director');
        if (! $isTeamLeader && ! $isAdmin) {
            return response()->json(['message' => 'Only the team leader or an admin can end this event.'], 403);
        }

        if (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED, Event::STATUS_DONE_FOR_DAY], true)) {
            return response()->json(['message' => 'This event is already ended.'], 422);
        }

        $validated = $request->validate([
            'end_comment' => 'required|string|max:5000',
        ]);

        $event->update([
            'status' => Event::STATUS_COMPLETED,
            'ended_at' => now(),
            'ended_by_id' => $user->id,
            'end_comment' => $validated['end_comment'],
        ]);

        return response()->json($event->fresh()->load(['teamLeader', 'endedBy']));
    }

    public function doneForDay(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();
        $isTeamLeader = (int) $event->team_leader_id === (int) $user->id;
        $isAdmin = $user->hasRole('super_admin') || $user->hasRole('director') || $user->hasRole('admin');
        if (! $isTeamLeader && ! $isAdmin) {
            return response()->json(['message' => 'Only the team leader or an admin can close this event for the day.'], 403);
        }

        if ($event->status === Event::STATUS_DONE_FOR_DAY) {
            return response()->json(['message' => 'This event is already marked done for the day.'], 422);
        }
        if (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED], true)) {
            return response()->json(['message' => 'This event is already ended.'], 422);
        }

        $validated = $request->validate([
            'closing_comment' => 'required|string|max:5000',
        ]);

        // Auto check out closer if still checked in.
        $assignment = $event->eventCrew()->where('user_id', $user->id)->first();
        if ($assignment && $assignment->checkin_time && ! $assignment->checkout_time) {
            $assignment->checkout_time = now();
            $assignment->save();
        }

        $event->update([
            'status' => Event::STATUS_DONE_FOR_DAY,
            'closed_at' => now(),
            'closed_by' => $user->id,
            'closing_comment' => $validated['closing_comment'],
            // keep legacy fields in sync for existing clients
            'ended_at' => now(),
            'ended_by_id' => $user->id,
            'end_comment' => $validated['closing_comment'],
        ]);

        return response()->json($event->fresh()->load(['teamLeader', 'closedBy']));
    }

    public function update(Request $request, Event $event): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'date' => 'sometimes|date',
            'end_date' => 'nullable|date|after_or_equal:date',
            'start_time' => 'sometimes|date_format:H:i',
            'expected_end_time' => 'nullable|date_format:H:i',
            'location_name' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'geofence_radius' => 'nullable|integer|min:50|max:5000',
            'daily_allowance' => 'nullable|numeric|min:0',
            'team_leader_id' => 'nullable|exists:users,id',
            'client_id' => 'nullable|exists:clients,id',
            'status' => 'sometimes|in:created,active,completed,closed,done_for_the_day',
        ]);

        $event->update($validated);

        return response()->json($event->fresh()->load(['teamLeader', 'client']));
    }

    public function destroy(Event $event): JsonResponse
    {
        $event->delete();
        return response()->json(null, 204);
    }
}
