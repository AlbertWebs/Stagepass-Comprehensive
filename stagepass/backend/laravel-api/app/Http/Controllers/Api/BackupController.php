<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use App\Models\Event;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BackupController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('director')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $users = User::with('roles:id,name,label')
            ->get(['id', 'name', 'email', 'username', 'phone', 'created_at', 'updated_at'])
            ->map(fn ($u) => array_merge($u->toArray(), [
                'roles' => $u->roles->map(fn ($r) => $r->name),
            ]));

        $events = Event::with(['teamLeader:id,name,email', 'crew:id,name,email'])
            ->orderBy('date', 'desc')
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'name' => $e->name,
                'description' => $e->description,
                'date' => $e->date?->toDateString(),
                'start_time' => $e->start_time,
                'expected_end_time' => $e->expected_end_time,
                'location_name' => $e->location_name,
                'status' => $e->status,
                'team_leader' => $e->teamLeader?->only(['id', 'name', 'email']),
                'crew_count' => $e->crew?->count() ?? 0,
                'created_at' => $e->created_at?->toIso8601String(),
                'updated_at' => $e->updated_at?->toIso8601String(),
            ]);

        $equipment = Equipment::orderBy('name')->get(['id', 'name', 'serial_number', 'condition', 'created_at', 'updated_at']);

        return response()->json([
            'exported_at' => now()->toIso8601String(),
            'users' => $users,
            'events' => $events,
            'equipment' => $equipment,
        ]);
    }
}
