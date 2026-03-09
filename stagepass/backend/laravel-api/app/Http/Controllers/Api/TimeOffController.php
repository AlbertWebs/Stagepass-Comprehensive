<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TimeOffRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimeOffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = TimeOffRequest::query()->with(['user', 'processedBy']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
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
            'reason' => 'nullable|string|max:1000',
        ]);

        $timeOff = TimeOffRequest::create([
            'user_id' => $request->user()->id,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'reason' => $request->reason,
            'status' => TimeOffRequest::STATUS_PENDING,
        ]);

        return response()->json($timeOff->load('user'), 201);
    }

    public function approve(Request $request): JsonResponse
    {
        $request->validate(['request_id' => 'required|exists:time_off_requests,id']);

        $timeOff = TimeOffRequest::findOrFail($request->request_id);
        $timeOff->update([
            'status' => TimeOffRequest::STATUS_APPROVED,
            'processed_by' => $request->user()->id,
            'processed_at' => now(),
        ]);

        return response()->json($timeOff->fresh()->load(['user', 'processedBy']));
    }

    public function reject(Request $request): JsonResponse
    {
        $request->validate(['request_id' => 'required|exists:time_off_requests,id']);

        $timeOff = TimeOffRequest::findOrFail($request->request_id);
        $timeOff->update([
            'status' => TimeOffRequest::STATUS_REJECTED,
            'processed_by' => $request->user()->id,
            'processed_at' => now(),
        ]);

        return response()->json($timeOff->fresh()->load(['user', 'processedBy']));
    }
}
