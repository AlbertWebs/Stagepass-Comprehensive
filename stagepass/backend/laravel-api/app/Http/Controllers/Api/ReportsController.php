<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyOfficeCheckin;
use App\Models\Event;
use App\Models\EventExpense;
use App\Models\EventAllowance;
use App\Models\EventPayment;
use App\Models\EventUser;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    private const REPORT_TYPES = ['events', 'crew-attendance', 'crew-payments', 'tasks', 'financial', 'end-of-day', 'full-event'];

    private function canAccessReports(Request $request): bool
    {
        $user = $request->user();
        return $user && (
            $user->hasRole('super_admin') ||
            $user->hasRole('director') ||
            $user->hasRole('admin') ||
            $user->hasRole('team_leader') ||
            $user->hasRole('teamleader')
        );
    }

    /**
     * Parse date range from request: date_from/date_to, or month, or year, or single date.
     */
    private function parseDateRange(Request $request): array
    {
        $today = Carbon::today();
        if ($request->filled('date_from') && $request->filled('date_to')) {
            $from = Carbon::parse($request->date_from)->startOfDay();
            $to = Carbon::parse($request->date_to)->endOfDay();
            return [$from, $to];
        }
        if ($request->filled('month') && $request->filled('year')) {
            $y = (int) $request->year;
            $m = (int) $request->month;
            $from = Carbon::createFromDate($y, $m, 1)->startOfDay();
            $to = $from->copy()->endOfMonth();
            return [$from, $to];
        }
        if ($request->filled('year')) {
            $y = (int) $request->year;
            $from = Carbon::createFromDate($y, 1, 1)->startOfDay();
            $to = Carbon::createFromDate($y, 12, 31)->endOfDay();
            return [$from, $to];
        }
        if ($request->filled('date')) {
            $d = Carbon::parse($request->date)->startOfDay();
            return [$d, $d->copy()->endOfDay()];
        }
        $from = $today->copy()->startOfMonth();
        $to = $today->copy()->endOfDay();
        return [$from, $to];
    }

    /**
     * Legacy: single combined report (from/to required). Kept for web dashboard.
     */
    public function __invoke(Request $request): JsonResponse
    {
        if (! $this->canAccessReports($request)) {
            return response()->json(['message' => 'You do not have access to reports.'], 403);
        }

        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $from = Carbon::parse($request->from)->startOfDay();
        $to = Carbon::parse($request->to)->endOfDay();

        return response()->json([
            'financial' => $this->financialReportData($from, $to, null, null),
            'attendance' => $this->attendanceReport($from, $to, null, null),
            'office_checkins' => $this->officeCheckinsReport($from, $to),
            'events' => $this->eventsReportData($from, $to, null),
            'arrival' => $this->arrivalReport($from, $to, null),
        ]);
    }

    /**
     * GET /reports/events - Event report with filters.
     */
    public function events(Request $request): JsonResponse
    {
        if (! $this->canAccessReports($request)) {
            return response()->json(['message' => 'You do not have access to reports.'], 403);
        }

        [$from, $to] = $this->parseDateRange($request);
        $eventId = $request->filled('event_id') ? (int) $request->event_id : null;

        $data = $this->eventsReportData($from, $to, $eventId);

        $query = Event::query()
            ->spansRange($from->toDateString(), $to->toDateString())
            ->with(['teamLeader:id,name', 'client:id,name']);
        if ($eventId) {
            $query->where('id', $eventId);
        }
        $query->orderBy('date')->orderBy('start_time');
        $perPage = min((int) $request->input('per_page', 50), 100);
        $paginator = $query->paginate($perPage);
        $data['data'] = $paginator->items();
        $data['pagination'] = [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ];

        return response()->json($data);
    }

    /**
     * GET /reports/crew-attendance - Crew attendance (check-ins, missed, participation).
     */
    public function crewAttendance(Request $request): JsonResponse
    {
        if (! $this->canAccessReports($request)) {
            return response()->json(['message' => 'You do not have access to reports.'], 403);
        }

        [$from, $to] = $this->parseDateRange($request);
        $eventId = $request->filled('event_id') ? (int) $request->event_id : null;
        $userId = $request->filled('user_id') ? (int) $request->user_id : null;

        $baseQuery = EventUser::query()
            ->with(['event:id,name,date,start_time', 'user:id,name,email'])
            ->whereHas('event', fn ($q) => $q->spansRange($from->toDateString(), $to->toDateString()));
        if ($eventId) {
            $baseQuery->where('event_id', $eventId);
        }
        if ($userId) {
            $baseQuery->where('user_id', $userId);
        }

        $withCheckin = (clone $baseQuery)->whereNotNull('checkin_time')->get();
        $allAssignments = (clone $baseQuery)->get();
        $missed = $allAssignments->filter(fn ($a) => $a->checkin_time === null)->count();
        $totalHours = $withCheckin->sum(fn ($a) => (float) ($a->total_hours ?? 0));
        $totalExtraHours = $withCheckin->sum(fn ($a) => (float) ($a->extra_hours ?? 0));
        $totalPauseMinutes = (int) $withCheckin->sum(fn ($a) => (int) ($a->pause_duration ?? 0));
        $transportCostTotal = $allAssignments->sum(fn ($a) => (float) ($a->transport_amount ?? 0));

        $byDay = [];
        foreach ($withCheckin as $a) {
            $date = $a->event?->date?->format('Y-m-d');
            if ($date) {
                if (! isset($byDay[$date])) {
                    $byDay[$date] = ['date' => $date, 'checkins' => 0, 'hours' => 0.0, 'extra_hours' => 0.0];
                }
                $byDay[$date]['checkins']++;
                $byDay[$date]['hours'] += (float) ($a->total_hours ?? 0);
                $byDay[$date]['extra_hours'] += (float) ($a->extra_hours ?? 0);
            }
        }
        ksort($byDay);

        $summary = [
            'total_assignments' => $allAssignments->count(),
            'total_checkins' => $withCheckin->count(),
            'missed_checkins' => $missed,
            'participation_rate' => $allAssignments->count() > 0
                ? round(100 * $withCheckin->count() / $allAssignments->count(), 1)
                : 0,
            'total_hours' => round($totalHours, 2),
            'total_extra_hours' => round($totalExtraHours, 2),
            'total_pause_minutes' => $totalPauseMinutes,
            'active_hours' => round(max(0, $totalHours - ($totalPauseMinutes / 60)), 2),
            'transport_cost_total' => round($transportCostTotal, 2),
        ];

        $listQuery = EventUser::query()
            ->with(['event:id,name,date', 'user:id,name'])
            ->whereHas('event', fn ($q) => $q->spansRange($from->toDateString(), $to->toDateString()));
        if ($eventId) {
            $listQuery->where('event_id', $eventId);
        }
        if ($userId) {
            $listQuery->where('user_id', $userId);
        }
        $listQuery->orderByDesc('checkin_time');
        $perPage = min((int) $request->input('per_page', 50), 100);
        $paginator = $listQuery->paginate($perPage);

        return response()->json([
            'summary' => $summary,
            'by_day' => array_values($byDay),
            'data' => $paginator->items(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * GET /reports/crew-payments - Payment report (pending, completed, totals).
     */
    public function crewPayments(Request $request): JsonResponse
    {
        if (! $this->canAccessReports($request)) {
            return response()->json(['message' => 'You do not have access to reports.'], 403);
        }

        [$from, $to] = $this->parseDateRange($request);
        $eventId = $request->filled('event_id') ? (int) $request->event_id : null;
        $userId = $request->filled('user_id') ? (int) $request->user_id : null;

        $query = EventPayment::query()
            ->with(['event:id,name,date', 'user:id,name', 'approvedBy:id,name'])
            ->whereHas('event', fn ($q) => $q->spansRange($from->toDateString(), $to->toDateString()));
        if ($eventId) {
            $query->where('event_id', $eventId);
        }
        if ($userId) {
            $query->where('user_id', $userId);
        }

        $all = (clone $query)->get();
        $pending = $all->where('status', 'pending');
        $approved = $all->where('status', 'approved');
        $rejected = $all->where('status', 'rejected');

        $summary = [
            'total_count' => $all->count(),
            'pending_count' => $pending->count(),
            'pending_total' => round($pending->sum(fn ($p) => (float) $p->total_amount), 2),
            'approved_count' => $approved->count(),
            'approved_total' => round($approved->sum(fn ($p) => (float) $p->total_amount), 2),
            'rejected_count' => $rejected->count(),
            'rejected_total' => round($rejected->sum(fn ($p) => (float) $p->total_amount), 2),
            'grand_total' => round($all->sum(fn ($p) => (float) $p->total_amount), 2),
        ];

        $query->orderByDesc('created_at');
        $perPage = min((int) $request->input('per_page', 50), 100);
        $paginator = $query->paginate($perPage);

        return response()->json([
            'summary' => $summary,
            'data' => $paginator->items(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * GET /reports/tasks - Task report (assigned, completed, pending).
     */
    public function tasks(Request $request): JsonResponse
    {
        if (! $this->canAccessReports($request)) {
            return response()->json(['message' => 'You do not have access to reports.'], 403);
        }

        [$from, $to] = $this->parseDateRange($request);
        $eventId = $request->filled('event_id') ? (int) $request->event_id : null;
        $userId = $request->filled('user_id') ? (int) $request->user_id : null;

        $query = Task::query()
            ->with(['event:id,name,date', 'creator:id,name', 'assignees:id,name'])
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('due_date', [$from->toDateString(), $to->toDateString()])
                    ->orWhereBetween('created_at', [$from, $to]);
            });
        if ($eventId) {
            $query->where('event_id', $eventId);
        }
        if ($userId) {
            $query->whereHas('assignees', fn ($q) => $q->where('users.id', $userId));
        }

        $all = (clone $query)->get();
        $summary = [
            'total' => $all->count(),
            'pending' => $all->where('status', 'pending')->count(),
            'in_progress' => $all->where('status', 'in_progress')->count(),
            'completed' => $all->where('status', 'completed')->count(),
        ];

        $query->orderByRaw("CASE status WHEN 'completed' THEN 1 WHEN 'in_progress' THEN 0 ELSE -1 END")
            ->orderBy('due_date')->orderBy('id');
        $perPage = min((int) $request->input('per_page', 50), 100);
        $paginator = $query->paginate($perPage);

        return response()->json([
            'summary' => $summary,
            'data' => $paginator->items(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * GET /reports/financial - Client/event financial summary.
     */
    public function financial(Request $request): JsonResponse
    {
        if (! $this->canAccessReports($request)) {
            return response()->json(['message' => 'You do not have access to reports.'], 403);
        }

        [$from, $to] = $this->parseDateRange($request);
        $eventId = $request->filled('event_id') ? (int) $request->event_id : null;

        $data = $this->financialReportData(
            $from,
            $to,
            $eventId,
            $request->filled('user_id') ? (int) $request->user_id : null
        );

        $query = EventPayment::query()
            ->with(['event:id,name,date', 'user:id,name'])
            ->whereHas('event', fn ($q) => $q->spansRange($from->toDateString(), $to->toDateString()));
        if ($eventId) {
            $query->where('event_id', $eventId);
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->user_id);
        }
        $query->orderByDesc('payment_date');
        $perPage = min((int) $request->input('per_page', 50), 100);
        $paginator = $query->paginate($perPage);
        $data['data'] = $paginator->items();
        $data['pagination'] = [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ];

        return response()->json($data);
    }

    /**
     * GET /reports/end-of-day - End-of-day operations and expense report.
     */
    public function endOfDay(Request $request): JsonResponse
    {
        if (! $this->canAccessReports($request)) {
            return response()->json(['message' => 'You do not have access to reports.'], 403);
        }

        [$from, $to] = $this->parseDateRange($request);
        $eventId = $request->filled('event_id') ? (int) $request->event_id : null;
        $data = $this->endOfDayReportData($from, $to, $eventId);
        return response()->json($data);
    }

    /**
     * GET /reports/full-event - Full event dossier including allowance line items.
     */
    public function fullEvent(Request $request): JsonResponse
    {
        if (! $this->canAccessReports($request)) {
            return response()->json(['message' => 'You do not have access to reports.'], 403);
        }

        [$from, $to] = $this->parseDateRange($request);
        $eventId = $request->filled('event_id') ? (int) $request->event_id : null;
        $userId = $request->filled('user_id') ? (int) $request->user_id : null;

        return response()->json($this->fullEventReportData($from, $to, $eventId, $userId));
    }

    /**
     * GET /reports/export - Export report as printable HTML (for PDF via browser print).
     */
    public function export(Request $request)
    {
        if (! $this->canAccessReports($request)) {
            return response()->json(['message' => 'You do not have access to reports.'], 403);
        }

        $type = $request->input('type', 'events');
        if (! in_array($type, self::REPORT_TYPES, true)) {
            return response()->json(['message' => 'Invalid report type.'], 422);
        }

        [$from, $to] = $this->parseDateRange($request);
        $eventId = $request->filled('event_id') ? (int) $request->event_id : null;
        $userId = $request->filled('user_id') ? (int) $request->user_id : null;

        $title = match ($type) {
            'events' => 'Event Report',
            'crew-attendance' => 'Crew Attendance Report',
            'crew-payments' => 'Crew Payment Report',
            'tasks' => 'Task Report',
            'financial' => 'Financial Summary Report',
            'end-of-day' => 'End-of-Day Signed Report',
            'full-event' => 'Full Event Report',
            default => 'Report',
        };

        if ($type === 'full-event') {
            $html = $this->buildFullEventExportHtml(
                $title,
                $from,
                $to,
                $eventId,
                $userId,
                trim((string) $request->input('confirmed_by', '')),
                trim((string) $request->input('signature', ''))
            );
        } else {
            $html = $this->buildExportHtml(
                $type,
                $title,
                $from,
                $to,
                $eventId,
                $userId,
                trim((string) $request->input('confirmed_by', '')),
                trim((string) $request->input('signature', ''))
            );
        }

        if ($request->wantsJson() || $request->input('format') === 'json') {
            return response()->json(['html' => $html, 'title' => $title]);
        }

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="report-' . $type . '-' . $from->format('Y-m-d') . '.html"',
        ]);
    }

    private function buildExportHtml(
        string $type,
        string $title,
        Carbon $from,
        Carbon $to,
        ?int $eventId,
        ?int $userId,
        string $confirmedBy = '',
        string $signature = ''
    ): string
    {
        $period = $from->format('M j, Y') . ' – ' . $to->format('M j, Y');
        $generatedAt = now()->format('M j, Y g:i A');

        $summaryHtml = '';
        $tableRows = '';
        $signatureHtml = '';

        switch ($type) {
            case 'events':
                $data = $this->eventsReportData($from, $to, $eventId);
                $summaryHtml = '<p>Total events: <strong>' . $data['summary']['total_events'] . '</strong></p>';
                if (! empty($data['summary']['by_status'])) {
                    $summaryHtml .= '<p>By status: ' . implode(', ', array_map(fn ($s, $c) => $s . ': ' . $c, array_keys($data['summary']['by_status']), $data['summary']['by_status'])) . '</p>';
                }
                $events = Event::query()->spansRange($from->toDateString(), $to->toDateString())->when($eventId, fn ($q) => $q->where('id', $eventId))->orderBy('date')->get();
                foreach ($events as $e) {
                    $tableRows .= '<tr><td>' . e($e->name) . '</td><td>' . $e->date->format('Y-m-d') . '</td><td>' . e($e->status ?? '—') . '</td></tr>';
                }
                $tableRows = $tableRows ?: '<tr><td colspan="3">No events</td></tr>';
                break;
            case 'crew-attendance':
                $baseQuery = EventUser::query()->with(['event', 'user'])->whereHas('event', fn ($q) => $q->spansRange($from->toDateString(), $to->toDateString()))->when($eventId, fn ($q) => $q->where('event_id', $eventId))->when($userId, fn ($q) => $q->where('user_id', $userId));
                $all = (clone $baseQuery)->get();
                $checkedIn = $all->whereNotNull('checkin_time');
                $summaryHtml = '<p>Total assignments: <strong>' . $all->count() . '</strong> | Check-ins: <strong>' . $checkedIn->count() . '</strong> | Missed: <strong>' . ($all->count() - $checkedIn->count()) . '</strong> | Total hours: <strong>' . round($checkedIn->sum(fn ($a) => (float) ($a->total_hours ?? 0)), 2) . '</strong> | Extra hours: <strong>' . round($checkedIn->sum(fn ($a) => (float) ($a->extra_hours ?? 0)), 2) . '</strong></p>';
                foreach ($baseQuery->orderByDesc('checkin_time')->get() as $a) {
                    $tableRows .= '<tr><td>' . e($a->user?->name ?? '—') . '</td><td>' . e($a->event?->name ?? '—') . '</td><td>' . ($a->checkin_time ? $a->checkin_time->format('Y-m-d H:i') : '—') . '</td><td>' . ($a->checkout_time ? $a->checkout_time->format('Y-m-d H:i') : '—') . '</td><td>' . ($a->total_hours ?? '—') . '</td><td>' . ($a->extra_hours ?? '—') . '</td></tr>';
                }
                $tableRows = $tableRows ?: '<tr><td colspan="6">No records</td></tr>';
                break;
            case 'crew-payments':
                $data = $this->financialReportData($from, $to, $eventId, $userId);
                $summaryHtml = '<p>Total payments: <strong>' . $data['summary']['total_payments'] . '</strong> | Total amount: <strong>' . number_format($data['summary']['total_amount'], 2) . '</strong></p>';
                $payments = EventPayment::query()->with(['event', 'user'])->whereHas('event', fn ($q) => $q->spansRange($from->toDateString(), $to->toDateString()))->when($eventId, fn ($q) => $q->where('event_id', $eventId))->when($userId, fn ($q) => $q->where('user_id', $userId))->orderByDesc('payment_date')->get();
                foreach ($payments as $p) {
                    $tableRows .= '<tr><td>' . e($p->user?->name ?? '—') . '</td><td>' . e($p->event?->name ?? '—') . '</td><td>' . ($p->payment_date?->format('Y-m-d') ?? '—') . '</td><td>' . number_format((float) $p->total_amount, 2) . '</td><td>' . e($p->status ?? '—') . '</td></tr>';
                }
                $tableRows = $tableRows ?: '<tr><td colspan="5">No payments</td></tr>';
                $tableHeader = '<tr><th>Crew</th><th>Event</th><th>Date</th><th>Amount</th><th>Status</th></tr>';
                break;
            case 'tasks':
                $query = Task::query()->with(['event', 'assignees'])->where(function ($q) use ($from, $to) {
                    $q->whereBetween('due_date', [$from->toDateString(), $to->toDateString()])->orWhereBetween('created_at', [$from, $to]);
                })->when($eventId, fn ($q) => $q->where('event_id', $eventId))->when($userId, fn ($q) => $q->whereHas('assignees', fn ($aq) => $aq->where('users.id', $userId)));
                $all = (clone $query)->get();
                $summaryHtml = '<p>Total: <strong>' . $all->count() . '</strong> | Pending: <strong>' . $all->where('status', 'pending')->count() . '</strong> | In progress: <strong>' . $all->where('status', 'in_progress')->count() . '</strong> | Completed: <strong>' . $all->where('status', 'completed')->count() . '</strong></p>';
                foreach ($query->orderBy('due_date')->get() as $t) {
                    $assignees = $t->assignees->pluck('name')->join(', ') ?: '—';
                    $tableRows .= '<tr><td>' . e($t->title) . '</td><td>' . e($t->event?->name ?? '—') . '</td><td>' . ($t->due_date?->format('Y-m-d') ?? '—') . '</td><td>' . e($t->status) . '</td><td>' . e($assignees) . '</td></tr>';
                }
                $tableRows = $tableRows ?: '<tr><td colspan="5">No tasks</td></tr>';
                break;
            case 'financial':
                $data = $this->financialReportData($from, $to, $eventId, $userId);
                $summaryHtml = '<p>Total payments: <strong>' . $data['summary']['total_payments'] . '</strong> | Total amount: <strong>' . number_format($data['summary']['total_amount'], 2) . '</strong></p>';
                foreach ($data['by_day'] as $row) {
                    $tableRows .= '<tr><td>' . e($row['date']) . '</td><td>' . $row['count'] . '</td><td>' . number_format($row['total'], 2) . '</td></tr>';
                }
                $tableRows = $tableRows ?: '<tr><td colspan="3">No data</td></tr>';
                $tableHeader = '<tr><th>Date</th><th>Count</th><th>Total</th></tr>';
                break;
            case 'end-of-day':
                $data = $this->endOfDayReportData($from, $to, $eventId);
                $summaryHtml = '<div class="kpi-grid">'
                    . '<div class="kpi"><span class="k">Events</span><span class="v">' . $data['summary']['events_count'] . '</span></div>'
                    . '<div class="kpi"><span class="k">Crew allowances</span><span class="v">KES ' . number_format((float) $data['summary']['crew_allowances_total'], 2) . '</span></div>'
                    . '<div class="kpi"><span class="k">Other expenses</span><span class="v">KES ' . number_format((float) $data['summary']['other_expenses_total'], 2) . '</span></div>'
                    . '<div class="kpi"><span class="k">Grand total</span><span class="v">KES ' . number_format((float) $data['summary']['grand_total'], 2) . '</span></div>'
                    . '</div>';

                foreach ($data['data'] as $row) {
                    $tableRows .= '<tr>'
                        . '<td>' . e((string) ($row['date'] ?? '—')) . '</td>'
                        . '<td>' . e((string) ($row['event_name'] ?? '—')) . '</td>'
                        . '<td style="text-align:right;">' . number_format((float) ($row['crew_allowances'] ?? 0), 2) . '</td>'
                        . '<td style="text-align:right;">' . number_format((float) ($row['other_expenses'] ?? 0), 2) . '</td>'
                        . '<td style="text-align:right;font-weight:700;">' . number_format((float) ($row['total'] ?? 0), 2) . '</td>'
                        . '</tr>';
                }
                $tableRows = $tableRows ?: '<tr><td colspan="5">No records for selected range.</td></tr>';
                $tableHeader = '<tr><th>Date</th><th>Event</th><th style="text-align:right;">Crew allowances (KES)</th><th style="text-align:right;">Other expenses (KES)</th><th style="text-align:right;">Total (KES)</th></tr>';
                $signatureHtml = '<div class="sig-wrap">'
                    . '<div class="sig-card"><div class="sig-label">Confirmed by</div><div class="sig-value">' . e($confirmedBy !== '' ? $confirmedBy : '________________________') . '</div></div>'
                    . '<div class="sig-card"><div class="sig-label">Signature</div><div class="sig-value">' . e($signature !== '' ? $signature : '________________________') . '</div></div>'
                    . '<div class="sig-card"><div class="sig-label">Date</div><div class="sig-value">' . e(now()->format('Y-m-d H:i')) . '</div></div>'
                    . '</div>';
                break;
        }

        if (! isset($tableHeader)) {
            $tableHeader = match ($type) {
                'events' => '<tr><th>Event</th><th>Date</th><th>Status</th></tr>',
                'crew-attendance' => '<tr><th>Crew</th><th>Event</th><th>Check-in</th><th>Check-out</th><th>Hours</th><th>Extra Hours</th></tr>',
                'tasks' => '<tr><th>Task</th><th>Event</th><th>Due date</th><th>Status</th><th>Assignees</th></tr>',
                default => '<tr><th>Item</th><th>Details</th></tr>',
            };
        }

        return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' . e($title) . '</title><style>
body{font-family:system-ui,sans-serif;margin:24px;color:#111;}
h1{font-size:1.5rem;margin-bottom:4px;}
.meta{color:#666;font-size:0.875rem;margin-bottom:20px;}
table{border-collapse:collapse;width:100%;margin-top:16px;}
th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;}
th{background:#f5f5f5;font-weight:600;}
.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:10px;margin-bottom:8px;}
.kpi{border:1px solid #ddd;border-radius:10px;padding:10px 12px;background:#fbfbfb;}
.kpi .k{display:block;color:#555;font-size:12px;margin-bottom:4px;}
.kpi .v{display:block;font-size:18px;font-weight:700;color:#0f1838;}
.sig-wrap{display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));gap:10px;margin-top:18px;}
.sig-card{border:1px solid #ddd;border-radius:10px;padding:10px 12px;min-height:72px;}
.sig-label{font-size:12px;color:#666;margin-bottom:8px;}
.sig-value{font-size:14px;font-weight:600;}
@media print{body{margin:12px;} .no-print{display:none;}}
</style></head><body>
<h1>' . e($title) . '</h1>
<p class="meta">Period: ' . e($period) . ' | Generated: ' . e($generatedAt) . '</p>
<div class="summary">' . $summaryHtml . '</div>
<table><thead>' . $tableHeader . '</thead><tbody>' . $tableRows . '</tbody></table>
' . ($signatureHtml ?? '') . '
<p class="meta" style="margin-top:24px;">Stagepass Reports – ' . e($generatedAt) . '</p>
</body></html>';
    }

    private function eventsReportData(Carbon $from, Carbon $to, ?int $eventId): array
    {
        $query = Event::query()->spansRange($from->toDateString(), $to->toDateString());
        if ($eventId) {
            $query->where('id', $eventId);
        }
        $events = $query->get();

        $byStatus = [];
        $byDay = [];
        foreach ($events as $e) {
            $status = $e->status ?? 'created';
            $byStatus[$status] = ($byStatus[$status] ?? 0) + 1;
            $date = $e->date->format('Y-m-d');
            if (! isset($byDay[$date])) {
                $byDay[$date] = ['date' => $date, 'count' => 0];
            }
            $byDay[$date]['count']++;
        }
        ksort($byDay);

        return [
            'summary' => [
                'total_events' => $events->count(),
                'by_status' => $byStatus,
            ],
            'by_day' => array_values($byDay),
        ];
    }

    private function financialReportData(Carbon $from, Carbon $to, ?int $eventId, ?int $userId): array
    {
        $query = EventPayment::query()
            ->with('event')
            ->whereHas('event', fn ($q) => $q->spansRange($from->toDateString(), $to->toDateString()));
        if ($eventId) {
            $query->where('event_id', $eventId);
        }
        if ($userId) {
            $query->where('user_id', $userId);
        }
        $payments = $query->get();

        $byStatus = ['pending' => ['count' => 0, 'total' => 0], 'approved' => ['count' => 0, 'total' => 0], 'rejected' => ['count' => 0, 'total' => 0]];
        $totalAmount = 0;
        $byDay = [];
        foreach ($payments as $p) {
            $status = $p->status ?? 'pending';
            if (! isset($byStatus[$status])) {
                $byStatus[$status] = ['count' => 0, 'total' => 0];
            }
            $byStatus[$status]['count']++;
            $amt = (float) $p->total_amount;
            $byStatus[$status]['total'] += $amt;
            $totalAmount += $amt;
            $date = $p->event?->date?->format('Y-m-d');
            if ($date) {
                if (! isset($byDay[$date])) {
                    $byDay[$date] = ['date' => $date, 'count' => 0, 'total' => 0];
                }
                $byDay[$date]['count']++;
                $byDay[$date]['total'] += $amt;
            }
        }
        ksort($byDay);

        return [
            'summary' => [
                'total_payments' => $payments->count(),
                'total_amount' => round($totalAmount, 2),
                'by_status' => $byStatus,
                'earned_allowances_total' => round(
                    EventAllowance::query()
                        ->whereBetween('recorded_at', [$from, $to])
                        ->when($eventId, fn ($q) => $q->where('event_id', $eventId))
                        ->when($userId, fn ($q) => $q->where('crew_id', $userId))
                        ->sum('amount'),
                    2
                ),
            ],
            'by_day' => array_values($byDay),
        ];
    }

    private function endOfDayReportData(Carbon $from, Carbon $to, ?int $eventId): array
    {
        $events = Event::query()
            ->spansRange($from->toDateString(), $to->toDateString())
            ->when($eventId, fn ($q) => $q->where('id', $eventId))
            ->orderBy('date')
            ->get(['id', 'name', 'date']);

        $eventIds = $events->pluck('id')->all();

        $payments = EventPayment::query()
            ->whereIn('event_id', $eventIds)
            ->where('status', EventPayment::STATUS_APPROVED)
            ->get(['event_id', 'allowances', 'per_diem', 'total_amount']);

        $expenses = EventExpense::query()
            ->whereIn('event_id', $eventIds)
            ->get(['event_id', 'cab_amount', 'parking_fee']);

        $paymentsByEvent = [];
        foreach ($payments as $p) {
            $eid = (int) $p->event_id;
            if (! isset($paymentsByEvent[$eid])) {
                $paymentsByEvent[$eid] = ['allowances' => 0.0, 'per_diem' => 0.0, 'total_amount' => 0.0];
            }
            $paymentsByEvent[$eid]['allowances'] += (float) ($p->allowances ?? 0);
            $paymentsByEvent[$eid]['per_diem'] += (float) ($p->per_diem ?? 0);
            $paymentsByEvent[$eid]['total_amount'] += (float) ($p->total_amount ?? 0);
        }

        $expensesByEvent = [];
        foreach ($expenses as $x) {
            $eid = (int) $x->event_id;
            if (! isset($expensesByEvent[$eid])) {
                $expensesByEvent[$eid] = ['cab' => 0.0, 'parking' => 0.0];
            }
            $expensesByEvent[$eid]['cab'] += (float) ($x->cab_amount ?? 0);
            $expensesByEvent[$eid]['parking'] += (float) ($x->parking_fee ?? 0);
        }

        $rows = [];
        $allowancesTotal = 0.0;
        $otherExpensesTotal = 0.0;

        foreach ($events as $e) {
            $eid = (int) $e->id;
            $crewAllowances = (float) (($paymentsByEvent[$eid]['allowances'] ?? 0) + ($paymentsByEvent[$eid]['per_diem'] ?? 0));
            $otherExpenses = (float) (($expensesByEvent[$eid]['cab'] ?? 0) + ($expensesByEvent[$eid]['parking'] ?? 0));
            $total = $crewAllowances + $otherExpenses;
            $allowancesTotal += $crewAllowances;
            $otherExpensesTotal += $otherExpenses;
            $rows[] = [
                'event_id' => $eid,
                'event_name' => $e->name,
                'date' => $e->date?->format('Y-m-d'),
                'crew_allowances' => round($crewAllowances, 2),
                'other_expenses' => round($otherExpenses, 2),
                'total' => round($total, 2),
            ];
        }

        return [
            'summary' => [
                'events_count' => count($rows),
                'crew_allowances_total' => round($allowancesTotal, 2),
                'other_expenses_total' => round($otherExpensesTotal, 2),
                'grand_total' => round($allowancesTotal + $otherExpensesTotal, 2),
            ],
            'data' => $rows,
        ];
    }

    /**
     * Full event dossier: event details, crew/attendance, earned allowances, payments, expenses.
     *
     * @return array{summary: array<string, mixed>, events: array<int, array<string, mixed>>}
     */
    private function fullEventReportData(Carbon $from, Carbon $to, ?int $eventId, ?int $userId = null): array
    {
        $eventsQuery = Event::query()
            ->with(['teamLeader:id,name', 'client:id,name', 'endedBy:id,name']);

        if ($eventId) {
            $eventsQuery->where('id', $eventId);
        } else {
            $eventsQuery->spansRange($from->toDateString(), $to->toDateString());
        }

        $events = $eventsQuery->orderBy('date')->get();

        $eventIds = $events->pluck('id')->all();

        $crewByEvent = EventUser::query()
            ->with('user:id,name,email')
            ->whereIn('event_id', $eventIds)
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->get()
            ->groupBy('event_id');

        $allowancesByEvent = EventAllowance::query()
            ->with(['crew:id,name', 'type:id,name', 'recorder:id,name', 'approver:id,name'])
            ->whereIn('event_id', $eventIds)
            ->when($userId, fn ($q) => $q->where('crew_id', $userId))
            ->orderBy('recorded_at')
            ->get()
            ->groupBy('event_id');

        $paymentsByEvent = EventPayment::query()
            ->with('user:id,name')
            ->whereIn('event_id', $eventIds)
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->orderByDesc('payment_date')
            ->get()
            ->groupBy('event_id');

        $expensesByEvent = EventExpense::query()
            ->with('user:id,name')
            ->whereIn('event_id', $eventIds)
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->get()
            ->groupBy('event_id');

        $dossier = [];
        $totals = [
            'events_count' => 0,
            'crew_count' => 0,
            'earned_allowances_total' => 0.0,
            'earned_allowances_approved_paid' => 0.0,
            'payment_allowances_total' => 0.0,
            'payment_per_diem_total' => 0.0,
            'payment_grand_total' => 0.0,
            'expenses_total' => 0.0,
            'transport_total' => 0.0,
        ];

        foreach ($events as $event) {
            $eid = (int) $event->id;
            $crewRows = $crewByEvent->get($eid, collect());
            $allowanceRows = $allowancesByEvent->get($eid, collect());
            $paymentRows = $paymentsByEvent->get($eid, collect());
            $expenseRows = $expensesByEvent->get($eid, collect());

            $crew = $crewRows->map(function (EventUser $a) {
                return [
                    'user_id' => $a->user_id,
                    'name' => $a->user?->name ?? ('User #'.$a->user_id),
                    'email' => $a->user?->email,
                    'role_in_event' => $a->role_in_event,
                    'checkin_time' => $a->checkin_time?->format('Y-m-d H:i'),
                    'checkout_time' => $a->checkout_time?->format('Y-m-d H:i'),
                    'total_hours' => $a->total_hours !== null ? (float) $a->total_hours : null,
                    'standard_hours' => $a->standard_hours !== null ? (float) $a->standard_hours : null,
                    'extra_hours' => $a->extra_hours !== null ? (float) $a->extra_hours : null,
                    'pause_duration' => $a->pause_duration !== null ? (float) $a->pause_duration : null,
                    'transport_type' => $a->transport_type,
                    'transport_amount' => $a->transport_amount !== null ? (float) $a->transport_amount : null,
                ];
            })->values()->all();

            $allowances = $allowanceRows->map(function (EventAllowance $a) {
                return [
                    'id' => $a->id,
                    'crew_id' => $a->crew_id,
                    'crew_name' => $a->crew?->name ?? ('Crew #'.$a->crew_id),
                    'allowance_type' => $a->type?->name ?? '—',
                    'amount' => (float) $a->amount,
                    'status' => $a->status,
                    'source' => $a->source ?? EventAllowance::SOURCE_MANUAL,
                    'description' => $a->description,
                    'meal_slot' => $a->meal_slot,
                    'meal_grant_date' => $a->meal_grant_date?->format('Y-m-d'),
                    'recorded_by' => $a->recorder?->name,
                    'recorded_at' => $a->recorded_at?->format('Y-m-d H:i'),
                    'approved_by' => $a->approver?->name,
                    'approved_at' => $a->approved_at?->format('Y-m-d H:i'),
                ];
            })->values()->all();

            $payments = $paymentRows->map(function (EventPayment $p) {
                return [
                    'id' => $p->id,
                    'user_id' => $p->user_id,
                    'crew_name' => $p->user?->name ?? ('User #'.$p->user_id),
                    'purpose' => $p->purpose,
                    'payment_date' => $p->payment_date?->format('Y-m-d'),
                    'hours' => $p->hours !== null ? (float) $p->hours : null,
                    'allowances' => (float) ($p->allowances ?? 0),
                    'per_diem' => (float) ($p->per_diem ?? 0),
                    'total_amount' => (float) ($p->total_amount ?? 0),
                    'status' => $p->status,
                ];
            })->values()->all();

            $expenses = $expenseRows->map(function (EventExpense $x) {
                return [
                    'id' => $x->id,
                    'user_id' => $x->user_id,
                    'crew_name' => $x->user?->name ?? ('User #'.$x->user_id),
                    'used_company_transport' => (bool) $x->used_company_transport,
                    'cab_amount' => (float) ($x->cab_amount ?? 0),
                    'parking_fee' => (float) ($x->parking_fee ?? 0),
                    'total' => round((float) ($x->cab_amount ?? 0) + (float) ($x->parking_fee ?? 0), 2),
                ];
            })->values()->all();

            $earnedTotal = round($allowanceRows->sum(fn ($a) => (float) $a->amount), 2);
            $earnedApprovedPaid = round($allowanceRows
                ->whereIn('status', [EventAllowance::STATUS_APPROVED, EventAllowance::STATUS_PAID])
                ->sum(fn ($a) => (float) $a->amount), 2);
            $paymentAllowances = round($paymentRows->sum(fn ($p) => (float) ($p->allowances ?? 0)), 2);
            $paymentPerDiem = round($paymentRows->sum(fn ($p) => (float) ($p->per_diem ?? 0)), 2);
            $paymentGrand = round($paymentRows->sum(fn ($p) => (float) ($p->total_amount ?? 0)), 2);
            $expensesTotal = round($expenseRows->sum(fn ($x) => (float) ($x->cab_amount ?? 0) + (float) ($x->parking_fee ?? 0)), 2);
            $transportTotal = round($crewRows->sum(fn ($a) => (float) ($a->transport_amount ?? 0)), 2);

            $statusBreakdown = [
                'pending' => $allowanceRows->where('status', EventAllowance::STATUS_PENDING)->count(),
                'approved' => $allowanceRows->where('status', EventAllowance::STATUS_APPROVED)->count(),
                'rejected' => $allowanceRows->where('status', EventAllowance::STATUS_REJECTED)->count(),
                'paid' => $allowanceRows->where('status', EventAllowance::STATUS_PAID)->count(),
            ];

            $dossier[] = [
                'event' => [
                    'id' => $eid,
                    'name' => $event->name,
                    'date' => $event->date?->format('Y-m-d'),
                    'end_date' => $event->end_date?->format('Y-m-d'),
                    'start_time' => $event->start_time,
                    'expected_end_time' => $event->expected_end_time,
                    'location_name' => $event->location_name,
                    'status' => $event->status,
                    'description' => $event->description,
                    'daily_allowance' => $event->daily_allowance !== null ? (float) $event->daily_allowance : null,
                    'per_diem_enabled' => (bool) $event->per_diem_enabled,
                    'team_leader' => $event->teamLeader?->name,
                    'client' => $event->client?->name,
                    'end_comment' => $event->end_comment,
                    'ended_at' => $event->ended_at?->format('Y-m-d H:i'),
                    'ended_by' => $event->endedBy?->name,
                ],
                'crew' => $crew,
                'earned_allowances' => $allowances,
                'payments' => $payments,
                'expenses' => $expenses,
                'totals' => [
                    'crew_count' => count($crew),
                    'earned_allowances_total' => $earnedTotal,
                    'earned_allowances_approved_paid' => $earnedApprovedPaid,
                    'earned_status_breakdown' => $statusBreakdown,
                    'payment_allowances_total' => $paymentAllowances,
                    'payment_per_diem_total' => $paymentPerDiem,
                    'payment_grand_total' => $paymentGrand,
                    'expenses_total' => $expensesTotal,
                    'transport_total' => $transportTotal,
                    'combined_outflow' => round($earnedApprovedPaid + $expensesTotal + $transportTotal, 2),
                ],
            ];

            $totals['events_count']++;
            $totals['crew_count'] += count($crew);
            $totals['earned_allowances_total'] += $earnedTotal;
            $totals['earned_allowances_approved_paid'] += $earnedApprovedPaid;
            $totals['payment_allowances_total'] += $paymentAllowances;
            $totals['payment_per_diem_total'] += $paymentPerDiem;
            $totals['payment_grand_total'] += $paymentGrand;
            $totals['expenses_total'] += $expensesTotal;
            $totals['transport_total'] += $transportTotal;
        }

        foreach (['earned_allowances_total', 'earned_allowances_approved_paid', 'payment_allowances_total', 'payment_per_diem_total', 'payment_grand_total', 'expenses_total', 'transport_total'] as $key) {
            $totals[$key] = round($totals[$key], 2);
        }
        $totals['combined_outflow'] = round(
            $totals['earned_allowances_approved_paid'] + $totals['expenses_total'] + $totals['transport_total'],
            2
        );

        return [
            'summary' => $totals,
            'events' => $dossier,
        ];
    }

    private function buildFullEventExportHtml(
        string $title,
        Carbon $from,
        Carbon $to,
        ?int $eventId,
        ?int $userId,
        string $confirmedBy = '',
        string $signature = ''
    ): string {
        $data = $this->fullEventReportData($from, $to, $eventId, $userId);
        $period = $from->format('M j, Y').' – '.$to->format('M j, Y');
        $generatedAt = now()->format('M j, Y g:i A');
        $summary = $data['summary'];

        $sections = '';
        foreach ($data['events'] as $item) {
            $ev = $item['event'];
            $t = $item['totals'];
            $dateLabel = $ev['date'] ?? '—';
            if (! empty($ev['end_date']) && $ev['end_date'] !== $ev['date']) {
                $dateLabel .= ' – '.$ev['end_date'];
            }

            $metaRows = [
                ['Status', $ev['status'] ?? '—'],
                ['Date', $dateLabel],
                ['Time', trim(($ev['start_time'] ?? '').($ev['expected_end_time'] ? ' – '.$ev['expected_end_time'] : '')) ?: '—'],
                ['Location', $ev['location_name'] ?: '—'],
                ['Client', $ev['client'] ?: '—'],
                ['Team leader', $ev['team_leader'] ?: '—'],
                ['Daily allowance', $ev['daily_allowance'] !== null ? 'KES '.number_format((float) $ev['daily_allowance'], 2) : '—'],
                ['Per diem enabled', ! empty($ev['per_diem_enabled']) ? 'Yes' : 'No'],
            ];
            $metaHtml = '';
            foreach ($metaRows as [$label, $value]) {
                $metaHtml .= '<tr><th>'.e($label).'</th><td>'.e((string) $value).'</td></tr>';
            }
            if (! empty($ev['description'])) {
                $metaHtml .= '<tr><th>Description</th><td>'.e((string) $ev['description']).'</td></tr>';
            }
            if (! empty($ev['end_comment'])) {
                $metaHtml .= '<tr><th>End comment</th><td>'.e((string) $ev['end_comment']).'</td></tr>';
            }

            $crewRowsHtml = '';
            foreach ($item['crew'] as $c) {
                $crewRowsHtml .= '<tr>'
                    .'<td>'.e((string) ($c['name'] ?? '—')).'</td>'
                    .'<td>'.e((string) ($c['role_in_event'] ?? '—')).'</td>'
                    .'<td>'.e((string) ($c['checkin_time'] ?? '—')).'</td>'
                    .'<td>'.e((string) ($c['checkout_time'] ?? '—')).'</td>'
                    .'<td style="text-align:right;">'.e($c['total_hours'] !== null ? (string) $c['total_hours'] : '—').'</td>'
                    .'<td style="text-align:right;">'.e($c['extra_hours'] !== null ? (string) $c['extra_hours'] : '—').'</td>'
                    .'<td>'.e((string) ($c['transport_type'] ?? '—')).'</td>'
                    .'<td style="text-align:right;">'.($c['transport_amount'] !== null ? number_format((float) $c['transport_amount'], 2) : '—').'</td>'
                    .'</tr>';
            }
            if ($crewRowsHtml === '') {
                $crewRowsHtml = '<tr><td colspan="8">No crew assigned.</td></tr>';
            }

            $allowanceRowsHtml = '';
            foreach ($item['earned_allowances'] as $a) {
                $desc = trim((string) ($a['description'] ?? ''));
                if (! empty($a['meal_slot'])) {
                    $desc = trim($desc.' ['.$a['meal_slot'].($a['meal_grant_date'] ? ' '.$a['meal_grant_date'] : '').']');
                }
                $allowanceRowsHtml .= '<tr>'
                    .'<td>'.e((string) ($a['crew_name'] ?? '—')).'</td>'
                    .'<td>'.e((string) ($a['allowance_type'] ?? '—')).'</td>'
                    .'<td style="text-align:right;">'.number_format((float) ($a['amount'] ?? 0), 2).'</td>'
                    .'<td>'.e((string) ($a['status'] ?? '—')).'</td>'
                    .'<td>'.e((string) ($a['source'] ?? '—')).'</td>'
                    .'<td>'.e($desc !== '' ? $desc : '—').'</td>'
                    .'<td>'.e((string) ($a['recorded_at'] ?? '—')).'</td>'
                    .'</tr>';
            }
            if ($allowanceRowsHtml === '') {
                $allowanceRowsHtml = '<tr><td colspan="7">No earned allowances recorded.</td></tr>';
            }

            $paymentRowsHtml = '';
            foreach ($item['payments'] as $p) {
                $paymentRowsHtml .= '<tr>'
                    .'<td>'.e((string) ($p['crew_name'] ?? '—')).'</td>'
                    .'<td>'.e((string) ($p['purpose'] ?? '—')).'</td>'
                    .'<td>'.e((string) ($p['payment_date'] ?? '—')).'</td>'
                    .'<td style="text-align:right;">'.number_format((float) ($p['allowances'] ?? 0), 2).'</td>'
                    .'<td style="text-align:right;">'.number_format((float) ($p['per_diem'] ?? 0), 2).'</td>'
                    .'<td style="text-align:right;">'.number_format((float) ($p['total_amount'] ?? 0), 2).'</td>'
                    .'<td>'.e((string) ($p['status'] ?? '—')).'</td>'
                    .'</tr>';
            }
            if ($paymentRowsHtml === '') {
                $paymentRowsHtml = '<tr><td colspan="7">No payment requests.</td></tr>';
            }

            $expenseRowsHtml = '';
            foreach ($item['expenses'] as $x) {
                $expenseRowsHtml .= '<tr>'
                    .'<td>'.e((string) ($x['crew_name'] ?? '—')).'</td>'
                    .'<td>'.(! empty($x['used_company_transport']) ? 'Yes' : 'No').'</td>'
                    .'<td style="text-align:right;">'.number_format((float) ($x['cab_amount'] ?? 0), 2).'</td>'
                    .'<td style="text-align:right;">'.number_format((float) ($x['parking_fee'] ?? 0), 2).'</td>'
                    .'<td style="text-align:right;">'.number_format((float) ($x['total'] ?? 0), 2).'</td>'
                    .'</tr>';
            }
            if ($expenseRowsHtml === '') {
                $expenseRowsHtml = '<tr><td colspan="5">No cab/parking expenses.</td></tr>';
            }

            $sections .= '<section class="event-block">'
                .'<h2>'.e((string) ($ev['name'] ?? 'Event')).'</h2>'
                .'<div class="kpi-grid">'
                .'<div class="kpi"><span class="k">Earned allowances</span><span class="v">KES '.number_format((float) $t['earned_allowances_total'], 2).'</span></div>'
                .'<div class="kpi"><span class="k">Approved / paid</span><span class="v">KES '.number_format((float) $t['earned_allowances_approved_paid'], 2).'</span></div>'
                .'<div class="kpi"><span class="k">Payment totals</span><span class="v">KES '.number_format((float) $t['payment_grand_total'], 2).'</span></div>'
                .'<div class="kpi"><span class="k">Expenses + transport</span><span class="v">KES '.number_format((float) $t['expenses_total'] + (float) $t['transport_total'], 2).'</span></div>'
                .'</div>'
                .'<h3>Event details</h3>'
                .'<table class="meta-table"><tbody>'.$metaHtml.'</tbody></table>'
                .'<h3>Crew & attendance</h3>'
                .'<table><thead><tr><th>Crew</th><th>Role</th><th>Check-in</th><th>Check-out</th><th style="text-align:right;">Hours</th><th style="text-align:right;">Extra</th><th>Transport</th><th style="text-align:right;">Transport (KES)</th></tr></thead><tbody>'.$crewRowsHtml.'</tbody></table>'
                .'<h3>Earned allowances (full breakdown)</h3>'
                .'<table><thead><tr><th>Crew</th><th>Type</th><th style="text-align:right;">Amount (KES)</th><th>Status</th><th>Source</th><th>Description</th><th>Recorded</th></tr></thead><tbody>'.$allowanceRowsHtml.'</tbody></table>'
                .'<h3>Payment requests</h3>'
                .'<table><thead><tr><th>Crew</th><th>Purpose</th><th>Date</th><th style="text-align:right;">Allowances</th><th style="text-align:right;">Per diem</th><th style="text-align:right;">Total</th><th>Status</th></tr></thead><tbody>'.$paymentRowsHtml.'</tbody></table>'
                .'<h3>Cab / parking expenses</h3>'
                .'<table><thead><tr><th>Crew</th><th>Company transport</th><th style="text-align:right;">Cab</th><th style="text-align:right;">Parking</th><th style="text-align:right;">Total</th></tr></thead><tbody>'.$expenseRowsHtml.'</tbody></table>'
                .'</section>';
        }

        if ($sections === '') {
            $sections = '<p>No events found for the selected filters.</p>';
        }

        $signatureHtml = '<div class="sig-wrap">'
            .'<div class="sig-card"><div class="sig-label">Confirmed by</div><div class="sig-value">'.e($confirmedBy !== '' ? $confirmedBy : '________________________').'</div></div>'
            .'<div class="sig-card"><div class="sig-label">Signature</div><div class="sig-value">'.e($signature !== '' ? $signature : '________________________').'</div></div>'
            .'<div class="sig-card"><div class="sig-label">Date</div><div class="sig-value">'.e(now()->format('Y-m-d H:i')).'</div></div>'
            .'</div>';

        return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'.e($title).'</title><style>
body{font-family:system-ui,sans-serif;margin:24px;color:#111;}
h1{font-size:1.5rem;margin-bottom:4px;}
h2{font-size:1.25rem;margin:28px 0 8px;color:#0f1838;border-bottom:2px solid #ca8a04;padding-bottom:4px;}
h3{font-size:1rem;margin:18px 0 8px;color:#1e2d5c;}
.meta{color:#666;font-size:0.875rem;margin-bottom:20px;}
table{border-collapse:collapse;width:100%;margin-top:8px;margin-bottom:12px;font-size:13px;}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;vertical-align:top;}
th{background:#f5f5f5;font-weight:600;}
.meta-table th{width:180px;}
.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:10px;margin:12px 0 16px;}
.kpi{border:1px solid #ddd;border-radius:10px;padding:10px 12px;background:#fbfbfb;}
.kpi .k{display:block;color:#555;font-size:12px;margin-bottom:4px;}
.kpi .v{display:block;font-size:16px;font-weight:700;color:#0f1838;}
.event-block{page-break-inside:avoid;margin-bottom:28px;}
.sig-wrap{display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));gap:10px;margin-top:24px;}
.sig-card{border:1px solid #ddd;border-radius:10px;padding:10px 12px;min-height:72px;}
.sig-label{font-size:12px;color:#666;margin-bottom:8px;}
.sig-value{font-size:14px;font-weight:600;}
@media print{body{margin:12px;} .no-print{display:none;}}
</style></head><body>
<h1>'.e($title).'</h1>
<p class="meta">Period: '.e($period).' | Generated: '.e($generatedAt).'</p>
<div class="kpi-grid">
<div class="kpi"><span class="k">Events</span><span class="v">'.(int) $summary['events_count'].'</span></div>
<div class="kpi"><span class="k">Earned allowances</span><span class="v">KES '.number_format((float) $summary['earned_allowances_total'], 2).'</span></div>
<div class="kpi"><span class="k">Approved / paid</span><span class="v">KES '.number_format((float) $summary['earned_allowances_approved_paid'], 2).'</span></div>
<div class="kpi"><span class="k">Combined outflow</span><span class="v">KES '.number_format((float) $summary['combined_outflow'], 2).'</span></div>
</div>
'.$sections.'
'.$signatureHtml.'
<p class="meta" style="margin-top:24px;">Stagepass Full Event Report – '.e($generatedAt).'</p>
</body></html>';
    }

    private function attendanceReport(Carbon $from, Carbon $to, ?int $eventId = null, ?int $userId = null): array
    {
        $query = EventUser::query()
            ->whereNotNull('checkin_time')
            ->whereHas('event', fn ($q) => $q->spansRange($from->toDateString(), $to->toDateString()));
        if ($eventId) {
            $query->where('event_id', $eventId);
        }
        if ($userId) {
            $query->where('user_id', $userId);
        }
        $assignments = $query->get();

        $totalHours = 0;
        $totalExtraHours = 0;
        $byDay = [];
        foreach ($assignments as $a) {
            $hours = (float) ($a->total_hours ?? 0);
            $extraHours = (float) ($a->extra_hours ?? 0);
            $totalHours += $hours;
            $totalExtraHours += $extraHours;
            $date = $a->event?->date?->format('Y-m-d');
            if ($date) {
                if (! isset($byDay[$date])) {
                    $byDay[$date] = ['date' => $date, 'checkins' => 0, 'hours' => 0, 'extra_hours' => 0];
                }
                $byDay[$date]['checkins']++;
                $byDay[$date]['hours'] += $hours;
                $byDay[$date]['extra_hours'] += $extraHours;
            }
        }
        ksort($byDay);

        return [
            'summary' => [
                'total_checkins' => $assignments->count(),
                'total_hours' => round($totalHours, 2),
                'total_extra_hours' => round($totalExtraHours, 2),
            ],
            'by_day' => array_values($byDay),
        ];
    }

    private function officeCheckinsReport(Carbon $from, Carbon $to): array
    {
        $checkins = DailyOfficeCheckin::query()
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->with('user:id,name')
            ->orderBy('date')->orderBy('checkin_time')
            ->get();

        $byUser = [];
        $byDay = [];
        foreach ($checkins as $c) {
            $date = $c->date->format('Y-m-d');
            $userName = $c->user?->name ?? 'User #' . $c->user_id;
            if (! isset($byUser[$userName])) {
                $byUser[$userName] = ['user' => $userName, 'user_id' => $c->user_id, 'days' => 0, 'checkins' => []];
            }
            $byUser[$userName]['days']++;
            $byUser[$userName]['checkins'][] = ['date' => $date, 'checkin_time' => $c->checkin_time->format('H:i')];
            $byDay[$date] = ($byDay[$date] ?? 0) + 1;
        }
        ksort($byDay);
        $byDayList = array_map(fn ($date, $count) => ['date' => $date, 'count' => $count], array_keys($byDay), array_values($byDay));

        return [
            'summary' => ['total_office_checkins' => $checkins->count(), 'unique_days' => count($byDay)],
            'by_user' => array_values($byUser),
            'by_day' => array_values($byDayList),
        ];
    }

    private function arrivalReport(Carbon $from, Carbon $to, ?int $eventId = null): array
    {
        $query = EventUser::query()
            ->whereNotNull('checkin_time')
            ->whereHas('event', fn ($q) => $q->spansRange($from->toDateString(), $to->toDateString()))
            ->with(['event:id,name,date,end_date', 'user:id,name']);
        if ($eventId) {
            $query->where('event_id', $eventId);
        }
        $arrivals = $query->get();

        $byDay = [];
        $byEvent = [];
        foreach ($arrivals as $a) {
            $date = $a->checkin_time?->format('Y-m-d') ?? $a->event?->date?->format('Y-m-d');
            if ($date) {
                $byDay[$date] = ($byDay[$date] ?? 0) + 1;
            }
            $eventName = $a->event?->name ?? 'Event #' . $a->event_id;
            if (! isset($byEvent[$eventName])) {
                $byEvent[$eventName] = ['event' => $eventName, 'arrivals' => 0];
            }
            $byEvent[$eventName]['arrivals']++;
        }
        ksort($byDay);
        $byDayList = array_map(fn ($date, $count) => ['date' => $date, 'count' => $count], array_keys($byDay), array_values($byDay));

        return [
            'summary' => ['total_arrivals' => $arrivals->count()],
            'by_day' => array_values($byDayList),
            'by_event' => array_values($byEvent),
        ];
    }
}
