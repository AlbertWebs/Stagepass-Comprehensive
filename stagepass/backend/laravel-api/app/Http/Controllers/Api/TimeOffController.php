<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TimeOffRequest;
use App\Models\User;
use App\Notifications\TimeOffRequestSubmittedNotification;
use App\Notifications\WorkflowPushNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimeOffController extends Controller
{
    /**
     * Admin: create time off for a user (crew). Optional status, default approved.
     */
    public function store(Request $request): JsonResponse
    {
        $admin = $request->user();
        if (! $admin->hasRole('super_admin') && ! $admin->hasRole('director') && ! $admin->hasRole('admin')) {
            return response()->json(['message' => 'Only admins can create time off for users.'], 403);
        }

        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:5000',
            'status' => 'nullable|in:pending,approved,rejected',
        ]);

        $status = $request->input('status', TimeOffRequest::STATUS_APPROVED);
        $timeOff = TimeOffRequest::create([
            'user_id' => $request->user_id,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'reason' => $request->reason,
            'notes' => $request->notes,
            'status' => $status,
            'processed_by' => in_array($status, [TimeOffRequest::STATUS_APPROVED, TimeOffRequest::STATUS_REJECTED], true) ? $admin->id : null,
            'processed_at' => in_array($status, [TimeOffRequest::STATUS_APPROVED, TimeOffRequest::STATUS_REJECTED], true) ? now() : null,
        ]);
        $timeOff->load('user');
        if ($timeOff->user) {
            $timeOff->user->notify(new WorkflowPushNotification(
                $status === TimeOffRequest::STATUS_APPROVED ? 'Time-off approved' : 'Time-off added',
                $status === TimeOffRequest::STATUS_APPROVED ? 'Your time off has been approved by an administrator.' : 'An administrator added a time-off request for you.',
                $status === TimeOffRequest::STATUS_APPROVED ? 'time_off_approved' : 'time_off_pending',
                ['time_off_request_id' => (string) $timeOff->id]
            ));
        }

        return response()->json($timeOff->load(['user', 'processedBy']), 201);
    }

    /**
     * Admin: update a time-off request (dates, reason, notes, status).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        if (! $admin->hasRole('super_admin') && ! $admin->hasRole('director') && ! $admin->hasRole('admin')) {
            return response()->json(['message' => 'Only admins can edit time off.'], 403);
        }

        $timeOff = TimeOffRequest::findOrFail($id);

        $request->validate([
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date|after_or_equal:start_date',
            'reason' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:5000',
            'status' => 'nullable|in:pending,approved,rejected',
        ]);

        $updates = [];
        if ($request->has('start_date')) {
            $updates['start_date'] = $request->start_date;
        }
        if ($request->has('end_date')) {
            $updates['end_date'] = $request->end_date;
        }
        if (array_key_exists('reason', $request->all())) {
            $updates['reason'] = $request->reason;
        }
        if (array_key_exists('notes', $request->all())) {
            $updates['notes'] = $request->notes;
        }
        if ($request->has('status')) {
            $updates['status'] = $request->status;
            $updates['processed_by'] = in_array($request->status, [TimeOffRequest::STATUS_APPROVED, TimeOffRequest::STATUS_REJECTED], true) ? $admin->id : null;
            $updates['processed_at'] = in_array($request->status, [TimeOffRequest::STATUS_APPROVED, TimeOffRequest::STATUS_REJECTED], true) ? now() : null;
        }
        $statusChanged = isset($updates['status']) && $updates['status'] !== $timeOff->status;
        $datesChanged = (isset($updates['start_date']) && (string) $updates['start_date'] !== (string) $timeOff->start_date)
            || (isset($updates['end_date']) && (string) $updates['end_date'] !== (string) $timeOff->end_date);
        $timeOff->update($updates);
        if ($timeOff->user && ($statusChanged || $datesChanged)) {
            $approved = $timeOff->status === TimeOffRequest::STATUS_APPROVED;
            $timeOff->user->notify(new WorkflowPushNotification(
                $statusChanged
                    ? ($approved ? 'Time-off approved' : ($timeOff->status === TimeOffRequest::STATUS_REJECTED ? 'Time-off declined' : 'Time-off updated'))
                    : 'Time-off dates changed',
                $statusChanged
                    ? ($approved ? 'Your time-off request has been approved.' : ($timeOff->status === TimeOffRequest::STATUS_REJECTED ? 'Your time-off request was declined.' : 'Your time-off request status was updated.'))
                    : 'Your time-off dates are now ' . $timeOff->start_date?->format('j M') . ' to ' . $timeOff->end_date?->format('j M') . '.',
                $statusChanged
                    ? ($approved ? 'time_off_approved' : ($timeOff->status === TimeOffRequest::STATUS_REJECTED ? 'time_off_rejected' : 'time_off_pending'))
                    : 'time_off_updated',
                [
                    'time_off_request_id' => (string) $timeOff->id,
                    'start_date' => (string) $timeOff->start_date,
                    'end_date' => (string) $timeOff->end_date,
                ]
            ));
        }

        return response()->json($timeOff->fresh()->load(['user', 'processedBy']));
    }

    public function index(Request $request): JsonResponse
    {
        $query = TimeOffRequest::query()->with(['user', 'processedBy', 'attachments']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->user_id);
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $items = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json($items);
    }

    public function request(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:5000',
        ]);

        $timeOff = TimeOffRequest::create([
            'user_id' => $request->user()->id,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'reason' => $request->reason,
            'notes' => $request->notes,
            'status' => TimeOffRequest::STATUS_PENDING,
        ]);
        $timeOff->load('user');
        $this->notifyAdminsOfSubmittedRequest($timeOff);

        return response()->json($timeOff->load(['user', 'attachments']), 201);
    }

    private function notifyAdminsOfSubmittedRequest(TimeOffRequest $timeOff): void
    {
        $adminUsers = User::query()
            ->whereHas('roles', function ($query): void {
                $query->whereIn('name', ['super_admin', 'director', 'admin']);
            })
            ->get();

        foreach ($adminUsers as $adminUser) {
            $adminUser->notify(new TimeOffRequestSubmittedNotification($timeOff));
        }
    }

    public function uploadAttachments(Request $request, int $id): JsonResponse
    {
        $timeOff = TimeOffRequest::findOrFail($id);
        if ($timeOff->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        if ($timeOff->status !== TimeOffRequest::STATUS_PENDING) {
            return response()->json(['message' => 'Cannot add attachments to a processed request.'], 422);
        }

        $request->validate([
            'attachments' => 'required|array',
            'attachments.*' => 'file|max:10240',
        ]);
        $files = $request->file('attachments');
        if (! is_array($files)) {
            $files = [$files];
        }

        foreach ($files as $file) {
            $path = $file->store('time_off_attachments/' . $timeOff->id, 'local');
            $att = $timeOff->attachments()->create([
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
            ]);
        }

        return response()->json($timeOff->fresh()->load(['user', 'attachments']));
    }

    public function approve(Request $request): JsonResponse
    {
        $request->validate(['request_id' => 'required|exists:time_off_requests,id']);

        $timeOff = TimeOffRequest::findOrFail($request->request_id);
        $statusChanged = $timeOff->status !== TimeOffRequest::STATUS_APPROVED;
        $timeOff->update([
            'status' => TimeOffRequest::STATUS_APPROVED,
            'processed_by' => $request->user()->id,
            'processed_at' => now(),
        ]);
        if ($statusChanged && $timeOff->user) {
            $timeOff->user->notify(new WorkflowPushNotification(
                'Time-off approved',
                'Your time-off request has been approved.',
                'time_off_approved',
                ['time_off_request_id' => (string) $timeOff->id]
            ));
        }

        return response()->json($timeOff->fresh()->load(['user', 'processedBy']));
    }

    public function reject(Request $request): JsonResponse
    {
        $request->validate(['request_id' => 'required|exists:time_off_requests,id']);

        $timeOff = TimeOffRequest::findOrFail($request->request_id);
        $statusChanged = $timeOff->status !== TimeOffRequest::STATUS_REJECTED;
        $timeOff->update([
            'status' => TimeOffRequest::STATUS_REJECTED,
            'processed_by' => $request->user()->id,
            'processed_at' => now(),
        ]);
        if ($statusChanged && $timeOff->user) {
            $timeOff->user->notify(new WorkflowPushNotification(
                'Time-off request declined',
                'Your time-off request was declined. Open the app to review the request.',
                'time_off_rejected',
                ['time_off_request_id' => (string) $timeOff->id]
            ));
        }

        return response()->json($timeOff->fresh()->load(['user', 'processedBy']));
    }
}
