<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventEquipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventEquipmentController extends Controller
{
    public function attach(Request $request, Event $event): JsonResponse
    {
        $request->validate([
            'equipment_id' => 'required|exists:equipment,id',
            'notes' => 'nullable|string',
        ]);

        $event->equipment()->attach($request->equipment_id, [
            'notes' => $request->notes,
        ]);

        $pivot = EventEquipment::where('event_id', $event->id)
            ->where('equipment_id', $request->equipment_id)
            ->with('equipment')
            ->first();

        return response()->json($pivot, 201);
    }

    public function confirm(Request $request, Event $event): JsonResponse
    {
        $request->validate(['equipment_id' => 'required|exists:equipment,id']);

        $pivot = EventEquipment::where('event_id', $event->id)
            ->where('equipment_id', $request->equipment_id)
            ->firstOrFail();

        $pivot->update([
            'confirmed_by' => $request->user()->id,
            'confirmed_at' => now(),
        ]);

        return response()->json($pivot->fresh()->load(['equipment', 'confirmedBy']));
    }
}
