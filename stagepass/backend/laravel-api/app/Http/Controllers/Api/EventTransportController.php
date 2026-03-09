<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventVehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventTransportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = EventVehicle::query()
            ->with(['event:id,name,date,status', 'vehicle', 'driver:id,name,email']);

        if ($request->filled('event_id')) {
            $query->where('event_id', $request->event_id);
        }

        $assignments = $query->orderByDesc('created_at')
            ->paginate(min((int) $request->input('per_page', 50), 100));

        return response()->json($assignments);
    }

    public function store(Request $request, Event $event): JsonResponse
    {
        $validated = $request->validate([
            'vehicle_id' => 'required|exists:vehicles,id',
            'driver_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string|max:2000',
        ]);

        if (EventVehicle::where('event_id', $event->id)->where('vehicle_id', $validated['vehicle_id'])->exists()) {
            return response()->json(['message' => 'This vehicle is already assigned to the event.'], 422);
        }

        $assignment = EventVehicle::create([
            'event_id' => $event->id,
            'vehicle_id' => $validated['vehicle_id'],
            'driver_id' => $validated['driver_id'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        $assignment->load(['event:id,name,date', 'vehicle', 'driver:id,name,email']);

        return response()->json($assignment, 201);
    }

    public function destroy(EventVehicle $eventVehicle): JsonResponse
    {
        $eventVehicle->delete();
        return response()->json(null, 204);
    }
}
