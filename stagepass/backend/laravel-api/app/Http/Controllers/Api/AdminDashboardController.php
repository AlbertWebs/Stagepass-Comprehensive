<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\B2cPayout;
use App\Models\DailyOfficeCheckin;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\EventPayment;
use App\Models\EventUser;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $today = Carbon::today('Africa/Nairobi');
        $from = isset($validated['from']) ? Carbon::parse($validated['from'], 'Africa/Nairobi')->startOfDay() : $today->copy()->subDays(13)->startOfDay();
        $to = isset($validated['to']) ? Carbon::parse($validated['to'], 'Africa/Nairobi')->endOfDay() : $today->copy()->endOfDay();
        if ($from->diffInDays($to) > 365) {
            return response()->json(['message' => 'Dashboard date range cannot exceed 366 days.'], 422);
        }
        $user = $request->user();
        if (! $user || ! $user->is_active || (! $user->hasSuperAdminAccess() && ! $user->hasPermission('dashboard.view'))) {
            return response()->json(['message' => 'You do not have permission to view the admin dashboard.'], 403);
        }
        $isSuper = $user->hasSuperAdminAccess();
        $isTeamLeader = ! $isSuper && ($user->hasRole('team_leader') || $user->hasRole('teamleader'));
        $canAttendance = $isSuper || $user->hasPermission('attendance.view');
        $canFinance = $isSuper || $user->hasPermission('allowances.view') || $user->hasPermission('payments.view');
        $canEvents = $isSuper || $user->hasPermission('events.view');
        $canTasks = $isSuper || $user->hasPermission('tasks.view');
        $isHr = ! $isSuper && $user->hasPermission('reports.hr.view');
        $isAccounts = ! $isSuper && ! $isHr && $user->hasPermission('reports.financial.view');

        $leaderEvents = collect();
        $workforce = 0;
        if ($isSuper || $isHr) {
            $workforce = User::query()->where('is_active', true)
                ->whereDoesntHave('roles', fn ($query) => $query->whereIn('name', ['super_admin', 'admin', 'director', 'hr', 'accounts']))
                ->count();
        } elseif ($isTeamLeader) {
            $leaderEvents = Event::query()->where(fn ($query) => $query->where('team_leader_id', $user->id)->orWhereHas('crew', fn ($crew) => $crew->where('user_id', $user->id)))->with('crew:id')->get();
            $workforce = $leaderEvents->flatMap(fn ($event) => $event->crew->pluck('id'))->unique()->count();
        }

        $attendance = null;
        if ($canAttendance) {
            $officeRows = DailyOfficeCheckin::query()->with('user:id,name')->whereBetween('date', [$from->toDateString(), $to->toDateString()])
                ->get(['user_id', 'date', 'checkin_time', 'checkout_time', 'total_hours', 'extra_hours']);
        $eventRows = EventUser::query()->with(['user:id,name', 'event:id,name,start_time'])->whereNotNull('checkin_time')
                ->whereBetween('checkin_time', [$from, $to])
                ->get(['user_id', 'event_id', 'checkin_time', 'checkout_time', 'total_hours', 'extra_hours']);

            $days = [];
            $add = function (string $date, int $userId, $hours, $overtime, bool $checkedOut) use (&$days): void {
                $days[$date] ??= ['people' => [], 'checked_out_people' => [], 'working_hours' => 0.0, 'overtime_hours' => 0.0];
                $days[$date]['people'][$userId] = true;
                if ($checkedOut) $days[$date]['checked_out_people'][$userId] = true;
                $days[$date]['working_hours'] += (float) ($hours ?? 0);
                $days[$date]['overtime_hours'] += (float) ($overtime ?? 0);
            };

            foreach ($officeRows as $row) {
                $date = $row->date?->format('Y-m-d') ?? (string) $row->date;
                $add($date, (int) $row->user_id, $row->total_hours, $row->extra_hours, $row->checkout_time !== null);
            }
            foreach ($eventRows as $row) {
                $add($row->checkin_time->timezone('Africa/Nairobi')->toDateString(), (int) $row->user_id, $row->total_hours, $row->extra_hours, $row->checkout_time !== null);
            }

            $trend = [];
            for ($day = $from->copy()->startOfDay(); $day <= $to; $day->addDay()) {
                $key = $day->toDateString();
                $value = $days[$key] ?? ['people' => [], 'checked_out_people' => [], 'working_hours' => 0, 'overtime_hours' => 0];
                $trend[] = [
                    'date' => $key,
                    'present' => count($value['people']),
                    'checked_out' => count($value['checked_out_people']),
                    'working_hours' => round($value['working_hours'], 2),
                    'overtime_hours' => round($value['overtime_hours'], 2),
                ];
            }

            $todayKey = $today->toDateString();
            $todayOffice = DailyOfficeCheckin::query()->with('user:id,name')->whereDate('date', $todayKey)
                ->get(['user_id', 'date', 'checkin_time', 'checkout_time', 'total_hours', 'extra_hours']);
            $todayEvents = EventUser::query()->with(['user:id,name', 'event:id,name,start_time'])->whereNotNull('checkin_time')
                ->whereDate('checkin_time', $todayKey)
                ->get(['user_id', 'event_id', 'checkin_time', 'checkout_time', 'total_hours', 'extra_hours']);
            $presentToday = $todayOffice->pluck('user_id')->merge($todayEvents->pluck('user_id'))->unique()->count();
            $inNow = $todayOffice->filter(fn ($row) => ! $row->checkout_time)->pluck('user_id')
                ->merge($todayEvents->filter(fn ($row) => ! $row->checkout_time)->pluck('user_id'))->unique()->count();
            $checkedOut = $todayOffice->filter(fn ($row) => $row->checkout_time)->pluck('user_id')
                ->merge($todayEvents->filter(fn ($row) => $row->checkout_time)->pluck('user_id'))->unique()->count();
            $missing = $todayOffice->whereNull('checkout_time')->count() + $todayEvents->whereNull('checkout_time')->count();
            $todayValues = [
                'working_hours' => $todayOffice->sum(fn ($row) => (float) ($row->total_hours ?? 0)) + $todayEvents->sum(fn ($row) => (float) ($row->total_hours ?? 0)),
                'overtime_hours' => $todayOffice->sum(fn ($row) => (float) ($row->extra_hours ?? 0)) + $todayEvents->sum(fn ($row) => (float) ($row->extra_hours ?? 0)),
            ];

            $attendance = [
                'present_today' => $presentToday,
                'checked_in_now' => $inNow,
                'checked_out_today' => $checkedOut,
                'missing_checkouts_today' => $missing,
                'working_hours_today' => round($todayValues['working_hours'], 2),
                'overtime_hours_today' => round($todayValues['overtime_hours'], 2),
                'trend' => $trend,
                'daily_rows' => $todayOffice->map(fn ($row) => [
                    'key' => 'office-'.$row->user_id,
                    'employee' => $row->user?->name ?? 'Employee',
                    'location' => 'Office',
                    'expected_time' => null,
                    'checkin_time' => $row->checkin_time?->timezone('Africa/Nairobi')->format('H:i'),
                    'checkout_time' => $row->checkout_time?->timezone('Africa/Nairobi')->format('H:i'),
                    'working_hours' => $row->total_hours === null ? null : (float) $row->total_hours,
                    'overtime_hours' => $row->extra_hours === null ? null : (float) $row->extra_hours,
                    'status' => $row->checkout_time ? 'Checked out' : 'On shift',
                ])->concat($todayEvents->map(fn ($row) => [
                    'key' => 'event-'.$row->event_id.'-'.$row->user_id,
                    'employee' => $row->user?->name ?? 'Employee',
                    'location' => $row->event?->name ?? 'Event',
                    'expected_time' => $row->event?->start_time ? substr((string) $row->event->start_time, 0, 5) : null,
                    'checkin_time' => $row->checkin_time?->timezone('Africa/Nairobi')->format('H:i'),
                    'checkout_time' => $row->checkout_time?->timezone('Africa/Nairobi')->format('H:i'),
                    'working_hours' => $row->total_hours === null ? null : (float) $row->total_hours,
                    'overtime_hours' => $row->extra_hours === null ? null : (float) $row->extra_hours,
                    'status' => $row->checkout_time ? 'Checked out' : 'On shift',
                ]))->values(),
            ];
        }

        $events = null;
        if ($canEvents) {
            $eventQuery = Event::query();
            if ($isTeamLeader) {
                $eventQuery->where(fn ($query) => $query->where('team_leader_id', $user->id)->orWhereHas('crew', fn ($crew) => $crew->where('user_id', $user->id)));
            }
            $events = [
                'upcoming' => (clone $eventQuery)->whereBetween('date', [$from->toDateString(), $to->toDateString()])
                    ->whereDate('date', '>=', $today)->where('status', Event::STATUS_CREATED)->count(),
                'ongoing' => (clone $eventQuery)->spansRange($from->toDateString(), $to->toDateString())
                    ->where('status', Event::STATUS_ACTIVE)->count(),
            ];
        }

        $tasks = null;
        if ($canTasks) {
            $taskQuery = Task::query();
            $taskQuery->whereBetween('created_at', [$from, $to]);
            if ($isTeamLeader) {
                $taskQuery->where(fn ($query) => $query->where('created_by', $user->id)
                    ->orWhereHas('assignees', fn ($assignees) => $assignees->where('users.id', $user->id))
                    ->orWhereHas('event', fn ($event) => $event->where('team_leader_id', $user->id)
                        ->orWhereHas('crew', fn ($crew) => $crew->where('user_id', $user->id))));
            }
            $tasks = [
                'pending' => (clone $taskQuery)->whereIn('status', [Task::STATUS_PENDING, Task::STATUS_IN_PROGRESS])->count(),
                'completed' => (clone $taskQuery)->where('status', Task::STATUS_COMPLETED)->count(),
                'total' => (clone $taskQuery)->count(),
            ];
            $tasks['completion_rate'] = $tasks['total'] > 0 ? round($tasks['completed'] * 100 / $tasks['total'], 1) : 0;
        }

        $finance = null;
        if ($canFinance) {
            $allowanceRows = EventAllowance::query()
                ->whereHas('event', fn ($query) => $query->spansRange($from->toDateString(), $to->toDateString()))
                ->select('status', DB::raw('COUNT(*) as count'), DB::raw('COALESCE(SUM(amount), 0) as total'))
                ->groupBy('status')->get()->keyBy('status');
            $paymentRows = EventPayment::query()
                ->whereHas('event', fn ($query) => $query->spansRange($from->toDateString(), $to->toDateString()))
                ->select('status', DB::raw('COUNT(*) as count'), DB::raw('COALESCE(SUM(total_amount), 0) as total'))
                ->groupBy('status')->get()->keyBy('status');
            $payouts = B2cPayout::query()->where('dry_run', false)->whereBetween('created_at', [$from, $to])
                ->select('status', DB::raw('COUNT(*) as count'), DB::raw('COALESCE(SUM(total_amount), 0) as total'))
                ->groupBy('status')->get()->keyBy('status');

            $monthStart = $from->copy()->startOfMonth();
            $monthEnd = $to->copy()->startOfMonth();
            $allowanceTrendRows = EventAllowance::query()->whereBetween('recorded_at', [$from, $to])->get(['recorded_at', 'amount', 'status']);
            $paymentTrendRows = EventPayment::query()->whereBetween('payment_date', [$from->toDateString(), $to->toDateString()])->get(['payment_date', 'total_amount', 'status']);
            $payoutTrendRows = B2cPayout::query()->where('dry_run', false)->whereBetween('created_at', [$from, $to])->get(['created_at', 'total_amount', 'status']);
            $monthlyTrend = [];
            for ($month = $monthStart->copy(); $month <= $monthEnd; $month->addMonth()) {
                $monthKey = $month->format('Y-m');
                $monthlyTrend[] = [
                    'month' => $month->format('M Y'),
                    'allowances' => round((float) $allowanceTrendRows->filter(fn ($row) => $row->recorded_at?->format('Y-m') === $monthKey)->sum(fn ($row) => (float) $row->amount), 2),
                    'approved_payments' => round((float) $paymentTrendRows->filter(fn ($row) => (string) $row->payment_date?->format('Y-m') === $monthKey && $row->status === EventPayment::STATUS_APPROVED)->sum(fn ($row) => (float) $row->total_amount), 2),
                    'completed_payouts' => round((float) $payoutTrendRows->filter(fn ($row) => $row->created_at?->format('Y-m') === $monthKey && $row->status === B2cPayout::STATUS_COMPLETED)->sum(fn ($row) => (float) $row->total_amount), 2),
                ];
            }

            $finance = [
                'allowances' => [
                    'pending_count' => (int) ($allowanceRows[EventAllowance::STATUS_PENDING]->count ?? 0),
                    'pending_total' => (float) ($allowanceRows[EventAllowance::STATUS_PENDING]->total ?? 0),
                    'approved_count' => (int) ($allowanceRows[EventAllowance::STATUS_APPROVED]->count ?? 0),
                    'approved_total' => (float) ($allowanceRows[EventAllowance::STATUS_APPROVED]->total ?? 0),
                    'paid_count' => (int) ($allowanceRows[EventAllowance::STATUS_PAID]->count ?? 0),
                    'paid_total' => (float) ($allowanceRows[EventAllowance::STATUS_PAID]->total ?? 0),
                    'rejected_count' => (int) ($allowanceRows[EventAllowance::STATUS_REJECTED]->count ?? 0),
                ],
                'payments' => [
                    'pending_count' => (int) ($paymentRows[EventPayment::STATUS_PENDING]->count ?? 0),
                    'approved_count' => (int) ($paymentRows[EventPayment::STATUS_APPROVED]->count ?? 0),
                    'approved_total' => (float) ($paymentRows[EventPayment::STATUS_APPROVED]->total ?? 0),
                ],
                'payouts' => [
                    'completed_total' => (float) ($payouts[B2cPayout::STATUS_COMPLETED]->total ?? 0),
                    'failed_count' => (int) ($payouts[B2cPayout::STATUS_FAILED]->count ?? 0),
                    'pending_total' => (float) (($payouts[B2cPayout::STATUS_PENDING]->total ?? 0) + ($payouts[B2cPayout::STATUS_PROCESSING]->total ?? 0)),
                ],
                'monthly_trend' => $monthlyTrend,
            ];
        }

        $attention = [];
        if ($attendance && $attendance['missing_checkouts_today'] > 0) {
            $attention[] = ['type' => 'attendance', 'label' => 'Missing check-outs', 'count' => $attendance['missing_checkouts_today'], 'href' => '/checkins'];
        }
        if ($finance && $finance['allowances']['pending_count'] > 0) {
            $attention[] = ['type' => 'allowance', 'label' => 'Allowances awaiting review', 'count' => $finance['allowances']['pending_count'], 'href' => '/allowances'];
        }
        if ($finance && $finance['payments']['pending_count'] > 0) {
            $attention[] = ['type' => 'payment', 'label' => 'Payments awaiting approval', 'count' => $finance['payments']['pending_count'], 'href' => '/payments'];
        }

        return response()->json([
            'role' => $isHr ? 'hr' : ($isAccounts ? 'accounts' : ($isTeamLeader ? 'team_leader' : 'super_admin')),
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'timezone' => 'Africa/Nairobi'],
            'workforce' => ['active' => $workforce],
            'attendance' => $attendance,
            'events' => $events,
            'tasks' => $tasks,
            'finance' => $finance,
            'attention' => $attention,
        ]);
    }
}
