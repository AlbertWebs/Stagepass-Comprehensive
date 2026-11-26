<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Holiday;
use App\Services\AuditTrail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HolidayController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'holidays.view')) return $denial;

        $query = Holiday::query()->orderBy('date');
        if ($request->filled('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'holidays.manage')) return $denial;

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
        app(AuditTrail::class)->record($request, 'holiday.created', $holiday, [], $holiday->only(['name', 'date', 'is_active']));

        return response()->json($holiday, 201);
    }

    public function update(Request $request, Holiday $holiday): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'holidays.manage')) return $denial;

        $before = $holiday->only(['name', 'date', 'is_active']);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'date' => 'sometimes|date|unique:holidays,date,' . $holiday->id,
            'description' => 'nullable|string|max:1000',
            'is_active' => 'sometimes|boolean',
        ]);

        $holiday->update($validated);
        app(AuditTrail::class)->record($request, 'holiday.updated', $holiday, $before, $holiday->fresh()->only(['name', 'date', 'is_active']));

        return response()->json($holiday->fresh());
    }

    public function destroy(Request $request, Holiday $holiday): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'holidays.manage')) return $denial;

        $before = $holiday->only(['name', 'date', 'is_active']);
        $holiday->delete();
        app(AuditTrail::class)->record($request, 'holiday.deleted', $holiday, $before);

        return response()->json(null, 204);
    }
}
