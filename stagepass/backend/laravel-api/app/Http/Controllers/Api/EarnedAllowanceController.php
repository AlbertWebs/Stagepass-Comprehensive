<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventAllowance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EarnedAllowanceController extends Controller
{
    private function canManage(Request $request): bool
    {
        $u = $request->user();
        return $u->hasRole('super_admin')
            || $u->hasRole('director')
            || $u->hasRole('admin')
            || $u->hasRole('team_leader')
            || $u->hasRole('teamleader');
    }

    public function typeIndex(Request $request): JsonResponse
    {
        if (! $this->canManage($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return response()->json(['data' => AllowanceType::orderBy('name')->get()]);
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
            ->with(['event:id,name,date,location_name,team_leader_id', 'event.teamLeader:id,name', 'crew:id,name', 'type:id,name', 'recorder:id,name']);

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
                    'paid' => $items->where('status', EventAllowance::STATUS_PAID)->count(),
                ],
                'details' => $items->map(fn ($a) => [
                    'id' => $a->id,
                    'crew_id' => $a->crew_id,
                    'crew_name' => $a->crew?->name,
                    'allowance_type_id' => $a->allowance_type_id,
                    'allowance_type' => $a->type?->name,
                    'amount' => (float) $a->amount,
                    'description' => $a->description,
                    'recorded_by' => $a->recorder?->name,
                    'recorded_at' => $a->recorded_at?->toIso8601String(),
                    'status' => $a->status,
                ])->values()->all(),
            ];
        })->values();

        return response()->json([
            'data' => $grouped,
            'flat' => $rows->items(),
            'pagination' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
            ],
        ]);
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
        ]);

        return response()->json($allowance->load(['event', 'crew', 'type', 'recorder']), 201);
    }

    public function updateStatus(Request $request, EventAllowance $eventAllowance): JsonResponse
    {
        if (! $this->canManage($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'status' => 'required|in:pending,approved,paid',
        ]);
        $status = $validated['status'];
        $eventAllowance->status = $status;
        if ($status === EventAllowance::STATUS_APPROVED) {
            $eventAllowance->approved_by = $request->user()->id;
            $eventAllowance->approved_at = now();
        }
        if ($status === EventAllowance::STATUS_PAID) {
            $eventAllowance->paid_at = now();
        }
        $eventAllowance->save();

        return response()->json($eventAllowance->fresh()->load(['event', 'crew', 'type', 'recorder']));
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
