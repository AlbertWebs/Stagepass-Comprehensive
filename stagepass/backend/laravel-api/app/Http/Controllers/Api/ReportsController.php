<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventPayment;
use App\Models\EventUser;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('director')) {
            return response()->json(['message' => 'Only management can view reports.'], 403);
        }

        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $from = Carbon::parse($request->from)->startOfDay();
        $to = Carbon::parse($request->to)->endOfDay();

        return response()->json([
            'financial' => $this->financialReport($from, $to),
            'attendance' => $this->attendanceReport($from, $to),
            'events' => $this->eventsReport($from, $to),
            'arrival' => $this->arrivalReport($from, $to),
        ]);
    }

    private function financialReport(Carbon $from, Carbon $to): array
    {
        $payments = EventPayment::query()
            ->with('event')
            ->whereHas('event', fn ($q) => $q->whereBetween('date', [$from->toDateString(), $to->toDateString()]))
            ->get();

        $byStatus = [
            'pending' => ['count' => 0, 'total' => 0],
            'approved' => ['count' => 0, 'total' => 0],
            'rejected' => ['count' => 0, 'total' => 0],
        ];
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

    private function attendanceReport(Carbon $from, Carbon $to): array
    {
        $assignments = EventUser::query()
            ->whereNotNull('checkin_time')
            ->whereHas('event', fn ($q) => $q->whereBetween('date', [$from->toDateString(), $to->toDateString()]))
            ->get();

        $totalHours = 0;
        $byDay = [];
        $checkinsPerDay = [];

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

                $checkinDate = $a->checkin_time?->format('Y-m-d');
                if ($checkinDate) {
                    $checkinsPerDay[$checkinDate] = ($checkinsPerDay[$checkinDate] ?? 0) + 1;
                }
            }
        }

        ksort($byDay);
        ksort($checkinsPerDay);

        return [
            'summary' => [
                'total_checkins' => $assignments->count(),
                'total_hours' => round($totalHours, 2),
            ],
            'by_day' => array_values($byDay),
        ];
    }

    private function eventsReport(Carbon $from, Carbon $to): array
    {
        $events = Event::query()
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->get();

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

    private function arrivalReport(Carbon $from, Carbon $to): array
    {
        $arrivals = EventUser::query()
            ->whereNotNull('checkin_time')
            ->whereHas('event', fn ($q) => $q->whereBetween('date', [$from->toDateString(), $to->toDateString()]))
            ->with(['event:id,name,date', 'user:id,name'])
            ->get();

        $byDay = [];
        $byEvent = [];

        foreach ($arrivals as $a) {
            $date = $a->checkin_time?->format('Y-m-d') ?? $a->event?->date?->format('Y-m-d');
            if ($date) {
                $byDay[$date] = ($byDay[$date] ?? 0) + 1;
            }
            $eventId = $a->event_id;
            $eventName = $a->event?->name ?? "Event #{$eventId}";
            if (! isset($byEvent[$eventName])) {
                $byEvent[$eventName] = ['event' => $eventName, 'arrivals' => 0];
            }
            $byEvent[$eventName]['arrivals']++;
        }

        ksort($byDay);

        $byDayList = [];
        foreach ($byDay as $date => $count) {
            $byDayList[] = ['date' => $date, 'count' => $count];
        }

        return [
            'summary' => [
                'total_arrivals' => $arrivals->count(),
            ],
            'by_day' => $byDayList,
            'by_event' => array_values($byEvent),
        ];
    }
}
