<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventPayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    private function canManageEventPayments(Request $request, Event $event): bool
    {
        $user = $request->user();
        if ($user->hasRole('super_admin') || $user->hasRole('director')) {
            return true;
        }
        return (int) $event->team_leader_id === (int) $user->id;
    }

    public function index(Request $request): JsonResponse
    {
        $query = EventPayment::query()->with(['event', 'user', 'approvedBy']);

        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('director')) {
            $query->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                    ->orWhereHas('event', fn ($eq) => $eq->where('team_leader_id', $user->id));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('event_id')) {
            $query->where('event_id', $request->event_id);
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $payments = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json($payments);
    }

    public function initiate(Request $request): JsonResponse
    {
        $request->validate([
            'event_id' => 'required|exists:events,id',
            'user_id' => 'required|exists:users,id',
            'purpose' => 'nullable|string|max:50',
            'hours' => 'required|numeric|min:0',
            'per_diem' => 'nullable|numeric|min:0',
            'allowances' => 'nullable|numeric|min:0',
        ]);

        $event = Event::findOrFail($request->event_id);
        $authUser = $request->user();
        $targetUserId = (int) $request->user_id;

        if ($targetUserId !== $authUser->id) {
            if (! $this->canManageEventPayments($request, $event)) {
                return response()->json(['message' => 'You can only allocate payments for your event crew.'], 403);
            }
            $isCrew = $event->crew()->where('user_id', $targetUserId)->exists();
            if (! $isCrew) {
                return response()->json(['message' => 'User must be a member of the event crew.'], 422);
            }
        } else {
            $isCrew = $event->crew()->where('user_id', $authUser->id)->exists();
            if (! $isCrew) {
                return response()->json(['message' => 'You must be on the event crew to request payment.'], 422);
            }
        }

        $perDiem = (float) ($request->per_diem ?? 0);
        $allowances = (float) ($request->allowances ?? 0);
        $total = $perDiem + $allowances;

        $payment = EventPayment::updateOrCreate(
            [
                'event_id' => $request->event_id,
                'user_id' => $request->user_id,
            ],
            [
                'purpose' => $request->filled('purpose') ? $request->purpose : null,
                'hours' => $request->hours,
                'per_diem' => $perDiem,
                'allowances' => $allowances,
                'total_amount' => $total,
                'status' => EventPayment::STATUS_PENDING,
            ]
        );

        return response()->json($payment->load(['event', 'user']), 201);
    }

    public function approve(Request $request): JsonResponse
    {
        $request->validate(['payment_id' => 'required|exists:event_payments,id']);

        $payment = EventPayment::with('event')->findOrFail($request->payment_id);
        if (! $this->canManageEventPayments($request, $payment->event)) {
            return response()->json(['message' => 'You cannot approve payments for this event.'], 403);
        }
        if ($payment->status !== EventPayment::STATUS_PENDING) {
            return response()->json(['message' => 'Payment is not pending.'], 422);
        }

        $payment->update([
            'status' => EventPayment::STATUS_APPROVED,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        return response()->json($payment->fresh()->load(['event', 'user', 'approvedBy']));
    }

    public function reject(Request $request): JsonResponse
    {
        $request->validate([
            'payment_id' => 'required|exists:event_payments,id',
            'rejection_reason' => 'nullable|string',
        ]);

        $payment = EventPayment::with('event')->findOrFail($request->payment_id);
        if (! $this->canManageEventPayments($request, $payment->event)) {
            return response()->json(['message' => 'You cannot reject payments for this event.'], 403);
        }
        if ($payment->status !== EventPayment::STATUS_PENDING) {
            return response()->json(['message' => 'Payment is not pending.'], 422);
        }

        $payment->update([
            'status' => EventPayment::STATUS_REJECTED,
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => $request->rejection_reason,
        ]);

        return response()->json($payment->fresh()->load(['event', 'user', 'approvedBy']));
    }
}
