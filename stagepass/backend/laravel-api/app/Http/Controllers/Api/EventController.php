<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\EventUser;
use App\Models\User;
use App\Notifications\TeamLeaderAssignedNotification;
use App\Services\AttendanceOvertimeService;
use App\Services\EventCrewAttendanceService;
use App\Support\ApiDateTime;
use App\Support\EventAttendanceEligibility;
use App\Services\EventDateAdjustmentService;
use App\Support\EventTeamLeaderGate;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventController extends Controller
{
    public function __construct(
        private AttendanceOvertimeService $overtime,
        private EventCrewAttendanceService $eventCrewAttendance,
        private EventDateAdjustmentService $dateAdjustment
    ) {}
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
        $assignments = EventUser::where('event_id', $event->id)->get()->keyBy('user_id');
        $data = $event->toArray();
        ApiDateTime::normalizeEventCrewPivotTimes($data, $assignments);

        return response()->json(['event' => $data]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Event::query()->with(['teamLeader', 'crew', 'client']);

        if (
            $request->user()->hasRole('super_admin')
            || $request->user()->hasRole('director')
            || $request->user()->hasRole('admin')
        ) {
            // full-admin roles see all events
        } elseif ($request->user()->hasRole('team_leader')) {
            $query->where(function ($q) use ($request) {
                $q->where('team_leader_id', $request->user()->id)
                    ->orWhere('created_by_id', $request->user()->id)
                    ->orWhereHas('crew', fn ($q) => $q->where('user_id', $request->user()->id));
            });
        } else {
            $query->where(function ($q) use ($request) {
                $q->where('created_by_id', $request->user()->id)
                    ->orWhere('team_leader_id', $request->user()->id)
                    ->orWhereHas('crew', fn ($q) => $q->where('user_id', $request->user()->id));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $localDate = $request->header('X-Local-Date');
        $today = $localDate && preg_match('/^\d{4}-\d{2}-\d{2}$/', $localDate)
            ? $localDate
            : now()->toDateString();

        if ($request->filled('on_date') && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $request->input('on_date'))) {
            $query->spansDate((string) $request->input('on_date'));
        }

        if ($request->filled('exclude_spanning_date') && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $request->input('exclude_spanning_date'))) {
            $d = (string) $request->input('exclude_spanning_date');
            $query->where(function ($q) use ($d) {
                $q->whereDate('date', '>', $d)
                    ->orWhereRaw('COALESCE(end_date, date) < ?', [$d]);
            });
        }

        if ($request->boolean('activities_view')) {
            $query->orderByRaw('CASE WHEN COALESCE(end_date, date) >= ? THEN 0 ELSE 1 END', [$today]);
            $query->orderByRaw('CASE WHEN COALESCE(end_date, date) >= ? THEN date END ASC', [$today]);
            $query->orderByRaw('CASE WHEN COALESCE(end_date, date) < ? THEN date END DESC', [$today]);
            $query->orderBy('start_time');
        } else {
            $query->orderBy('date', 'desc');
        }

        $defaultPerPage = $request->boolean('activities_view') ? 5 : 20;
        $perPage = min((int) $request->input('per_page', $defaultPerPage), 100);
        $events = $query->paginate($perPage);

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
            'per_diem_enabled' => 'nullable|boolean',
            'team_leader_id' => 'nullable|exists:users,id',
            'client_id' => 'nullable|exists:clients,id',
        ]);

        $validated['geofence_radius'] = $validated['geofence_radius'] ?? 100;
        $validated['per_diem_enabled'] = (bool) ($validated['per_diem_enabled'] ?? false);
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
        $assignments = EventUser::where('event_id', $event->id)->get()->keyBy('user_id');
        $data = $event->toArray();
        if (isset($data['crew']) && is_array($data['crew'])) {
            foreach ($data['crew'] as &$member) {
                $uid = isset($member['id']) ? (int) $member['id'] : null;
                if ($uid !== null && isset($assignments[$uid])) {
                    $snap = $this->overtime->snapshotForEventAssignment($assignments[$uid]);
                    if (! isset($member['pivot']) || ! is_array($member['pivot'])) {
                        $member['pivot'] = [];
                    }
                    $member['pivot']['standard_hours'] = $snap['standard_hours'];
                    $member['pivot']['hours_status'] = $snap['hours_status'];
                }
            }
            unset($member);
        }
        ApiDateTime::normalizeEventCrewPivotTimes($data, $assignments);

        return response()->json($data);
    }

    public function end(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();
        $isTeamLeader = EventTeamLeaderGate::userIsAssignedOrRosterTeamLeader($event, $user);
        $isAdmin = $user->hasRole('super_admin') || $user->hasRole('director') || $user->hasRole('admin');
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
        $isTeamLeader = EventTeamLeaderGate::userIsAssignedOrRosterTeamLeader($event, $user);
        $isAdmin = $user->hasRole('super_admin') || $user->hasRole('director') || $user->hasRole('admin');
        if (! $isTeamLeader && ! $isAdmin) {
            return response()->json(['message' => 'Only the team leader or an admin can close this event for the day.'], 403);
        }

        if (EventAttendanceEligibility::isPermanentlyEnded($event)) {
            return response()->json(['message' => 'This event is already ended.'], 422);
        }

        if ($event->status === Event::STATUS_DONE_FOR_DAY) {
            $tz = EventAttendanceEligibility::tz();
            $today = Carbon::now($tz)->toDateString();
            $closedDay = $event->closed_at?->timezone($tz)->toDateString();
            if ($closedDay === $today) {
                return response()->json(['message' => 'This event is already marked done for the day.'], 422);
            }
        } elseif (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED], true)) {
            return response()->json(['message' => 'This event is already ended.'], 422);
        }

        $validated = $request->validate([
            'closing_comment' => 'required|string|max:5000',
        ]);

        $checkout = now();
        $crewCheckedOut = 0;
        $openAssignments = $event->eventCrew()
            ->whereNotNull('checkin_time')
            ->whereNull('checkout_time')
            ->get();

        foreach ($openAssignments as $assignment) {
            if ($this->eventCrewAttendance->checkoutOpenAssignment($event, $assignment, $checkout)) {
                $crewCheckedOut++;
            }
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

        $fresh = $event->fresh()->load(['teamLeader', 'closedBy']);

        return response()->json(array_merge($fresh->toArray(), [
            'crew_checked_out' => $crewCheckedOut,
        ]));
    }

    public function update(Request $request, Event $event): JsonResponse
    {
        if (! EventTeamLeaderGate::userCanManageEvent($event, $request->user())) {
            return response()->json(['message' => 'You cannot update this event.'], 403);
        }

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
            'per_diem_enabled' => 'nullable|boolean',
            'team_leader_id' => 'nullable|exists:users,id',
            'client_id' => 'nullable|exists:clients,id',
            'status' => 'sometimes|in:created,active,completed,closed,done_for_the_day',
        ]);

        $previousTeamLeaderId = $event->team_leader_id;

        $previous = [
            'date' => $event->date->format('Y-m-d'),
            'end_date' => $event->end_date?->format('Y-m-d'),
            'start_time' => $event->start_time,
            'expected_end_time' => $event->expected_end_time,
        ];

        $dateFieldsChanging = collect(['date', 'end_date', 'start_time', 'expected_end_time'])
            ->contains(fn (string $key) => array_key_exists($key, $validated));

        if ($dateFieldsChanging) {
            $hasAttendanceData = EventUser::query()
                ->where('event_id', $event->id)
                ->whereNotNull('checkin_time')
                ->exists()
                || EventAllowance::query()->where('event_id', $event->id)->exists();

            if ($hasAttendanceData && ! $request->boolean('confirm_date_adjustment')) {
                return response()->json([
                    'message' => 'Changing dates will recalculate attendance and allowance dates.',
                    'requires_date_adjustment_confirmation' => true,
                ], 422);
            }
        }

        $event->update($validated);

        $adjustmentSummary = null;
        if ($dateFieldsChanging) {
            $adjustmentSummary = $this->dateAdjustment->adjust($event->fresh(), $previous);
        }

        if (array_key_exists('team_leader_id', $validated)) {
            $event->refresh();
            $newTeamLeaderId = $event->team_leader_id;
            if ($newTeamLeaderId !== null) {
                $previous = $previousTeamLeaderId === null ? null : (int) $previousTeamLeaderId;
                $next = (int) $newTeamLeaderId;
                if ($previous !== $next) {
                    $assignee = User::query()->find($newTeamLeaderId);
                    if ($assignee) {
                        $assignee->notify(new TeamLeaderAssignedNotification($event));
                    }
                }
            }
        }

        return response()->json(array_merge(
            $event->fresh()->load(['teamLeader', 'client'])->toArray(),
            $adjustmentSummary !== null ? ['date_adjustment' => $adjustmentSummary] : []
        ));
    }

    public function destroy(Request $request, Event $event): JsonResponse
    {
        $user = $request->user();
        $isAdmin = $user->hasRole('super_admin') || $user->hasRole('director') || $user->hasRole('admin');
        if (! $isAdmin) {
            return response()->json(['message' => 'Only an admin can delete events. Use the web admin portal.'], 403);
        }

        $event->delete();

        return response()->json(null, 204);
    }
}
