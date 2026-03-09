<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventChecklistItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventChecklistController extends Controller
{
    public function index(Event $event): JsonResponse
    {
        $items = $event->checklistItems()->with('checkedBy:id,name')->get();
        return response()->json(['data' => $items]);
    }

    public function store(Request $request, Event $event): JsonResponse
    {
        // Build checklist from current crew + event equipment
        $event->load(['crew', 'eventEquipment.equipment']);
        $order = 0;

        foreach ($event->crew as $user) {
            EventChecklistItem::firstOrCreate(
                [
                    'event_id' => $event->id,
                    'type' => 'crew',
                    'source_id' => $user->id,
                ],
                [
                    'label' => $user->name,
                    'sort_order' => $order++,
                ]
            );
        }

        foreach ($event->eventEquipment as $ee) {
            $equipment = $ee->equipment;
            if (! $equipment) {
                continue;
            }
            EventChecklistItem::firstOrCreate(
                [
                    'event_id' => $event->id,
                    'type' => 'equipment',
                    'source_id' => $equipment->id,
                ],
                [
                    'label' => $equipment->name . ($equipment->serial_number ? " ({$equipment->serial_number})" : ''),
                    'sort_order' => $order++,
                ]
            );
        }

        $items = $event->checklistItems()->with('checkedBy:id,name')->orderBy('sort_order')->orderBy('id')->get();
        return response()->json(['data' => $items], 201);
    }

    public function update(Request $request, Event $event, EventChecklistItem $checklistItem): JsonResponse
    {
        if ($checklistItem->event_id !== (int) $event->id) {
            abort(404);
        }

        $request->validate(['is_checked' => 'required|boolean']);

        $checklistItem->is_checked = $request->boolean('is_checked');
        $checklistItem->checked_at = $request->boolean('is_checked') ? now() : null;
        $checklistItem->checked_by_id = $request->boolean('is_checked') ? $request->user()->id : null;
        $checklistItem->save();

        return response()->json($checklistItem->load('checkedBy:id,name'));
    }
}
