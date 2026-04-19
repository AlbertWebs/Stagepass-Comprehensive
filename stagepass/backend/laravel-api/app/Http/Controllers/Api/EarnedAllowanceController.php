<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\User;
use App\Notifications\AllowanceRequestDecisionNotification;
use App\Notifications\AllowanceRequestSubmittedNotification;
use App\Support\EventTeamLeaderGate;
use App\Support\EventTeamLeaderResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EarnedAllowanceController extends Controller
{
    /** @var list<string> */
    private const MANUAL_TYPE_NAMES = ['Taxi', 'Transport', 'Emergency', 'Other'];

    private function canManage(Request $request): bool
    {
        $u = $request->user();

        return $u->hasRole('super_admin')
            || $u->hasRole('director')
            || $u->hasRole('admin')
            || $u->hasRole('team_leader')
            || $u->hasRole('teamleader');
    }

    private function canAccessAllowance(Request $request, EventAllowance $row): bool
    {
        $u = $request->user();
        if ($this->canManage($request)) {
            return true;
        }
        if ((int) $row->crew_id === (int) $u->id) {
            return true;
        }
        $row->loadMissing('event');

        return $row->event && EventTeamLeaderGate::userIsAssignedOrRosterTeamLeader($row->event, $u);
    }

    public function typeIndex(Request $request): JsonResponse
    {
        $query = AllowanceType::query()->where('is_active', true)->orderBy('name');
        if (! $this->canManage($request)) {
            // Match manual labels case-insensitively (DB may use different casing).
            $query->where(function ($q) {
                foreach (self::MANUAL_TYPE_NAMES as $name) {
                    $q->orWhereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower($name)]);
                }
            });
        }

        return response()->json(['data' => $query->get()]);
    }

    public function typeStore(Request $request): JsonResponse
    {
        if (! $this->canManage($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:allowance_types,name',
            'is_active' => 'nullable|boolean',
        ]);

        return response()->json(AllowanceType::create([
            'name' => $validated['name'],
            'is_active' => $validated['is_active'] ?? true,
        ]), 201);
    }

    public function typeUpdate(Request $request, AllowanceType $allowanceType): JsonResponse
    {
        if (! $this->canManage($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100|unique:allowance_types,name,' . $allowanceType->id,
            'is_active' => 'sometimes|boolean',
        ]);
        $allowanceType->update($validated);

        return response()->json($allowanceType->fresh());
    }

    public function index(Request $request): JsonResponse
    {
        $canManage = $this->canManage($request);

        $query = EventAllowance::query()
            ->with([
                'event:id,name,date,location_name,team_leader_id',
                'event.teamLeader:id,name',
                'crew:id,name',
                'type:id,name',
                'recorder:id,name',
                'approver:id,name',
                'rejector:id,name',
            ]);

        if (! $canManage) {
            $query->where('crew_id', (int) $request->user()->id);
        }

        if ($request->filled('event_id')) {
            $query->where('event_id', (int) $request->event_id);
        }
        if ($request->filled('crew_id')) {
            $query->where('crew_id', (int) $request->crew_id);
        }
        if ($request->filled('allowance_type_id')) {
            $query->where('allowance_type_id', (int) $request->allowance_type_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('team_leader_id')) {
            $query->whereHas('event', fn ($q) => $q->where('team_leader_id', (int) $request->team_leader_id));
        }
        if ($request->filled('date_from')) {
            $query->whereDate('recorded_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('recorded_at', '<=', $request->date_to);
        }
        if ($request->filled('search')) {
            $s = '%' . trim((string) $request->search) . '%';
            $query->where(function ($q) use ($s) {
                $q->whereHas('event', fn ($eq) => $eq->where('name', 'like', $s))
                    ->orWhereHas('crew', fn ($uq) => $uq->where('name', 'like', $s))
                    ->orWhereHas('type', fn ($tq) => $tq->where('name', 'like', $s));
            });
        }

        $perPage = min((int) $request->input('per_page', 25), 100);
        $rows = $query->orderByDesc('recorded_at')->paginate($perPage);

        $grouped = collect($rows->items())->groupBy('event_id')->map(function ($items, $eventId) {
            $event = $items->first()->event;

            return [
                'event_id' => (int) $eventId,
                'event_name' => $event?->name,
                'event_date' => $event?->date?->format('Y-m-d'),
                'location' => $event?->location_name,
                'team_lead' => $event?->teamLeader?->name,
                'crew_count' => $items->pluck('crew_id')->unique()->count(),
                'total_allowances' => round($items->sum(fn ($a) => (float) $a->amount), 2),
                'status_breakdown' => [
                    'pending' => $items->where('status', EventAllowance::STATUS_PENDING)->count(),
                    'approved' => $items->where('status', EventAllowance::STATUS_APPROVED)->count(),
                    'rejected' => $items->where('status', EventAllowance::STATUS_REJECTED)->count(),
                    'paid' => $items->where('status', EventAllowance::STATUS_PAID)->count(),
                ],
                'details' => $items->map(fn ($a) => $this->serializeDetail($a))->values()->all(),
            ];
        })->values();

        return response()->json([
            'data' => $grouped,
            'flat' => array_map(fn ($a) => $this->serializeDetail($a), $rows->items()),
            'pagination' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    private function serializeDetail(EventAllowance $a): array
    {
        return [
            'id' => $a->id,
            'event_id' => $a->event_id,
            'event_name' => $a->event?->name,
            'crew_id' => $a->crew_id,
            'crew_name' => $a->crew?->name,
            'allowance_type_id' => $a->allowance_type_id,
            'allowance_type' => $a->type?->name,
            'amount' => (float) $a->amount,
            'description' => $a->description,
            'recorded_by' => $a->recorder?->name,
            'recorded_at' => $a->recorded_at?->toIso8601String(),
            'status' => $a->status,
            'source' => $a->source ?? EventAllowance::SOURCE_MANUAL,
            'attachment_url' => $a->attachment_public_url,
            'rejection_comment' => $a->rejection_comment,
            'approval_comment' => $a->approval_comment,
            'approved_by' => $a->approver?->name,
            'approved_at' => $a->approved_at?->toIso8601String(),
            'rejected_by' => $a->rejector?->name,
            'rejected_at' => $a->rejected_at?->toIso8601String(),
            'meal_slot' => $a->meal_slot,
            'meal_grant_date' => $a->meal_grant_date?->format('Y-m-d'),
        ];
    }

    /**
     * Crew: submit a manual allowance request with receipt image.
     */
    public function crewRequest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_id' => 'required|exists:events,id',
            'allowance_type_id' => 'required|exists:allowance_types,id',
            'amount' => 'required|numeric|min:0.01',
            'reason' => 'required|string|max:1000',
            'attachment' => 'required|file|mimes:jpeg,jpg,png|max:10240',
        ]);

        $user = $request->user();
        $event = Event::findOrFail((int) $validated['event_id']);

        if (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED, Event::STATUS_DONE_FOR_DAY], true)) {
            return response()->json(['message' => 'This event is no longer active.'], 422);
        }

        if (! $event->crew()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'You are not assigned to this event.'], 403);
        }

        $type = AllowanceType::findOrFail((int) $validated['allowance_type_id']);
        $typeNorm = mb_strtolower(trim((string) $type->name));
        $allowed = array_map(fn (string $n) => mb_strtolower($n), self::MANUAL_TYPE_NAMES);
        if (! in_array($typeNorm, $allowed, true)) {
            return response()->json(['message' => 'Invalid allowance type for a manual request.'], 422);
        }

        $path = $request->file('attachment')->store('allowance-receipts', 'public');

        $allowance = EventAllowance::create([
            'event_id' => $event->id,
            'crew_id' => $user->id,
            'allowance_type_id' => $type->id,
            'amount' => $validated['amount'],
            'description' => $validated['reason'],
            'recorded_by' => $user->id,
            'recorded_at' => now(),
            'status' => EventAllowance::STATUS_PENDING,
            'source' => EventAllowance::SOURCE_MANUAL,
            'attachment_path' => $path,
        ]);

        $allowance->load(['event', 'crew', 'type', 'recorder']);

        $leader = EventTeamLeaderResolver::resolve($event);
        if ($leader) {
            $leader->notify(new AllowanceRequestSubmittedNotification($allowance->fresh()));
        }

        return response()->json([
            'message' => 'Allowance request submitted successfully. Waiting for team leader approval.',
            'data' => $this->serializeDetail($allowance->fresh()->load(['crew', 'type', 'recorder', 'approver', 'rejector', 'event'])),
        ], 201);
    }

    /**
     * Download receipt image (auth: crew, team leader for event, or admin).
     */
    public function attachment(Request $request, EventAllowance $eventAllowance): JsonResponse|StreamedResponse
    {
        if (! $this->canAccessAllowance($request, $eventAllowance)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if (! $eventAllowance->attachment_path || ! Storage::disk('public')->exists($eventAllowance->attachment_path)) {
            return response()->json(['message' => 'Attachment not found.'], 404);
        }

        return Storage::disk('public')->response($eventAllowance->attachment_path);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->canManage($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'event_id' => 'required|exists:events,id',
            'crew_id' => 'required|exists:users,id',
            'allowance_type_id' => 'required|exists:allowance_types,id',
            'amount' => 'required|numeric|min:0',
            'description' => 'nullable|string|max:1000',
            'recorded_at' => 'nullable|date',
        ]);

        $event = Event::findOrFail((int) $validated['event_id']);
        if (! $event->crew()->where('user_id', (int) $validated['crew_id'])->exists()) {
            return response()->json(['message' => 'Crew member must belong to selected event.'], 422);
        }

        $allowance = EventAllowance::create([
            ...$validated,
            'recorded_by' => $request->user()->id,
            'recorded_at' => $validated['recorded_at'] ?? now(),
            'status' => EventAllowance::STATUS_PENDING,
            'source' => EventAllowance::SOURCE_MANUAL,
        ]);

        return response()->json($allowance->load(['event', 'crew', 'type', 'recorder']), 201);
    }

    public function updateStatus(Request $request, EventAllowance $eventAllowance): JsonResponse
    {
        if (! $this->canAccessAllowance($request, $eventAllowance)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'status' => 'required|in:pending,approved,rejected,paid',
            'comment' => 'nullable|string|max:2000',
        ]);
        $status = $validated['status'];
        $comment = isset($validated['comment']) ? trim((string) $validated['comment']) : '';

        if ($status === EventAllowance::STATUS_REJECTED && $comment === '') {
            return response()->json(['message' => 'A comment is required to reject an allowance request.'], 422);
        }

        if ($eventAllowance->source === EventAllowance::SOURCE_AUTOMATIC && $status === EventAllowance::STATUS_REJECTED) {
            return response()->json(['message' => 'Automatic allowances cannot be rejected via this action.'], 422);
        }

        $eventAllowance->status = $status;

        if ($status === EventAllowance::STATUS_APPROVED) {
            $eventAllowance->approved_by = $request->user()->id;
            $eventAllowance->approved_at = now();
            $eventAllowance->approval_comment = $comment !== '' ? $comment : null;
            $eventAllowance->rejection_comment = null;
            $eventAllowance->rejected_by = null;
            $eventAllowance->rejected_at = null;
        } elseif ($status === EventAllowance::STATUS_REJECTED) {
            $eventAllowance->rejection_comment = $comment;
            $eventAllowance->rejected_by = $request->user()->id;
            $eventAllowance->rejected_at = now();
            $eventAllowance->approval_comment = null;
        } elseif ($status === EventAllowance::STATUS_PAID) {
            $eventAllowance->paid_at = now();
        }

        $eventAllowance->save();

        $fresh = $eventAllowance->fresh()->load(['event', 'crew', 'type', 'recorder', 'approver', 'rejector']);

        if ($eventAllowance->source === EventAllowance::SOURCE_MANUAL && in_array($status, [EventAllowance::STATUS_APPROVED, EventAllowance::STATUS_REJECTED], true)) {
            $crew = User::find($eventAllowance->crew_id);
            if ($crew) {
                $crew->notify(new AllowanceRequestDecisionNotification($fresh, $status === EventAllowance::STATUS_APPROVED));
            }
        }

        return response()->json($this->serializeDetail($fresh));
    }

    public function export(Request $request)
    {
        if (! $this->canManage($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $rows = EventAllowance::query()
            ->with(['event:id,name,date', 'crew:id,name', 'type:id,name'])
            ->orderByDesc('recorded_at')
            ->limit(5000)
            ->get();

        $format = strtolower((string) $request->input('format', 'csv'));
        $csv = "Event,Date,Crew,Allowance Type,Amount,Status,Recorded At\n";
        foreach ($rows as $r) {
            $csv .= '"' . str_replace('"', '""', (string) ($r->event?->name ?? '')) . '",'
                . '"' . ($r->event?->date?->format('Y-m-d') ?? '') . '",'
                . '"' . str_replace('"', '""', (string) ($r->crew?->name ?? '')) . '",'
                . '"' . str_replace('"', '""', (string) ($r->type?->name ?? '')) . '",'
                . '"' . (float) $r->amount . '",'
                . '"' . $r->status . '",'
                . '"' . ($r->recorded_at?->format('Y-m-d H:i:s') ?? '') . '"' . "\n";
        }

        $filename = 'earned-allowances-' . now()->format('Ymd-His') . '.' . ($format === 'excel' ? 'csv' : $format);

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }
}
