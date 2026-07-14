<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyOfficeCheckin;
use App\Models\Event;
use App\Models\EventAttendanceSession;
use App\Models\EventExpense;
use App\Models\EventAllowance;
use App\Models\EventMeal;
use App\Models\EventPayment;
use App\Models\EventEquipment;
use App\Models\EventUser;
use App\Models\Task;
use App\Services\AttendanceOvertimeService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ReportsController extends Controller
{
    private const REPORT_TYPES = ['events', 'crew-attendance', 'crew-payments', 'tasks', 'financial', 'end-of-day', 'full-event', 'allowances'];

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
     *
     * Completed multi-day shifts live in event_attendance_sessions (pivot is cleared after checkout).
     * Single-day / open shifts still live on event_user.
     */
    public function crewAttendance(Request $request): JsonResponse
    {
        if (! $this->canAccessReports($request)) {
            return response()->json(['message' => 'You do not have access to reports.'], 403);
        }

        [$from, $to] = $this->parseDateRange($request);
        $eventId = $request->filled('event_id') ? (int) $request->event_id : null;
        $userId = $request->filled('user_id') ? (int) $request->user_id : null;

        $built = $this->buildCrewAttendanceReport($from, $to, $eventId, $userId);
        $rows = $built['rows'];
        $summary = $built['summary'];
        $byDay = $built['by_day'];

        $perPage = min((int) $request->input('per_page', 50), 100);
        $page = max(1, (int) $request->input('page', 1));
        $total = $rows->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        if ($page > $lastPage) {
            $page = $lastPage;
        }
        $pageRows = $rows->forPage($page, $perPage)->values()->all();

        return response()->json([
            'summary' => $summary,
            'by_day' => $byDay,
            'data' => $pageRows,
            'pagination' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
            ],
        ]);
    }

    /**
     * Merge attendance sessions + open/legacy event_user check-ins for reporting.
     *
     * @return array{rows: Collection<int, array<string, mixed>>, summary: array<string, mixed>, by_day: list<array<string, mixed>>}
     */
    private function buildCrewAttendanceReport(
        Carbon $from,
        Carbon $to,
        ?int $eventId = null,
        ?int $userId = null
    ): array {
        $assignments = EventUser::query()
            ->with(['event:id,name,date,end_date,start_time', 'user:id,name,email'])
            ->whereHas('event', fn ($q) => $q->spansRange($from->toDateString(), $to->toDateString()))
            ->when($eventId, fn ($q) => $q->where('event_id', $eventId))
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->get();

        $eventIds = $assignments->pluck('event_id')->unique()->filter()->values();

        $sessions = $eventIds->isEmpty()
            ? collect()
            : EventAttendanceSession::query()
                ->with(['event:id,name,date,end_date', 'user:id,name'])
                ->whereIn('event_id', $eventIds)
                ->when($userId, fn ($q) => $q->where('user_id', $userId))
                ->orderByDesc('checkin_time')
                ->get();

        $overtime = app(AttendanceOvertimeService::class);
        $rows = collect();
        $attendedKeys = [];

        foreach ($sessions as $session) {
            /** @var EventAttendanceSession $session */
            $key = $session->event_id.'-'.$session->user_id;
            $attendedKeys[$key] = true;
            $workDate = $session->work_date?->format('Y-m-d');
            $rows->push([
                'id' => (int) $session->id,
                'source' => 'session',
                'event_id' => (int) $session->event_id,
                'user_id' => (int) $session->user_id,
                'work_date' => $workDate,
                'checkin_time' => $session->checkin_time?->timezone('Africa/Nairobi')->format('Y-m-d H:i'),
                'checkout_time' => $session->checkout_time?->timezone('Africa/Nairobi')->format('Y-m-d H:i'),
                'total_hours' => $session->total_hours !== null ? (float) $session->total_hours : null,
                'extra_hours' => $session->extra_hours !== null ? (float) $session->extra_hours : null,
                'pause_duration' => $session->pause_duration !== null ? (int) $session->pause_duration : null,
                'is_sunday' => (bool) $session->is_sunday,
                'is_holiday' => (bool) $session->is_holiday,
                'holiday_name' => $session->holiday_name,
                'event' => $session->event ? [
                    'id' => $session->event->id,
                    'name' => $session->event->name,
                    'date' => $session->event->date?->format('Y-m-d'),
                ] : null,
                'user' => $session->user ? [
                    'id' => $session->user->id,
                    'name' => $session->user->name,
                ] : null,
            ]);
        }

        foreach ($assignments as $assignment) {
            /** @var EventUser $assignment */
            if (! $assignment->checkin_time) {
                continue;
            }

            $key = $assignment->event_id.'-'.$assignment->user_id;
            $attendedKeys[$key] = true;

            $totalHours = $assignment->total_hours !== null ? (float) $assignment->total_hours : null;
            $extraHours = $assignment->extra_hours !== null ? (float) $assignment->extra_hours : null;
            $pause = (int) ($assignment->pause_duration ?? 0);
            if ($assignment->checkin_time && ! $assignment->checkout_time) {
                if ($assignment->is_paused && $assignment->pause_start_time) {
                    $pause += (int) Carbon::parse($assignment->pause_start_time)->diffInMinutes(now());
                }
                $calc = $overtime->calculate(
                    Carbon::parse($assignment->checkin_time),
                    now(),
                    null,
                    $pause
                );
                $totalHours = (float) $calc['total_hours'];
                $extraHours = (float) $calc['extra_hours'];
            }

            $workDate = Carbon::parse($assignment->checkin_time)
                ->timezone('Africa/Nairobi')
                ->format('Y-m-d');

            $rows->push([
                'id' => (int) $assignment->id,
                'source' => 'assignment',
                'event_id' => (int) $assignment->event_id,
                'user_id' => (int) $assignment->user_id,
                'work_date' => $workDate,
                'checkin_time' => $assignment->checkin_time->timezone('Africa/Nairobi')->format('Y-m-d H:i'),
                'checkout_time' => $assignment->checkout_time
                    ? $assignment->checkout_time->timezone('Africa/Nairobi')->format('Y-m-d H:i')
                    : null,
                'total_hours' => $totalHours,
                'extra_hours' => $extraHours,
                'pause_duration' => $pause,
                'transport_type' => $assignment->transport_type,
                'transport_amount' => $assignment->transport_amount !== null ? (float) $assignment->transport_amount : null,
                'is_sunday' => (bool) $assignment->is_sunday,
                'is_holiday' => (bool) $assignment->is_holiday,
                'holiday_name' => $assignment->holiday_name,
                'event' => $assignment->event ? [
                    'id' => $assignment->event->id,
                    'name' => $assignment->event->name,
                    'date' => $assignment->event->date?->format('Y-m-d'),
                ] : null,
                'user' => $assignment->user ? [
                    'id' => $assignment->user->id,
                    'name' => $assignment->user->name,
                ] : null,
            ]);
        }

        foreach ($assignments as $assignment) {
            $key = $assignment->event_id.'-'.$assignment->user_id;
            if (isset($attendedKeys[$key])) {
                continue;
            }
            $rows->push([
                'id' => (int) $assignment->id,
                'source' => 'missed',
                'event_id' => (int) $assignment->event_id,
                'user_id' => (int) $assignment->user_id,
                'work_date' => $assignment->event?->date?->format('Y-m-d'),
                'checkin_time' => null,
                'checkout_time' => null,
                'total_hours' => null,
                'extra_hours' => null,
                'pause_duration' => null,
                'transport_type' => $assignment->transport_type,
                'transport_amount' => $assignment->transport_amount !== null ? (float) $assignment->transport_amount : null,
                'event' => $assignment->event ? [
                    'id' => $assignment->event->id,
                    'name' => $assignment->event->name,
                    'date' => $assignment->event->date?->format('Y-m-d'),
                ] : null,
                'user' => $assignment->user ? [
                    'id' => $assignment->user->id,
                    'name' => $assignment->user->name,
                ] : null,
            ]);
        }

        $rows = $rows->sortByDesc(function (array $row) {
            return $row['checkin_time'] ?? ($row['work_date'] ?? '').' 00:00';
        })->values();

        $checkedInRows = $rows->filter(fn (array $r) => ! empty($r['checkin_time']));
        $missedCount = $assignments->filter(
            fn (EventUser $a) => ! isset($attendedKeys[$a->event_id.'-'.$a->user_id])
        )->count();
        $attendedAssignmentCount = $assignments->count() - $missedCount;

        $totalHours = (float) $checkedInRows->sum(fn (array $r) => (float) ($r['total_hours'] ?? 0));
        $totalExtraHours = (float) $checkedInRows->sum(fn (array $r) => (float) ($r['extra_hours'] ?? 0));
        $totalPauseMinutes = (int) $checkedInRows->sum(fn (array $r) => (int) ($r['pause_duration'] ?? 0));
        $transportCostTotal = (float) $assignments->sum(fn (EventUser $a) => (float) ($a->transport_amount ?? 0));

        $byDay = [];
        foreach ($checkedInRows as $row) {
            $date = $row['work_date'] ?? ($row['event']['date'] ?? null);
            if (! $date) {
                continue;
            }
            if (! isset($byDay[$date])) {
                $byDay[$date] = ['date' => $date, 'checkins' => 0, 'hours' => 0.0, 'extra_hours' => 0.0];
            }
            $byDay[$date]['checkins']++;
            $byDay[$date]['hours'] += (float) ($row['total_hours'] ?? 0);
            $byDay[$date]['extra_hours'] += (float) ($row['extra_hours'] ?? 0);
        }
        ksort($byDay);

        return [
            'rows' => $rows,
            'summary' => [
                'total_assignments' => $assignments->count(),
                'total_checkins' => $checkedInRows->count(),
                'missed_checkins' => $missedCount,
                'participation_rate' => $assignments->count() > 0
                    ? round(100 * $attendedAssignmentCount / $assignments->count(), 1)
                    : 0,
                'total_hours' => round($totalHours, 2),
                'total_extra_hours' => round($totalExtraHours, 2),
                'total_pause_minutes' => $totalPauseMinutes,
                'active_hours' => round(max(0, $totalHours - ($totalPauseMinutes / 60)), 2),
                'transport_cost_total' => round($transportCostTotal, 2),
            ],
            'by_day' => array_values($byDay),
        ];
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
     * GET /reports/allowances - Allowances-only report (meals + other earned allowances).
     */
    public function allowances(Request $request): JsonResponse
    {
        if (! $this->canAccessReports($request)) {
            return response()->json(['message' => 'You do not have access to reports.'], 403);
        }

        [$from, $to] = $this->parseDateRange($request);
        $eventId = $request->filled('event_id') ? (int) $request->event_id : null;
        $userId = $request->filled('user_id') ? (int) $request->user_id : null;
        $built = $this->buildAllowancesReport($from, $to, $eventId, $userId);

        $perPage = min((int) $request->input('per_page', 50), 100);
        $page = max(1, (int) $request->input('page', 1));
        $rows = $built['rows'];
        $total = $rows->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        if ($page > $lastPage) {
            $page = $lastPage;
        }

        return response()->json([
            'summary' => $built['summary'],
            'by_slot' => $built['by_slot'],
            'data' => $rows->forPage($page, $perPage)->values()->all(),
            'pagination' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
            ],
        ]);
    }

    /**
     * @return array{rows: Collection<int, array<string, mixed>>, summary: array<string, mixed>, by_slot: list<array<string, mixed>>}
     */
    private function buildAllowancesReport(
        Carbon $from,
        Carbon $to,
        ?int $eventId = null,
        ?int $userId = null
    ): array {
        $query = EventAllowance::query()
            ->with(['crew:id,name', 'type:id,name', 'event:id,name,date', 'recorder:id,name'])
            ->whereHas('event', fn ($q) => $q->spansRange($from->toDateString(), $to->toDateString()))
            ->when($eventId, fn ($q) => $q->where('event_id', $eventId))
            ->when($userId, fn ($q) => $q->where('crew_id', $userId))
            ->orderByDesc('recorded_at')
            ->orderByDesc('id');

        $all = $query->get();
        $eventIds = $all->pluck('event_id')->unique()->filter()->values();
        $crewIds = $all->pluck('crew_id')->unique()->filter()->values();

        $sessions = ($eventIds->isEmpty() || $crewIds->isEmpty())
            ? collect()
            : EventAttendanceSession::query()
                ->whereIn('event_id', $eventIds)
                ->whereIn('user_id', $crewIds)
                ->get();

        $openAssignments = ($eventIds->isEmpty() || $crewIds->isEmpty())
            ? collect()
            : EventUser::query()
                ->whereIn('event_id', $eventIds)
                ->whereIn('user_id', $crewIds)
                ->whereNotNull('checkin_time')
                ->get();

        $timesLookup = static function (int $eventId, int $userId, ?string $workDate) use ($sessions, $openAssignments): array {
            $fmt = static function ($dt): ?string {
                if ($dt === null) {
                    return null;
                }

                return Carbon::parse($dt)->timezone('Africa/Nairobi')->format('H:i');
            };

            if ($workDate) {
                $session = $sessions->first(function (EventAttendanceSession $s) use ($eventId, $userId, $workDate) {
                    return (int) $s->event_id === $eventId
                        && (int) $s->user_id === $userId
                        && $s->work_date?->format('Y-m-d') === $workDate;
                });
                if ($session) {
                    return ['time_in' => $fmt($session->checkin_time), 'time_out' => $fmt($session->checkout_time)];
                }
            }

            $session = $sessions
                ->filter(fn (EventAttendanceSession $s) => (int) $s->event_id === $eventId && (int) $s->user_id === $userId)
                ->sortByDesc(fn (EventAttendanceSession $s) => $s->checkin_time?->timestamp ?? 0)
                ->first();
            if ($session) {
                return ['time_in' => $fmt($session->checkin_time), 'time_out' => $fmt($session->checkout_time)];
            }

            $assignment = $openAssignments->first(
                fn (EventUser $a) => (int) $a->event_id === $eventId && (int) $a->user_id === $userId
            );
            if ($assignment?->checkin_time) {
                return [
                    'time_in' => $fmt($assignment->checkin_time),
                    'time_out' => $fmt($assignment->checkout_time),
                ];
            }

            return ['time_in' => null, 'time_out' => null];
        };

        $active = $all->where('status', '!=', EventAllowance::STATUS_REJECTED);
        $meals = $active->filter(fn (EventAllowance $a) => ! empty($a->meal_slot));
        $other = $active->filter(fn (EventAllowance $a) => empty($a->meal_slot));

        $bySlot = [];
        foreach (['breakfast', 'lunch', 'dinner'] as $slot) {
            $slotRows = $meals->where('meal_slot', $slot);
            $bySlot[] = [
                'slot' => $slot,
                'count' => $slotRows->count(),
                'total' => round((float) $slotRows->sum(fn (EventAllowance $a) => (float) $a->amount), 2),
            ];
        }
        $bySlot[] = [
            'slot' => 'other',
            'count' => $other->count(),
            'total' => round((float) $other->sum(fn (EventAllowance $a) => (float) $a->amount), 2),
        ];

        $rows = $all->map(function (EventAllowance $a) use ($timesLookup) {
            $workDate = $a->meal_grant_date?->format('Y-m-d') ?? $a->event?->date?->format('Y-m-d');
            $times = $timesLookup((int) $a->event_id, (int) $a->crew_id, $workDate);

            return [
                'id' => $a->id,
                'event_id' => $a->event_id,
                'event_name' => $a->event?->name ?? '—',
                'event_date' => $a->event?->date?->format('Y-m-d'),
                'crew_id' => $a->crew_id,
                'crew_name' => $a->crew?->name ?? ('Crew #'.$a->crew_id),
                'allowance_type' => $a->type?->name ?? '—',
                'amount' => (float) $a->amount,
                'status' => $a->status,
                'source' => $a->source ?? EventAllowance::SOURCE_MANUAL,
                'description' => $a->description,
                'meal_slot' => $a->meal_slot,
                'meal_grant_date' => $a->meal_grant_date?->format('Y-m-d'),
                'time_in' => $times['time_in'],
                'time_out' => $times['time_out'],
                'recorded_by' => $a->recorder?->name,
                'recorded_at' => $a->recorded_at?->format('Y-m-d H:i'),
            ];
        })->values();

        return [
            'rows' => $rows,
            'summary' => [
                'total_count' => $all->count(),
                'active_count' => $active->count(),
                'rejected_count' => $all->where('status', EventAllowance::STATUS_REJECTED)->count(),
                'meal_count' => $meals->count(),
                'other_count' => $other->count(),
                'meal_total' => round((float) $meals->sum(fn (EventAllowance $a) => (float) $a->amount), 2),
                'other_total' => round((float) $other->sum(fn (EventAllowance $a) => (float) $a->amount), 2),
                'grand_total' => round((float) $active->sum(fn (EventAllowance $a) => (float) $a->amount), 2),
                'breakfast_total' => round((float) $meals->where('meal_slot', 'breakfast')->sum(fn (EventAllowance $a) => (float) $a->amount), 2),
                'lunch_total' => round((float) $meals->where('meal_slot', 'lunch')->sum(fn (EventAllowance $a) => (float) $a->amount), 2),
                'dinner_total' => round((float) $meals->where('meal_slot', 'dinner')->sum(fn (EventAllowance $a) => (float) $a->amount), 2),
            ],
            'by_slot' => $bySlot,
        ];
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
            'allowances' => 'Allowances Report',
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
        } elseif ($type === 'allowances') {
            $html = $this->buildAllowancesExportHtml(
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
                $built = $this->buildCrewAttendanceReport($from, $to, $eventId, $userId);
                $summary = $built['summary'];
                $summaryHtml = '<div class="kpi-grid">'
                    .'<div class="kpi"><span class="k">Assignments</span><span class="v">'.$summary['total_assignments'].'</span></div>'
                    .'<div class="kpi"><span class="k">Check-ins</span><span class="v">'.$summary['total_checkins'].'</span></div>'
                    .'<div class="kpi"><span class="k">Missed</span><span class="v">'.$summary['missed_checkins'].'</span></div>'
                    .'<div class="kpi"><span class="k">Hours</span><span class="v">'.$summary['total_hours'].'</span></div>'
                    .'</div>'
                    .'<p>Participation: <strong>'.$summary['participation_rate'].'%</strong>'
                    .' · Extra hours: <strong>'.$summary['total_extra_hours'].'</strong></p>';
                foreach ($built['rows'] as $a) {
                    $tableRows .= '<tr>'
                        .'<td>'.e((string) ($a['user']['name'] ?? '—')).'</td>'
                        .'<td>'.e((string) ($a['event']['name'] ?? '—')).'</td>'
                        .'<td>'.e((string) ($a['work_date'] ?? '—')).'</td>'
                        .'<td>'.e((string) ($a['checkin_time'] ?? '—')).'</td>'
                        .'<td>'.e((string) ($a['checkout_time'] ?? '—')).'</td>'
                        .'<td style="text-align:right;">'.e($a['total_hours'] !== null ? (string) $a['total_hours'] : '—').'</td>'
                        .'<td style="text-align:right;">'.e($a['extra_hours'] !== null ? (string) $a['extra_hours'] : '—').'</td>'
                        .'</tr>';
                }
                $tableRows = $tableRows ?: '<tr><td colspan="7">No records</td></tr>';
                $tableHeader = '<tr><th>Crew</th><th>Event</th><th>Work date</th><th>Check-in</th><th>Check-out</th><th style="text-align:right;">Hours</th><th style="text-align:right;">Extra</th></tr>';
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
                break;
        }

        if (! isset($tableHeader)) {
            $tableHeader = match ($type) {
                'events' => '<tr><th>Event</th><th>Date</th><th>Status</th></tr>',
                'crew-attendance' => '<tr><th>Crew</th><th>Event</th><th>Work date</th><th>Check-in</th><th>Check-out</th><th style="text-align:right;">Hours</th><th style="text-align:right;">Extra</th></tr>',
                'tasks' => '<tr><th>Task</th><th>Event</th><th>Due date</th><th>Status</th><th>Assignees</th></tr>',
                default => '<tr><th>Item</th><th>Details</th></tr>',
            };
        }

        $signatureHtml = $this->buildProjectLeadSignatureHtml($confirmedBy, $signature);

        return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' . e($title) . '</title><style>
@page{size:A4 portrait;margin:12mm;}
body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;margin:0;color:#111;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
h1{font-size:18px;margin:0 0 4px;color:#0f1838;}
.meta{color:#555;font-size:11px;margin:0 0 12px;}
table{border-collapse:collapse;width:100%;margin-top:10px;table-layout:fixed;}
thead{display:table-header-group;}
th,td{border:1px solid #333;padding:5px 7px;text-align:left;vertical-align:top;font-size:11px;word-wrap:break-word;}
th{background:#eceff4;font-weight:700;}
tr{page-break-inside:avoid;break-inside:avoid;}
.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;margin-bottom:10px;}
.kpi{border:1px solid #ccc;border-radius:8px;padding:8px 10px;background:#f8fafc;}
.kpi .k{display:block;color:#555;font-size:10px;margin-bottom:2px;}
.kpi .v{display:block;font-size:14px;font-weight:700;color:#0f1838;}
'.$this->signatureCss().'
@media print{body{margin:0;} .no-print{display:none!important;}}
@media screen{body{margin:16px;}}
</style></head><body>
<h1>' . e($title) . '</h1>
<p class="meta">Period: ' . e($period) . ' | Generated: ' . e($generatedAt) . '</p>
<div class="summary">' . $summaryHtml . '</div>
<table><thead>' . $tableHeader . '</thead><tbody>' . $tableRows . '</tbody></table>
' . $signatureHtml . '
<p class="meta" style="margin-top:16px;">Stagepass Reports – ' . e($generatedAt) . '</p>
</body></html>';
    }

    /**
     * Shared printable sign-off block for project lead / team leader.
     */
    private function buildProjectLeadSignatureHtml(string $confirmedBy = '', string $signature = ''): string
    {
        $nameValue = $confirmedBy !== '' ? e($confirmedBy) : '&nbsp;';
        $signatureValue = $signature !== '' ? e($signature) : '&nbsp;';
        $dateValue = e(now()->format('Y-m-d'));

        return '<section class="sig-section">'
            .'<h2 class="sig-heading">Project lead sign-off</h2>'
            .'<p class="sig-note">I confirm that I have reviewed this report and that the event details, crew attendance, allowances, payments and expenses are accurate to the best of my knowledge.</p>'
            .'<div class="sig-wrap">'
            .'<div class="sig-card"><div class="sig-label">Project lead name</div><div class="sig-value">'.$nameValue.'</div><div class="sig-line"></div></div>'
            .'<div class="sig-card sig-card-wide"><div class="sig-label">Project lead signature</div><div class="sig-value sig-hand">'.$signatureValue.'</div><div class="sig-line sig-line-tall"></div></div>'
            .'<div class="sig-card"><div class="sig-label">Date</div><div class="sig-value">'.$dateValue.'</div><div class="sig-line"></div></div>'
            .'</div>'
            .'</section>';
    }

    private function signatureCss(): string
    {
        return '.sig-section{margin-top:20px;padding-top:8px;page-break-inside:avoid;break-inside:avoid;}'
            .'.sig-heading{font-size:13px;margin:0 0 4px;color:#0f1838;border-bottom:1px solid #333;padding-bottom:3px;}'
            .'.sig-note{color:#555;font-size:10px;margin:0 0 10px;max-width:60rem;}'
            .'.sig-wrap{display:grid;grid-template-columns:1.2fr 1.6fr 0.9fr;gap:10px;margin-top:6px;}'
            .'.sig-card{border:1px solid #333;border-radius:0;padding:8px 10px;min-height:72px;background:#fff;}'
            .'.sig-card-wide{min-height:88px;}'
            .'.sig-label{font-size:10px;color:#555;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;}'
            .'.sig-value{font-size:12px;font-weight:600;min-height:18px;}'
            .'.sig-hand{font-family:Georgia,"Times New Roman",serif;font-size:16px;font-weight:500;}'
            .'.sig-line{border-bottom:1px solid #334155;margin-top:18px;}'
            .'.sig-line-tall{margin-top:36px;}'
            .'@media (max-width:720px){.sig-wrap{grid-template-columns:1fr;}}'
            .'@media print{.sig-section{margin-top:14px;}.sig-wrap{gap:8px;}.sig-card{min-height:64px;}.sig-card-wide{min-height:80px;}}';
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
     * Paper-style technical crew register rows: meals (B/L/D) + fare to/from/total + time in/out.
     *
     * @param  Collection<int, EventUser>  $crewRows
     * @param  Collection<int, EventAllowance>  $allowanceRows
     * @param  Collection<int, EventMeal>  $mealRows
     * @return list<array<string, mixed>>
     */
    private function buildTechnicalCrewRegisterRows(
        Event $event,
        Collection $crewRows,
        Collection $allowanceRows,
        Collection $mealRows
    ): array {
        $mealAllowancesByCrew = $allowanceRows
            ->filter(function (EventAllowance $a) {
                if (! in_array($a->meal_slot, ['breakfast', 'lunch', 'dinner'], true)) {
                    return false;
                }

                return $a->status !== EventAllowance::STATUS_REJECTED;
            })
            ->groupBy('crew_id');

        $mealsByUser = $mealRows->groupBy('user_id');
        $userIds = $crewRows->pluck('user_id')->unique()->filter()->values();
        $sessionsByUserDate = EventAttendanceSession::query()
            ->where('event_id', $event->id)
            ->when($userIds->isNotEmpty(), fn ($q) => $q->whereIn('user_id', $userIds))
            ->get()
            ->groupBy(fn (EventAttendanceSession $s) => $s->user_id.'|'.($s->work_date?->format('Y-m-d') ?? ''));

        $rows = [];

        foreach ($crewRows as $assignment) {
            /** @var EventUser $assignment */
            $userId = (int) $assignment->user_id;
            $name = $assignment->user?->name ?? ('User #'.$userId);
            $userMeals = $mealsByUser->get($userId, collect());
            $crewMealAllowances = $mealAllowancesByCrew->get($userId, collect());

            $fareTotal = $assignment->transport_amount !== null ? (float) $assignment->transport_amount : null;
            // Fare to / Fare from are not stored separately yet — report Total from recorded cab amount.
            $fareTo = null;
            $fareFrom = null;
            $displayFareTotal = $fareTotal;

            $slotAmountsForDate = function (?string $workDate) use ($crewMealAllowances): array {
                $relevant = $crewMealAllowances->filter(function (EventAllowance $a) use ($workDate) {
                    if ($workDate === null) {
                        return true;
                    }
                    $grantDate = $a->meal_grant_date?->format('Y-m-d');

                    return $grantDate === null || $grantDate === $workDate;
                });

                $sumSlot = static function (string $slot) use ($relevant): ?float {
                    $items = $relevant->filter(fn (EventAllowance $a) => $a->meal_slot === $slot);
                    if ($items->isEmpty()) {
                        return null;
                    }

                    return round((float) $items->sum(fn (EventAllowance $a) => (float) $a->amount), 2);
                };

                return [
                    'breakfast' => $sumSlot('breakfast'),
                    'lunch' => $sumSlot('lunch'),
                    'dinner' => $sumSlot('dinner'),
                ];
            };

            $timesForDate = function (?string $workDate) use ($assignment, $sessionsByUserDate, $userId): array {
                $fmt = static function ($dt): ?string {
                    if ($dt === null) {
                        return null;
                    }

                    return Carbon::parse($dt)->timezone('Africa/Nairobi')->format('H:i');
                };

                $session = $workDate
                    ? $sessionsByUserDate->get($userId.'|'.$workDate)?->first()
                    : null;
                if ($session instanceof EventAttendanceSession) {
                    return [
                        'time_in' => $fmt($session->checkin_time),
                        'time_out' => $fmt($session->checkout_time),
                    ];
                }

                $pivotDate = $assignment->checkin_time
                    ? $assignment->checkin_time->copy()->timezone('Africa/Nairobi')->format('Y-m-d')
                    : null;
                if ($assignment->checkin_time && ($workDate === null || $pivotDate === $workDate)) {
                    return [
                        'time_in' => $fmt($assignment->checkin_time),
                        'time_out' => $fmt($assignment->checkout_time),
                    ];
                }

                // Fallback: any session for this crew on the event (nearest / latest).
                $anySessions = $sessionsByUserDate
                    ->filter(fn ($group, $key) => str_starts_with((string) $key, $userId.'|'))
                    ->flatten(1)
                    ->sortByDesc(fn (EventAttendanceSession $s) => $s->checkin_time?->timestamp ?? 0)
                    ->values();
                if ($workDate) {
                    $sameDay = $anySessions->first(function (EventAttendanceSession $s) use ($workDate) {
                        $d = $s->work_date?->format('Y-m-d')
                            ?? $s->checkin_time?->timezone('Africa/Nairobi')->format('Y-m-d');

                        return $d === $workDate;
                    });
                    if ($sameDay) {
                        return [
                            'time_in' => $fmt($sameDay->checkin_time),
                            'time_out' => $fmt($sameDay->checkout_time),
                        ];
                    }
                }
                $latest = $anySessions->first();
                if ($latest) {
                    return [
                        'time_in' => $fmt($latest->checkin_time),
                        'time_out' => $fmt($latest->checkout_time),
                    ];
                }

                if ($assignment->checkin_time) {
                    return [
                        'time_in' => $fmt($assignment->checkin_time),
                        'time_out' => $fmt($assignment->checkout_time),
                    ];
                }

                return ['time_in' => null, 'time_out' => null];
            };

            if ($userMeals->isEmpty()) {
                $workDates = $sessionsByUserDate
                    ->keys()
                    ->map(function ($k) use ($userId) {
                        if (! str_starts_with((string) $k, $userId.'|')) {
                            return null;
                        }

                        return substr((string) $k, strlen((string) $userId) + 1) ?: null;
                    })
                    ->filter()
                    ->values();
                if ($assignment->checkin_time) {
                    $workDates->push(
                        $assignment->checkin_time->copy()->timezone('Africa/Nairobi')->format('Y-m-d')
                    );
                }
                foreach ($crewMealAllowances as $allowance) {
                    $grantDate = $allowance->meal_grant_date?->format('Y-m-d');
                    if ($grantDate) {
                        $workDates->push($grantDate);
                    }
                }
                $workDates = $workDates->unique()->values();
                if ($workDates->isEmpty()) {
                    $workDates = collect([$event->date?->format('Y-m-d')]);
                }

                foreach ($workDates as $workDate) {
                    $slots = $slotAmountsForDate($workDate);
                    $times = $timesForDate($workDate);
                    $rows[] = [
                        'date' => $workDate,
                        'user_id' => $userId,
                        'name' => $name,
                        'breakfast' => $slots['breakfast'],
                        'lunch' => $slots['lunch'],
                        'dinner' => $slots['dinner'],
                        'fare_to' => $fareTo,
                        'fare_from' => $fareFrom,
                        'fare_total' => $displayFareTotal,
                        'transport_type' => $assignment->transport_type,
                        'time_in' => $times['time_in'],
                        'time_out' => $times['time_out'],
                    ];
                }

                continue;
            }

            foreach ($userMeals as $meal) {
                /** @var EventMeal $meal */
                $workDate = Carbon::parse($meal->work_date)->format('Y-m-d');
                $slots = $slotAmountsForDate($workDate);
                $times = $timesForDate($workDate);
                $rows[] = [
                    'date' => $workDate,
                    'user_id' => $userId,
                    'name' => $name,
                    'breakfast' => $slots['breakfast'],
                    'lunch' => $slots['lunch'],
                    'dinner' => $slots['dinner'],
                    'fare_to' => $fareTo,
                    'fare_from' => $fareFrom,
                    'fare_total' => $displayFareTotal,
                    'transport_type' => $assignment->transport_type,
                    'time_in' => $times['time_in'],
                    'time_out' => $times['time_out'],
                ];
            }

            // Any meal grant dates not covered by EventMeal rows still need a register line.
            $coveredDates = collect($rows)
                ->where('user_id', $userId)
                ->pluck('date')
                ->filter()
                ->unique();
            foreach ($crewMealAllowances as $allowance) {
                $grantDate = $allowance->meal_grant_date?->format('Y-m-d');
                if (! $grantDate || $coveredDates->contains($grantDate)) {
                    continue;
                }
                $slots = $slotAmountsForDate($grantDate);
                $times = $timesForDate($grantDate);
                $rows[] = [
                    'date' => $grantDate,
                    'user_id' => $userId,
                    'name' => $name,
                    'breakfast' => $slots['breakfast'],
                    'lunch' => $slots['lunch'],
                    'dinner' => $slots['dinner'],
                    'fare_to' => $fareTo,
                    'fare_from' => $fareFrom,
                    'fare_total' => $displayFareTotal,
                    'transport_type' => $assignment->transport_type,
                    'time_in' => $times['time_in'],
                    'time_out' => $times['time_out'],
                ];
                $coveredDates->push($grantDate);
            }
        }

        usort($rows, function (array $a, array $b) {
            $dateCmp = strcmp((string) ($a['date'] ?? ''), (string) ($b['date'] ?? ''));
            if ($dateCmp !== 0) {
                return $dateCmp;
            }

            return strcmp((string) ($a['name'] ?? ''), (string) ($b['name'] ?? ''));
        });

        return $rows;
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

        $tasksByEvent = Task::query()
            ->with(['assignees:id,name'])
            ->whereIn('event_id', $eventIds)
            ->when($userId, fn ($q) => $q->whereHas('assignees', fn ($aq) => $aq->where('users.id', $userId)))
            ->orderBy('due_date')
            ->get()
            ->groupBy('event_id');

        $equipmentByEvent = EventEquipment::query()
            ->with('equipment:id,name,serial_number,condition')
            ->whereIn('event_id', $eventIds)
            ->get()
            ->groupBy('event_id');

        $mealsByEvent = EventMeal::query()
            ->whereIn('event_id', $eventIds)
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->orderBy('work_date')
            ->get()
            ->groupBy('event_id');

        $dossier = [];
        $totals = [
            'events_count' => 0,
            'crew_count' => 0,
            'earned_allowances_total' => 0.0,
            'earned_allowances_approved_paid' => 0.0,
            'meal_breakfast_total' => 0.0,
            'meal_lunch_total' => 0.0,
            'meal_dinner_total' => 0.0,
            'other_allowances_total' => 0.0,
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
            $taskRows = $tasksByEvent->get($eid, collect());
            $equipmentRows = $equipmentByEvent->get($eid, collect());
            $mealRows = $mealsByEvent->get($eid, collect());

            $sessionsForEvent = EventAttendanceSession::query()
                ->where('event_id', $eid)
                ->when($userId, fn ($q) => $q->where('user_id', $userId))
                ->orderBy('work_date')
                ->get()
                ->groupBy('user_id');

            $crew = $crewRows->map(function (EventUser $a) use ($sessionsForEvent) {
                $userSessions = $sessionsForEvent->get($a->user_id, collect());
                $firstSession = $userSessions->first();
                $checkin = $a->checkin_time
                    ? $a->checkin_time->timezone('Africa/Nairobi')->format('Y-m-d H:i')
                    : ($firstSession?->checkin_time?->timezone('Africa/Nairobi')->format('Y-m-d H:i'));
                $checkout = $a->checkout_time
                    ? $a->checkout_time->timezone('Africa/Nairobi')->format('Y-m-d H:i')
                    : ($userSessions->last()?->checkout_time?->timezone('Africa/Nairobi')->format('Y-m-d H:i'));
                $sessionHours = (float) $userSessions->sum(fn (EventAttendanceSession $s) => (float) ($s->total_hours ?? 0));
                $sessionExtra = (float) $userSessions->sum(fn (EventAttendanceSession $s) => (float) ($s->extra_hours ?? 0));
                $pivotHours = $a->total_hours !== null ? (float) $a->total_hours : 0.0;
                $pivotExtra = $a->extra_hours !== null ? (float) $a->extra_hours : 0.0;

                return [
                    'user_id' => $a->user_id,
                    'name' => $a->user?->name ?? ('User #'.$a->user_id),
                    'email' => $a->user?->email,
                    'role_in_event' => $a->role_in_event,
                    'checkin_time' => $checkin,
                    'checkout_time' => $checkout,
                    'total_hours' => ($sessionHours + $pivotHours) > 0
                        ? round($sessionHours + $pivotHours, 2)
                        : ($a->checkin_time || $userSessions->isNotEmpty() ? 0.0 : null),
                    'standard_hours' => $a->standard_hours !== null ? (float) $a->standard_hours : null,
                    'extra_hours' => ($sessionExtra + $pivotExtra) > 0
                        ? round($sessionExtra + $pivotExtra, 2)
                        : null,
                    'pause_duration' => $a->pause_duration !== null ? (float) $a->pause_duration : null,
                    'transport_type' => $a->transport_type,
                    'transport_amount' => $a->transport_amount !== null ? (float) $a->transport_amount : null,
                    'sessions' => $userSessions->map(fn (EventAttendanceSession $s) => [
                        'work_date' => $s->work_date?->format('Y-m-d'),
                        'checkin_time' => $s->checkin_time?->timezone('Africa/Nairobi')->format('Y-m-d H:i'),
                        'checkout_time' => $s->checkout_time?->timezone('Africa/Nairobi')->format('Y-m-d H:i'),
                        'total_hours' => $s->total_hours !== null ? (float) $s->total_hours : null,
                        'extra_hours' => $s->extra_hours !== null ? (float) $s->extra_hours : null,
                    ])->values()->all(),
                ];
            })->values()->all();

            $crewRegister = $this->buildTechnicalCrewRegisterRows($event, $crewRows, $allowanceRows, $mealRows);

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

            $tasks = $taskRows->map(function (Task $t) {
                return [
                    'id' => $t->id,
                    'title' => $t->title,
                    'status' => $t->status,
                    'priority' => $t->priority,
                    'due_date' => $t->due_date?->format('Y-m-d'),
                    'assignees' => $t->assignees->pluck('name')->filter()->values()->all(),
                ];
            })->values()->all();

            $equipment = $equipmentRows->map(function (EventEquipment $row) {
                return [
                    'id' => $row->id,
                    'equipment_id' => $row->equipment_id,
                    'name' => $row->equipment?->name ?? ('Equipment #'.$row->equipment_id),
                    'serial_number' => $row->equipment?->serial_number,
                    'condition' => $row->equipment?->condition,
                    'notes' => $row->notes,
                ];
            })->values()->all();

            $earnedActive = $allowanceRows->where('status', '!=', EventAllowance::STATUS_REJECTED);
            $earnedTotal = round($earnedActive->sum(fn ($a) => (float) $a->amount), 2);
            $earnedApprovedPaid = round($allowanceRows
                ->whereIn('status', [EventAllowance::STATUS_APPROVED, EventAllowance::STATUS_PAID])
                ->sum(fn ($a) => (float) $a->amount), 2);
            $mealBreakfastTotal = round($earnedActive->where('meal_slot', 'breakfast')->sum(fn ($a) => (float) $a->amount), 2);
            $mealLunchTotal = round($earnedActive->where('meal_slot', 'lunch')->sum(fn ($a) => (float) $a->amount), 2);
            $mealDinnerTotal = round($earnedActive->where('meal_slot', 'dinner')->sum(fn ($a) => (float) $a->amount), 2);
            $otherAllowancesTotal = round($earnedActive->filter(fn ($a) => empty($a->meal_slot))->sum(fn ($a) => (float) $a->amount), 2);
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
                'crew_register' => $crewRegister,
                'earned_allowances' => $allowances,
                'payments' => $payments,
                'expenses' => $expenses,
                'tasks' => $tasks,
                'equipment' => $equipment,
                'totals' => [
                    'crew_count' => count($crew),
                    'earned_allowances_total' => $earnedTotal,
                    'earned_allowances_approved_paid' => $earnedApprovedPaid,
                    'meal_breakfast_total' => $mealBreakfastTotal,
                    'meal_lunch_total' => $mealLunchTotal,
                    'meal_dinner_total' => $mealDinnerTotal,
                    'other_allowances_total' => $otherAllowancesTotal,
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
            $totals['meal_breakfast_total'] = ($totals['meal_breakfast_total'] ?? 0) + $mealBreakfastTotal;
            $totals['meal_lunch_total'] = ($totals['meal_lunch_total'] ?? 0) + $mealLunchTotal;
            $totals['meal_dinner_total'] = ($totals['meal_dinner_total'] ?? 0) + $mealDinnerTotal;
            $totals['other_allowances_total'] = ($totals['other_allowances_total'] ?? 0) + $otherAllowancesTotal;
            $totals['payment_allowances_total'] += $paymentAllowances;
            $totals['payment_per_diem_total'] += $paymentPerDiem;
            $totals['payment_grand_total'] += $paymentGrand;
            $totals['expenses_total'] += $expensesTotal;
            $totals['transport_total'] += $transportTotal;
        }

        foreach ([
            'earned_allowances_total',
            'earned_allowances_approved_paid',
            'meal_breakfast_total',
            'meal_lunch_total',
            'meal_dinner_total',
            'other_allowances_total',
            'payment_allowances_total',
            'payment_per_diem_total',
            'payment_grand_total',
            'expenses_total',
            'transport_total',
        ] as $key) {
            $totals[$key] = round((float) ($totals[$key] ?? 0), 2);
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

    private function buildAllowancesExportHtml(
        string $title,
        Carbon $from,
        Carbon $to,
        ?int $eventId,
        ?int $userId,
        string $confirmedBy = '',
        string $signature = ''
    ): string {
        $built = $this->buildAllowancesReport($from, $to, $eventId, $userId);
        $summary = $built['summary'];
        $period = $from->format('M j, Y').' – '.$to->format('M j, Y');
        $generatedAt = now()->format('M j, Y g:i A');

        $summaryHtml = '<div class="kpi-grid">'
            .'<div class="kpi"><span class="k">Lines</span><span class="v">'.$summary['active_count'].'</span></div>'
            .'<div class="kpi"><span class="k">Breakfast</span><span class="v">KES '.number_format((float) $summary['breakfast_total'], 2).'</span></div>'
            .'<div class="kpi"><span class="k">Lunch</span><span class="v">KES '.number_format((float) $summary['lunch_total'], 2).'</span></div>'
            .'<div class="kpi"><span class="k">Dinner</span><span class="v">KES '.number_format((float) $summary['dinner_total'], 2).'</span></div>'
            .'<div class="kpi"><span class="k">Other</span><span class="v">KES '.number_format((float) $summary['other_total'], 2).'</span></div>'
            .'<div class="kpi"><span class="k">Grand total</span><span class="v">KES '.number_format((float) $summary['grand_total'], 2).'</span></div>'
            .'</div>';

        $tableRows = '';
                foreach ($built['rows'] as $a) {
                    $tableRows .= '<tr>'
                        .'<td>'.e((string) ($a['event_name'] ?? '—')).'</td>'
                        .'<td>'.e((string) ($a['meal_grant_date'] ?? $a['event_date'] ?? '—')).'</td>'
                        .'<td>'.e((string) ($a['crew_name'] ?? '—')).'</td>'
                        .'<td>'.e((string) ($a['allowance_type'] ?? '—')).'</td>'
                        .'<td>'.e((string) ($a['meal_slot'] ?? '—')).'</td>'
                        .'<td style="text-align:right;">'.number_format((float) ($a['amount'] ?? 0), 2).'</td>'
                        .'<td>'.e((string) ($a['time_in'] ?? '—')).'</td>'
                        .'<td>'.e((string) ($a['time_out'] ?? '—')).'</td>'
                        .'<td>'.e((string) ($a['status'] ?? '—')).'</td>'
                        .'<td>'.e((string) ($a['source'] ?? '—')).'</td>'
                        .'</tr>';
                }
        if ($tableRows === '') {
            $tableRows = '<tr><td colspan="10">No allowances for the selected filters.</td></tr>';
        }

        $tableHeader = '<tr><th>Event</th><th>Date</th><th>Crew</th><th>Type</th><th>Slot</th><th style="text-align:right;">Amount</th><th>Time In</th><th>Time Out</th><th>Status</th><th>Source</th></tr>';
        $signatureHtml = $this->buildProjectLeadSignatureHtml($confirmedBy, $signature);

        return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'.e($title).'</title><style>
@page{size:A4 landscape;margin:10mm;}
body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;margin:0;color:#111;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
h1{font-size:16px;margin:0 0 4px;color:#0f1838;}
.meta{color:#555;font-size:10px;margin:0 0 10px;}
table{border-collapse:collapse;width:100%;margin-top:8px;table-layout:fixed;}
thead{display:table-header-group;}
th,td{border:1px solid #333;padding:4px 6px;text-align:left;vertical-align:top;font-size:10px;word-wrap:break-word;}
th{background:#eceff4;font-weight:700;}
tr{page-break-inside:avoid;break-inside:avoid;}
.kpi-grid{display:grid;grid-template-columns:repeat(6,minmax(100px,1fr));gap:8px;margin-bottom:10px;}
.kpi{border:1px solid #ccc;padding:8px 10px;background:#f8fafc;}
.kpi .k{display:block;color:#555;font-size:9px;margin-bottom:2px;}
.kpi .v{display:block;font-size:12px;font-weight:700;color:#0f1838;}
'.$this->signatureCss().'
@media print{body{margin:0;} .no-print{display:none!important;}}
@media screen{body{margin:16px;}}
</style></head><body>
<h1>'.e($title).'</h1>
<p class="meta">Period: '.e($period).' · Generated: '.e($generatedAt).'</p>
'.$summaryHtml.'
<table><thead>'.$tableHeader.'</thead><tbody>'.$tableRows.'</tbody></table>
'.$signatureHtml.'
<p class="meta" style="margin-top:12px;">Stagepass Allowances Report – '.e($generatedAt).'</p>
</body></html>';
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

            $register = $item['crew_register'] ?? [];
            $breakfastSum = 0.0;
            $lunchSum = 0.0;
            $dinnerSum = 0.0;
            $fareToSum = 0.0;
            $fareFromSum = 0.0;
            $fareTotalSum = 0.0;
            $crewRowsHtml = '';
            $moneyOrBlank = static function ($n): string {
                if ($n === null || $n === '') {
                    return '';
                }

                return number_format((float) $n, 2);
            };
            foreach ($register as $c) {
                $breakfastSum += (float) ($c['breakfast'] ?? 0);
                $lunchSum += (float) ($c['lunch'] ?? 0);
                $dinnerSum += (float) ($c['dinner'] ?? 0);
                $fareToSum += (float) ($c['fare_to'] ?? 0);
                $fareFromSum += (float) ($c['fare_from'] ?? 0);
                $fareTotalSum += (float) ($c['fare_total'] ?? 0);
                $crewRowsHtml .= '<tr>'
                    .'<td>'.e((string) ($c['date'] ?? '—')).'</td>'
                    .'<td class="name">'.e((string) ($c['name'] ?? '—')).'</td>'
                    .'<td class="r">'.$moneyOrBlank($c['breakfast'] ?? null).'</td>'
                    .'<td class="r">'.$moneyOrBlank($c['lunch'] ?? null).'</td>'
                    .'<td class="r">'.$moneyOrBlank($c['dinner'] ?? null).'</td>'
                    .'<td class="r">'.$moneyOrBlank($c['fare_to'] ?? null).'</td>'
                    .'<td class="r">'.$moneyOrBlank($c['fare_from'] ?? null).'</td>'
                    .'<td class="r">'.$moneyOrBlank($c['fare_total'] ?? null).'</td>'
                    .'<td class="c">'.e((string) ($c['time_in'] ?? '')).'</td>'
                    .'<td class="c">'.e((string) ($c['time_out'] ?? '')).'</td>'
                    .'<td class="sign"></td>'
                    .'</tr>';
            }
            if ($crewRowsHtml === '') {
                $crewRowsHtml = '<tr><td colspan="11" class="muted">No crew assigned.</td></tr>';
            } else {
                $crewRowsHtml .= '<tr class="totals">'
                    .'<td colspan="2"><strong>Totals</strong></td>'
                    .'<td class="r"><strong>'.number_format($breakfastSum, 2).'</strong></td>'
                    .'<td class="r"><strong>'.number_format($lunchSum, 2).'</strong></td>'
                    .'<td class="r"><strong>'.number_format($dinnerSum, 2).'</strong></td>'
                    .'<td class="r"><strong>'.($fareToSum > 0 ? number_format($fareToSum, 2) : '').'</strong></td>'
                    .'<td class="r"><strong>'.($fareFromSum > 0 ? number_format($fareFromSum, 2) : '').'</strong></td>'
                    .'<td class="r"><strong>'.number_format($fareTotalSum, 2).'</strong></td>'
                    .'<td colspan="3"></td>'
                    .'</tr>';
            }

            $otherAllowances = array_values(array_filter(
                $item['earned_allowances'] ?? [],
                static fn ($a) => empty($a['meal_slot'])
            ));
            $allowanceRowsHtml = '';
            $otherAllowanceTotal = 0.0;
            foreach ($otherAllowances as $a) {
                $amount = (float) ($a['amount'] ?? 0);
                $otherAllowanceTotal += $amount;
                $desc = trim((string) ($a['description'] ?? ''));
                $allowanceRowsHtml .= '<tr>'
                    .'<td>'.e((string) ($a['crew_name'] ?? '—')).'</td>'
                    .'<td>'.e((string) ($a['allowance_type'] ?? '—')).'</td>'
                    .'<td class="r">'.number_format($amount, 2).'</td>'
                    .'<td>'.e((string) ($a['status'] ?? '—')).'</td>'
                    .'<td>'.e($desc !== '' ? $desc : '—').'</td>'
                    .'</tr>';
            }

            $paymentRowsHtml = '';
            foreach ($item['payments'] as $p) {
                $paymentRowsHtml .= '<tr>'
                    .'<td>'.e((string) ($p['crew_name'] ?? '—')).'</td>'
                    .'<td>'.e((string) ($p['purpose'] ?? '—')).'</td>'
                    .'<td>'.e((string) ($p['payment_date'] ?? '—')).'</td>'
                    .'<td class="r">'.number_format((float) ($p['allowances'] ?? 0), 2).'</td>'
                    .'<td class="r">'.number_format((float) ($p['per_diem'] ?? 0), 2).'</td>'
                    .'<td class="r">'.number_format((float) ($p['total_amount'] ?? 0), 2).'</td>'
                    .'<td>'.e((string) ($p['status'] ?? '—')).'</td>'
                    .'</tr>';
            }

            $callTime = trim((string) ($ev['start_time'] ?? ''));
            if ($callTime !== '') {
                $callTime = substr($callTime, 0, 5);
            }
            $extraSections = '';
            if ($allowanceRowsHtml !== '') {
                $extraSections .= '<div class="secondary">'
                    .'<h3>Other allowances (non-meal) — KES '.number_format($otherAllowanceTotal, 2).'</h3>'
                    .'<table><thead><tr><th>Crew</th><th>Type</th><th class="r">Amount</th><th>Status</th><th>Description</th></tr></thead>'
                    .'<tbody>'.$allowanceRowsHtml.'</tbody></table></div>';
            }
            if ($paymentRowsHtml !== '') {
                $extraSections .= '<div class="secondary">'
                    .'<h3>Payment requests</h3>'
                    .'<table><thead><tr><th>Crew</th><th>Purpose</th><th>Date</th><th class="r">Allowances</th><th class="r">Per diem</th><th class="r">Total</th><th>Status</th></tr></thead>'
                    .'<tbody>'.$paymentRowsHtml.'</tbody></table></div>';
            }

            $sections .= '<section class="event-block">'
                .'<header class="sheet-head">'
                .'<div class="brand">STAGEPASS AUDIO VISUAL</div>'
                .'<div class="sheet-title">TECHNICAL CREW REGISTER</div>'
                .'</header>'
                .'<table class="form-meta">'
                .'<tr><th>Title of the Event</th><td>'.e((string) ($ev['name'] ?? '—')).'</td>'
                .'<th>Venue</th><td>'.e((string) ($ev['location_name'] ?: '—')).'</td></tr>'
                .'<tr><th>Event Date(s)</th><td>'.e($dateLabel).'</td>'
                .'<th>Call Time</th><td>'.e($callTime !== '' ? $callTime : '—').'</td></tr>'
                .'<tr><th>Project Team Leader</th><td>'.e((string) ($ev['team_leader'] ?: '—')).'</td>'
                .'<th>Status</th><td>'.e((string) ($ev['status'] ?? '—')).'</td></tr>'
                .'</table>'
                .'<div class="mini-kpis">'
                .'<span><strong>Meals:</strong> B '.number_format($breakfastSum, 2)
                .' · L '.number_format($lunchSum, 2)
                .' · D '.number_format($dinnerSum, 2)
                .' (KES '.number_format($breakfastSum + $lunchSum + $dinnerSum, 2).')</span>'
                .'<span><strong>Transport:</strong> KES '.number_format($fareTotalSum, 2).'</span>'
                .'<span><strong>Meal allowances (approved/paid):</strong> KES '.number_format((float) $t['earned_allowances_approved_paid'], 2).'</span>'
                .'</div>'
                .'<table class="register">'
                .'<colgroup>'
                .'<col class="c-date"><col class="c-name">'
                .'<col class="c-meal"><col class="c-meal"><col class="c-meal">'
                .'<col class="c-fare"><col class="c-fare"><col class="c-fare">'
                .'<col class="c-time"><col class="c-time"><col class="c-sign">'
                .'</colgroup>'
                .'<thead>'
                .'<tr>'
                .'<th rowspan="2">Date</th><th rowspan="2">Name</th>'
                .'<th colspan="3">Meals (KES)</th>'
                .'<th colspan="3">Transport (KES)</th>'
                .'<th rowspan="2">Time In</th><th rowspan="2">Time Out</th><th rowspan="2">Sign</th>'
                .'</tr>'
                .'<tr>'
                .'<th>Breakfast</th><th>Lunch</th><th>Dinner</th>'
                .'<th>Fare to</th><th>Fare From</th><th>Total</th>'
                .'</tr>'
                .'</thead><tbody>'.$crewRowsHtml.'</tbody></table>'
                .$extraSections
                .'</section>';
        }

        if ($sections === '') {
            $sections = '<p>No events found for the selected filters.</p>';
        }

        $signatureHtml = $this->buildProjectLeadSignatureHtml($confirmedBy, $signature);

        return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'.e($title).'</title><style>
@page { size: A4 landscape; margin: 8mm 10mm; }
* { box-sizing: border-box; }
html, body { width: 100%; }
body {
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
  margin: 0;
  color: #111;
  font-size: 10px;
  line-height: 1.3;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.doc-title { font-size: 14px; margin: 0 0 2px; color: #0f1838; }
.meta { color: #555; font-size: 9px; margin: 0 0 8px; }
.event-block {
  margin: 0 0 14px;
  padding-bottom: 6px;
  border-bottom: 1px solid #ccc;
  page-break-inside: auto;
  break-inside: auto;
}
.event-block:last-of-type { border-bottom: 0; }
.sheet-head {
  text-align: center;
  margin-bottom: 6px;
  page-break-after: avoid;
  break-after: avoid;
}
.sheet-head .brand {
  font-size: 10px;
  letter-spacing: 0.14em;
  font-weight: 700;
  color: #0f1838;
}
.sheet-head .sheet-title {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.05em;
  margin-top: 1px;
}
.form-meta {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 6px;
  font-size: 9px;
  page-break-after: avoid;
  break-after: avoid;
}
.form-meta th, .form-meta td {
  border: 1px solid #333;
  padding: 3px 5px;
  vertical-align: middle;
}
.form-meta th {
  width: 14%;
  background: #f3f4f6;
  text-align: left;
  font-weight: 600;
}
.form-meta td { width: 36%; }
.mini-kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0 0 6px;
  font-size: 9px;
  page-break-after: avoid;
  break-after: avoid;
}
table.register {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 8px;
  table-layout: fixed;
}
table.register col.c-date { width: 8%; }
table.register col.c-name { width: 18%; }
table.register col.c-meal { width: 7%; }
table.register col.c-fare { width: 8%; }
table.register col.c-time { width: 7%; }
table.register col.c-sign { width: 10%; }
table.register th, table.register td {
  border: 1px solid #333;
  padding: 2px 3px;
  vertical-align: middle;
}
table.register thead { display: table-header-group; }
table.register tfoot { display: table-footer-group; }
table.register th {
  background: #eceff4;
  font-size: 8px;
  text-align: center;
  font-weight: 700;
  line-height: 1.2;
}
table.register td { font-size: 9px; }
table.register td.name { text-align: left; font-weight: 600; word-wrap: break-word; overflow-wrap: anywhere; }
table.register td.c, table.register th { text-align: center; }
table.register td.r { text-align: right; font-variant-numeric: tabular-nums; }
table.register td.sign { height: 18px; }
table.register tr.totals td { background: #f3f4f6; font-size: 9px; }
table.register tbody tr { page-break-inside: avoid; break-inside: avoid; }
.secondary { margin-top: 6px; }
.secondary table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 8px;
  table-layout: fixed;
}
.secondary th, .secondary td {
  border: 1px solid #333;
  padding: 2px 4px;
  font-size: 9px;
  vertical-align: top;
}
h3 {
  font-size: 10px;
  margin: 8px 0 3px;
  color: #0f1838;
}
.secondary table th { background: #f5f5f5; font-size: 8px; text-align: left; }
.secondary td.r, .secondary th.r { text-align: right; }
.muted { text-align: center; color: #666; padding: 8px !important; }
'.$this->signatureCss().'
@media print {
  body { margin: 0; }
  .no-print { display: none !important; }
  a { color: inherit; text-decoration: none; }
  .doc-title, .meta { page-break-after: avoid; }
}
@media screen {
  body { margin: 16px; }
  .event-block { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
}
</style></head><body>
<h1 class="doc-title">'.e($title).'</h1>
<p class="meta">Period: '.e($period).' · Generated: '.e($generatedAt).' · Events: '.(int) $summary['events_count'].' · Combined outflow: KES '.number_format((float) $summary['combined_outflow'], 2).'</p>
'.$sections.'
'.$signatureHtml.'
<p class="meta" style="margin-top:12px;">Stagepass Technical Crew Register – '.e($generatedAt).'</p>
</body></html>';
    }

    private function attendanceReport(Carbon $from, Carbon $to, ?int $eventId = null, ?int $userId = null): array
    {
        $built = $this->buildCrewAttendanceReport($from, $to, $eventId, $userId);
        $summary = $built['summary'];

        return [
            'summary' => [
                'total_checkins' => $summary['total_checkins'],
                'total_hours' => $summary['total_hours'],
                'total_extra_hours' => $summary['total_extra_hours'],
            ],
            'by_day' => $built['by_day'],
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
