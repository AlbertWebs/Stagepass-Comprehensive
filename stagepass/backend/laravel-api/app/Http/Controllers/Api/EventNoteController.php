<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventNoteController extends Controller
{
    public function index(Event $event): JsonResponse
    {
        $notes = $event->notes()->with('user')->latest()->paginate(20);
        return response()->json($notes);
    }

    public function store(Request $request, Event $event): JsonResponse
    {
        $request->validate(['note' => 'required|string|max:2000']);

        $note = $event->notes()->create([
            'user_id' => $request->user()->id,
            'note' => $request->note,
        ]);

        return response()->json($note->load('user'), 201);
    }
}
