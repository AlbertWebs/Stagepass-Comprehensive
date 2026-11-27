<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AllowanceType;
use App\Models\B2cPayout;
use App\Models\B2cPayoutItem;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\User;
use App\Notifications\AllowanceRequestDecisionNotification;
use App\Notifications\WorkflowPushNotification;
use App\Notifications\AllowanceRequestSubmittedNotification;
use App\Services\MpesaB2cService;
use App\Services\AuditTrail;
use App\Support\EventTeamLeaderGate;
use App\Support\EventTeamLeaderResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EarnedAllowanceController extends Controller
{
    /** Reserved for automatic meal credits — not offered for manual receipt requests. */
    private const AUTOMATIC_MEAL_TYPE_NAMES = ['Breakfast', 'Lunch', 'Dinner'];

    private function hasPanelPermission(Request $request, array $permissions): bool
    {
        $user = $request->user();
        if (! $user || ! $user->is_active || ! in_array('admin-panel', $user->currentAccessToken()?->abilities ?? [], true)) {
            return false;
        }

        return $user->hasSuperAdminAccess() || collect($permissions)->contains(fn (string $permission) => $user->hasPermission($permission));
    }

    private function canManage(Request $request): bool
    {
        $u = $request->user();

        if (in_array('admin-panel', $u->currentAccessToken()?->abilities ?? [], true)) {
            return $this->hasPanelPermission($request, ['allowances.view', 'allowances.approve', 'payments.process']);
        }

        return $u->hasSuperAdminAccess()
            || $u->hasRole('team_leader')
            || $u->hasRole('teamleader');
    }

    /**
     * Crew users normally only see their own earned-allowance rows on index.
     * Event team leaders (assigned ID or roster pivot) must see all rows for that event when approving.
     */
    private function shouldRestrictEarnedAllowanceIndexToOwnCrew(Request $request): bool
    {
        if ($this->canManage($request)) {
            return false;
        }
        if (! $request->filled('event_id')) {
            return true;
        }
        $event = Event::query()->find((int) $request->event_id);
        if (! $event) {
            return true;
        }

        return ! EventTeamLeaderGate::userIsAssignedOrRosterTeamLeader($event, $request->user());
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
            // Crew: show every active admin-defined type except automatic meal slots.
            $query->where(function ($q) {
                foreach (self::AUTOMATIC_MEAL_TYPE_NAMES as $name) {
                    $q->whereRaw('LOWER(TRIM(name)) != ?', [mb_strtolower($name)]);
                }
            });
        }

        return response()->json(['data' => $query->get()]);
    }

    public function typeStore(Request $request): JsonResponse
    {
        $isPanel = in_array('admin-panel', $request->user()?->currentAccessToken()?->abilities ?? [], true);
        if (($isPanel && ! $this->hasPanelPermission($request, ['settings.manage']))
            || (! $isPanel && ! $request->user()->hasSuperAdminAccess())) {
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
        $isPanel = in_array('admin-panel', $request->user()?->currentAccessToken()?->abilities ?? [], true);
        if (($isPanel && ! $this->hasPanelPermission($request, ['settings.manage']))
            || (! $isPanel && ! $request->user()->hasSuperAdminAccess())) {
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
        $query = EventAllowance::query()
            ->with([
                'event:id,name,date,location_name,team_leader_id',
                'event.teamLeader:id,name',
                'crew:id,name',
                'type:id,name',
                'recorder:id,name',
                'approver:id,name',
                'rejector:id,name',
                'verifier:id,name',
            ]);

        if ($this->shouldRestrictEarnedAllowanceIndexToOwnCrew($request)) {
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
        if ($request->input('verification_status') === 'pending') {
            $query->whereNull('hr_verified_at')->where('status', EventAllowance::STATUS_PENDING);
        } elseif ($request->input('verification_status') === 'verified') {
            $query->whereNotNull('hr_verified_at');
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

        $perPage = $request->filled('event_id')
            ? min((int) $request->input('per_page', 25), 500)
            : min((int) $request->input('per_page', 25), 100);
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
            'hr_verified' => $a->hr_verified_at !== null,
            'hr_verified_by' => $a->verifier?->name,
            'hr_verified_at' => $a->hr_verified_at?->toIso8601String(),
            'hr_verification_note' => $a->hr_verification_note,
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

        if (in_array($event->status, [Event::STATUS_COMPLETED, Event::STATUS_CLOSED], true)) {
            return response()->json(['message' => 'This event is no longer active.'], 422);
        }

        if (! $event->crew()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'You are not assigned to this event.'], 403);
        }

        $type = AllowanceType::findOrFail((int) $validated['allowance_type_id']);
        if (! $type->is_active) {
            return response()->json(['message' => 'This allowance type is not available.'], 422);
        }
        $typeNorm = mb_strtolower(trim((string) $type->name));
        $blocked = array_map(fn (string $n) => mb_strtolower($n), self::AUTOMATIC_MEAL_TYPE_NAMES);
        if (in_array($typeNorm, $blocked, true)) {
            return response()->json(['message' => 'This allowance type is reserved for automatic meal credits.'], 422);
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
        app(AuditTrail::class)->record($request, 'allowance.created', $allowance, [], [
            'event_id' => $allowance->event_id, 'crew_id' => $allowance->crew_id,
            'allowance_type_id' => $allowance->allowance_type_id, 'amount' => (float) $allowance->amount,
            'status' => $allowance->status, 'source' => $allowance->source,
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
        $isPanel = in_array('admin-panel', $request->user()?->currentAccessToken()?->abilities ?? [], true);
        $canCreate = $isPanel
            ? $this->hasPanelPermission($request, ['allowances.create'])
            : $this->canManage($request);
        if (! $canCreate) {
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
        if (! EventTeamLeaderGate::userCanManageEvent($event, $request->user())) {
            return response()->json(['message' => 'You cannot allocate allowances for this event.'], 403);
        }
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
        $isPanel = in_array('admin-panel', $request->user()?->currentAccessToken()?->abilities ?? [], true);
        $requestedStatus = (string) $request->input('status', '');
        if ($isPanel) {
            $allowed = $requestedStatus === EventAllowance::STATUS_PAID
                ? $this->hasPanelPermission($request, ['payments.process'])
                : $this->hasPanelPermission($request, ['allowances.approve', 'payments.approve']);
        } else {
            $user = $request->user();
            $eventLead = $eventAllowance->event && EventTeamLeaderGate::userCanManageEvent($eventAllowance->event, $user);
            $allowed = $user->hasSuperAdminAccess()
                || $user->hasRole('accounts')
                || ($requestedStatus !== EventAllowance::STATUS_PAID && (bool) $eventLead);
        }
        if (! $allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'status' => 'required|in:pending,approved,rejected,paid',
            'comment' => 'nullable|string|max:2000',
        ]);
        $status = $validated['status'];
        $comment = isset($validated['comment']) ? trim((string) $validated['comment']) : '';

        $user = $request->user();
        $allowanceEvent = $eventAllowance->event;
        $isEventTeamLeader = $allowanceEvent
            && EventTeamLeaderGate::userCanManageEvent($allowanceEvent, $user);
        $teamLeaderDecisionBeforeHr = $isEventTeamLeader
            && $eventAllowance->source === EventAllowance::SOURCE_MANUAL
            && in_array($status, [EventAllowance::STATUS_APPROVED, EventAllowance::STATUS_REJECTED], true);

        if (! $user->hasSuperAdminAccess()
            && in_array($status, [EventAllowance::STATUS_APPROVED, EventAllowance::STATUS_PAID], true)
            && ! $eventAllowance->hr_verified_at
            && ! $teamLeaderDecisionBeforeHr) {
            return response()->json(['message' => 'HR must verify this allowance before Accounts can approve or pay it.'], 422);
        }

        if ($status === EventAllowance::STATUS_REJECTED && $comment === '') {
            return response()->json(['message' => 'A comment is required to reject an allowance request.'], 422);
        }

        if ($eventAllowance->source === EventAllowance::SOURCE_AUTOMATIC && $status === EventAllowance::STATUS_REJECTED) {
            return response()->json(['message' => 'Automatic allowances cannot be rejected via this action.'], 422);
        }

        $before = ['status' => $eventAllowance->status, 'amount' => (float) $eventAllowance->amount, 'paid_at' => $eventAllowance->paid_at?->toISOString()];
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
        app(AuditTrail::class)->record($request, 'allowance.status_changed', $eventAllowance, $before, [
            'status' => $eventAllowance->status, 'amount' => (float) $eventAllowance->amount,
            'paid_at' => $eventAllowance->paid_at?->toISOString(),
        ]);

        $fresh = $eventAllowance->fresh()->load(['event', 'crew', 'type', 'recorder', 'approver', 'rejector']);

        if ($eventAllowance->source === EventAllowance::SOURCE_MANUAL && in_array($status, [EventAllowance::STATUS_APPROVED, EventAllowance::STATUS_REJECTED], true)) {
            $crew = User::find($eventAllowance->crew_id);
            if ($crew) {
                $crew->notify(new AllowanceRequestDecisionNotification($fresh, $status === EventAllowance::STATUS_APPROVED));
            }
        }
        if ($status === EventAllowance::STATUS_PAID) {
            $crew = User::find($eventAllowance->crew_id);
            $crew?->notify(new WorkflowPushNotification(
                'Allowance paid',
                'Your allowance for ' . ($fresh->event?->name ?? 'an event') . ' has been marked as paid.',
                'allowance_paid',
                ['allowance_id' => (string) $fresh->id, 'event_id' => (string) $fresh->event_id]
            ));
        }

        return response()->json($this->serializeDetail($fresh));
    }

    public function verify(Request $request, EventAllowance $eventAllowance): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'allowances.verify')) return $denial;

        $validated = $request->validate([
            'verified' => 'required|boolean',
            'note' => 'nullable|string|max:2000',
        ]);
        $canVerifyAfterTeamLeaderApproval = $eventAllowance->source === EventAllowance::SOURCE_MANUAL
            && $eventAllowance->status === EventAllowance::STATUS_APPROVED;
        $canVerifyAutomaticAllowance = $eventAllowance->source === EventAllowance::SOURCE_AUTOMATIC
            && $eventAllowance->status === EventAllowance::STATUS_PENDING;
        if (! $canVerifyAfterTeamLeaderApproval && ! $canVerifyAutomaticAllowance) {
            return response()->json(['message' => 'Only team-leader-approved requests or pending automatic allowances can be HR verified.'], 422);
        }

        $before = [
            'hr_verified_by' => $eventAllowance->hr_verified_by,
            'hr_verified_at' => $eventAllowance->hr_verified_at?->toISOString(),
            'hr_verification_note' => $eventAllowance->hr_verification_note,
        ];
        $eventAllowance->hr_verified_by = $validated['verified'] ? $request->user()->id : null;
        $eventAllowance->hr_verified_at = $validated['verified'] ? now() : null;
        $eventAllowance->hr_verification_note = $validated['verified'] ? (isset($validated['note']) ? trim($validated['note']) : null) : null;
        $eventAllowance->save();

        app(AuditTrail::class)->record($request, $validated['verified'] ? 'allowance.hr_verified' : 'allowance.hr_verification_cleared', $eventAllowance, $before, [
            'hr_verified_by' => $eventAllowance->hr_verified_by,
            'hr_verified_at' => $eventAllowance->hr_verified_at?->toISOString(),
            'hr_verification_note' => $eventAllowance->hr_verification_note,
        ]);

        return response()->json($this->serializeDetail($eventAllowance->fresh()->load(['event', 'crew', 'type', 'recorder', 'approver', 'rejector', 'verifier'])));
    }

    public function export(Request $request)
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'allowances.export', ['accounts'])) {
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

    /**
     * Preview approved (unpaid) allowances grouped by crew for M-Pesa B2C disbursement.
     */
    public function b2cPreview(Request $request, MpesaB2cService $mpesa): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'payments.process', ['accounts'])) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'event_id' => 'nullable|exists:events,id',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        $allowances = $this->approvedUnpaidQuery($validated, ! $request->user()->hasSuperAdminAccess())->get();
        $payments = $mpesa->buildPayoutPreview($allowances);
        $eligible = array_values(array_filter($payments, fn ($p) => $p['phone_ok'] && $p['amount'] > 0));
        $blocked = array_values(array_filter($payments, fn ($p) => ! $p['phone_ok'] || $p['amount'] <= 0));

        return response()->json([
            'dry_run' => $mpesa->isDryRun(),
            'configured' => $mpesa->isConfigured(),
            'total_amount' => round(array_sum(array_column($eligible, 'amount')), 2),
            'payment_count' => count($eligible),
            'blocked_count' => count($blocked),
            'payments' => $payments,
            'eligible' => $eligible,
            'blocked' => $blocked,
        ]);
    }

    /**
     * Process selected approved allowances via M-Pesa B2C (or dry-run when configured).
     */
    public function b2cProcess(Request $request, MpesaB2cService $mpesa): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'payments.process', ['accounts'])) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'event_id' => 'nullable|exists:events,id',
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'integer|exists:users,id',
            'allowance_ids' => 'nullable|array',
            'allowance_ids.*' => 'integer|exists:event_allowances,id',
        ]);

        if (! $mpesa->isDryRun() && ! $mpesa->isConfigured()) {
            return response()->json([
                'message' => 'M-Pesa B2C is not configured. Set MPESA_* credentials or enable MPESA_B2C_DRY_RUN.',
            ], 422);
        }

        $allowances = $this->approvedUnpaidQuery($validated, ! $request->user()->hasSuperAdminAccess())->get();
        if ($allowances->isEmpty()) {
            return response()->json(['message' => 'No approved unpaid allowances match the selection.'], 422);
        }

        $preview = $mpesa->buildPayoutPreview($allowances);
        $selectedUserIds = array_map('intval', $validated['user_ids']);
        $toPay = array_values(array_filter(
            $preview,
            fn ($p) => in_array((int) $p['user_id'], $selectedUserIds, true) && $p['phone_ok'] && $p['amount'] > 0
        ));

        if ($toPay === []) {
            return response()->json([
                'message' => 'No payable lines selected. Ensure each crew member has a valid phone and approved amount.',
            ], 422);
        }

        $payout = DB::transaction(function () use ($request, $toPay, $validated, $mpesa) {
            $total = round(array_sum(array_column($toPay, 'amount')), 2);
            $payout = B2cPayout::create([
                'initiated_by' => $request->user()->id,
                'event_id' => $validated['event_id'] ?? null,
                'total_amount' => $total,
                'line_count' => count($toPay),
                'status' => B2cPayout::STATUS_PROCESSING,
                'dry_run' => $mpesa->isDryRun(),
                'notes' => $mpesa->isDryRun() ? 'Dry-run B2C disbursement' : null,
            ]);

            foreach ($toPay as $line) {
                $item = B2cPayoutItem::create([
                    'b2c_payout_id' => $payout->id,
                    'user_id' => $line['user_id'],
                    'phone' => $line['phone'],
                    'amount' => $line['amount'],
                    'event_allowance_ids' => $line['allowance_ids'],
                    'status' => B2cPayoutItem::STATUS_QUEUED,
                ]);

                $result = $mpesa->sendPayment(
                    $line['phone'],
                    (float) $line['amount'],
                    'Stagepass allowance payout #'.$payout->id,
                    'Allowances'
                );

                if (! $result['ok']) {
                    $item->update([
                        'status' => B2cPayoutItem::STATUS_FAILED,
                        'result_desc' => $result['message'],
                        'raw_response' => $result['raw'],
                    ]);

                    continue;
                }

                $item->update([
                    'status' => $mpesa->isDryRun() ? B2cPayoutItem::STATUS_COMPLETED : B2cPayoutItem::STATUS_ACCEPTED,
                    'conversation_id' => $result['conversation_id'],
                    'originator_conversation_id' => $result['originator_conversation_id'],
                    'raw_response' => $result['raw'],
                    'result_desc' => $result['message'],
                ]);

                if ($mpesa->isDryRun()) {
                    EventAllowance::query()
                        ->whereIn('id', $line['allowance_ids'])
                        ->where('status', EventAllowance::STATUS_APPROVED)
                        ->update([
                            'status' => EventAllowance::STATUS_PAID,
                            'paid_at' => now(),
                        ]);
                }
            }

            $mpesa->refreshPayoutStatus($payout->id);

            return $payout->fresh(['items.user']);
        });

        $items = $payout->items->map(fn (B2cPayoutItem $i) => [
            'id' => $i->id,
            'user_id' => $i->user_id,
            'crew_name' => $i->user?->name,
            'phone' => $i->phone,
            'amount' => (float) $i->amount,
            'status' => $i->status,
            'conversation_id' => $i->conversation_id,
            'result_desc' => $i->result_desc,
        ])->values()->all();
        app(AuditTrail::class)->record($request, 'payout.processed', $payout, [], [
            'status' => $payout->status, 'total_amount' => (float) $payout->total_amount,
            'line_count' => (int) $payout->line_count, 'dry_run' => (bool) $payout->dry_run,
        ]);

        return response()->json([
            'message' => $payout->dry_run
                ? 'Dry-run B2C completed. Allowances marked as paid.'
                : 'B2C payment requests submitted. Final status will update via callback.',
            'dry_run' => (bool) $payout->dry_run,
            'payout' => [
                'id' => $payout->id,
                'status' => $payout->status,
                'total_amount' => (float) $payout->total_amount,
                'line_count' => $payout->line_count,
            ],
            'items' => $items,
        ]);
    }

    /**
     * @param  array{event_id?:int|null,user_ids?:list<int>,allowance_ids?:list<int>}  $filters
     * @return \Illuminate\Database\Eloquent\Builder<\App\Models\EventAllowance>
     */
    private function approvedUnpaidQuery(array $filters, bool $requireHrVerification)
    {
        $query = EventAllowance::query()
            ->with(['crew:id,name,phone', 'type:id,name', 'event:id,name'])
            ->where('status', EventAllowance::STATUS_APPROVED)
            ->whereNull('paid_at');

        if ($requireHrVerification) {
            $query->whereNotNull('hr_verified_at');
        }

        if (! empty($filters['event_id'])) {
            $query->where('event_id', (int) $filters['event_id']);
        }
        if (! empty($filters['user_ids']) && is_array($filters['user_ids'])) {
            $query->whereIn('crew_id', array_map('intval', $filters['user_ids']));
        }
        if (! empty($filters['allowance_ids']) && is_array($filters['allowance_ids'])) {
            $query->whereIn('id', array_map('intval', $filters['allowance_ids']));
        }

        return $query->orderBy('crew_id')->orderBy('id');
    }
}
