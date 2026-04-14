<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Holiday;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HolidayController extends Controller
{
    private function canManage(Request $request): bool
    {
        $user = $request->user();

        return $user->hasRole('super_admin')
            || $user->hasRole('director')
            || $user->hasRole('admin');
    }

    public function index(Request $request): JsonResponse
    {
        if (! $this->canManage($request)) {
            return response()->json(['message' => 'Only admins can manage holidays.'], 403);
        }

        $query = Holiday::query()->orderBy('date');
        if ($request->filled('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->canManage($request)) {
            return response()->json(['message' => 'Only admins can manage holidays.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'date' => 'required|date|unique:holidays,date',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'nullable|boolean',
        ]);

        $holiday = Holiday::create([
            ...$validated,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json($holiday, 201);
    }

    public function update(Request $request, Holiday $holiday): JsonResponse
    {
        if (! $this->canManage($request)) {
            return response()->json(['message' => 'Only admins can manage holidays.'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'date' => 'sometimes|date|unique:holidays,date,' . $holiday->id,
            'description' => 'nullable|string|max:1000',
            'is_active' => 'sometimes|boolean',
        ]);

        $holiday->update($validated);

        return response()->json($holiday->fresh());
    }

    public function destroy(Request $request, Holiday $holiday): JsonResponse
    {
        if (! $this->canManage($request)) {
            return response()->json(['message' => 'Only admins can manage holidays.'], 403);
        }

        $holiday->delete();

        return response()->json(null, 204);
    }
}
