<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventChecklistItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventChecklistController extends Controller
{
    /**
     * Crew: list checklists for events the current user is assigned to.
     * GET /api/my-checklists
     */
    public function myChecklists(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['data' => []], 200);
        }

        $events = Event::whereHas('crew', function ($q) use ($user) {
            $q->where('users.id', $user->id);
        })
            ->with(['checklistItems' => function ($q) {
                $q->orderBy('sort_order')->orderBy('id');
            }])
            ->get();

        $data = $events->map(function (Event $event) {
            return [
                'id' => $event->id,
                'event_id' => $event->id,
                'items' => $event->checklistItems->map(fn ($item) => [
                    'id' => $item->id,
                    'label' => $item->label,
                    'is_checked' => (bool) $item->is_checked,
                    'sort_order' => (int) $item->sort_order,
                ])->values()->all(),
            ];
        })->values()->all();

        return response()->json(['data' => $data]);
    }

    public function index(Event $event): JsonResponse
    {
        $items = $event->checklistItems()->with('checkedBy:id,name')->get();
        return response()->json(['data' => $items]);
    }

    /** Progress summary for mobile: total and completed counts per event (one row per event). */
    public function progress(Event $event): JsonResponse
    {
        $items = $event->checklistItems()->get();
        $total = $items->count();
        $completed = $items->where('is_checked', true)->count();
        $data = [
            [
                'checklist_id' => (int) $event->id,
                'total' => $total,
                'completed' => $completed,
            ],
        ];
        return response()->json(['data' => $data]);
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
