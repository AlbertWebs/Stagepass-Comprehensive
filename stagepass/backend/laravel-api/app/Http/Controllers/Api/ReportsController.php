<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyOfficeCheckin;
use App\Models\Event;
use App\Models\EventPayment;
use App\Models\EventUser;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    private const REPORT_TYPES = ['events', 'crew-attendance', 'crew-payments', 'tasks', 'financial'];

    private function canAccessReports(Request $request): bool
    {
        $user = $request->user();
        return $user && (
            $user->hasRole('super_admin') ||
            $user->hasRole('director') ||
            $user->hasRole('admin') ||
            $user->hasRole('team_leader')
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

        $byDay = [];
        foreach ($withCheckin as $a) {
            $date = $a->event?->date?->format('Y-m-d');
            if ($date) {
                if (! isset($byDay[$date])) {
                    $byDay[$date] = ['date' => $date, 'checkins' => 0, 'hours' => 0.0];
                }
                $byDay[$date]['checkins']++;
                $byDay[$date]['hours'] += (float) ($a->total_hours ?? 0);
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
            default => 'Report',
        };

        $html = $this->buildExportHtml($type, $title, $from, $to, $eventId, $userId);

        if ($request->wantsJson() || $request->input('format') === 'json') {
            return response()->json(['html' => $html, 'title' => $title]);
        }

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="report-' . $type . '-' . $from->format('Y-m-d') . '.html"',
        ]);
    }

    private function buildExportHtml(string $type, string $title, Carbon $from, Carbon $to, ?int $eventId, ?int $userId): string
    {
        $period = $from->format('M j, Y') . ' – ' . $to->format('M j, Y');
        $generatedAt = now()->format('M j, Y g:i A');

        $summaryHtml = '';
        $tableRows = '';

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
                $summaryHtml = '<p>Total assignments: <strong>' . $all->count() . '</strong> | Check-ins: <strong>' . $checkedIn->count() . '</strong> | Missed: <strong>' . ($all->count() - $checkedIn->count()) . '</strong> | Total hours: <strong>' . round($checkedIn->sum(fn ($a) => (float) ($a->total_hours ?? 0)), 2) . '</strong></p>';
                foreach ($baseQuery->orderByDesc('checkin_time')->get() as $a) {
                    $tableRows .= '<tr><td>' . e($a->user?->name ?? '—') . '</td><td>' . e($a->event?->name ?? '—') . '</td><td>' . ($a->checkin_time ? $a->checkin_time->format('Y-m-d H:i') : '—') . '</td><td>' . ($a->checkout_time ? $a->checkout_time->format('Y-m-d H:i') : '—') . '</td><td>' . ($a->total_hours ?? '—') . '</td></tr>';
                }
                $tableRows = $tableRows ?: '<tr><td colspan="5">No records</td></tr>';
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
        }

        if (! isset($tableHeader)) {
            $tableHeader = match ($type) {
                'events' => '<tr><th>Event</th><th>Date</th><th>Status</th></tr>',
                'crew-attendance' => '<tr><th>Crew</th><th>Event</th><th>Check-in</th><th>Check-out</th><th>Hours</th></tr>',
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
@media print{body{margin:12px;} .no-print{display:none;}}
</style></head><body>
<h1>' . e($title) . '</h1>
<p class="meta">Period: ' . e($period) . ' | Generated: ' . e($generatedAt) . '</p>
<div class="summary">' . $summaryHtml . '</div>
<table><thead>' . $tableHeader . '</thead><tbody>' . $tableRows . '</tbody></table>
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
            ],
            'by_day' => array_values($byDay),
        ];
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
        $byDay = [];
        foreach ($assignments as $a) {
            $hours = (float) ($a->total_hours ?? 0);
            $totalHours += $hours;
            $date = $a->event?->date?->format('Y-m-d');
            if ($date) {
                if (! isset($byDay[$date])) {
                    $byDay[$date] = ['date' => $date, 'checkins' => 0, 'hours' => 0];
                }
                $byDay[$date]['checkins']++;
                $byDay[$date]['hours'] += $hours;
            }
        }
        ksort($byDay);

        return [
            'summary' => [
                'total_checkins' => $assignments->count(),
                'total_hours' => round($totalHours, 2),
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
