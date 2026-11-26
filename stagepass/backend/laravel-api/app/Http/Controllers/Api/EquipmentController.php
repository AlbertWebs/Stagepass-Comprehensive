<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use App\Services\AuditTrail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EquipmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'equipment.view', ['logistics'])) return $denial;

        $equipment = Equipment::query()
            ->when($request->filled('search'), fn ($q) => $q->where('name', 'like', '%'.$request->search.'%')
                ->orWhere('serial_number', 'like', '%'.$request->search.'%'))
            ->orderBy('name')
            ->paginate((int) $request->input('per_page', 20));

        return response()->json($equipment);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'equipment.create', ['logistics'])) return $denial;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'serial_number' => 'nullable|string|max:100',
            'condition' => 'required|string|in:good,fair,poor,out_of_service',
        ]);

        $equipment = Equipment::create($validated);
        app(AuditTrail::class)->record($request, 'equipment.created', $equipment, [], $equipment->only(['name', 'serial_number', 'condition']));

        return response()->json($equipment, 201);
    }

    public function show(Request $request, Equipment $equipment): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'equipment.view', ['logistics'])) return $denial;

        return response()->json($equipment);
    }

    public function update(Request $request, Equipment $equipment): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'equipment.edit', ['logistics'])) return $denial;

        $before = $equipment->only(['name', 'serial_number', 'condition']);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'serial_number' => 'nullable|string|max:100',
            'condition' => 'sometimes|string|in:good,fair,poor,out_of_service',
        ]);

        $equipment->update($validated);
        app(AuditTrail::class)->record($request, 'equipment.updated', $equipment, $before, $equipment->fresh()->only(['name', 'serial_number', 'condition']));

        return response()->json($equipment);
    }

    public function destroy(Request $request, Equipment $equipment): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'equipment.delete', ['logistics'])) return $denial;

        $before = $equipment->only(['name', 'serial_number', 'condition']);
        $equipment->delete();
        app(AuditTrail::class)->record($request, 'equipment.deleted', $equipment, $before);

        return response()->json(null, 204);
    }
}
