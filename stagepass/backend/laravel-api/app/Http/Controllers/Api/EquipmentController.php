<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EquipmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $equipment = Equipment::query()
            ->when($request->filled('search'), fn ($q) => $q->where('name', 'like', '%'.$request->search.'%')
                ->orWhere('serial_number', 'like', '%'.$request->search.'%'))
            ->orderBy('name')
            ->paginate((int) $request->input('per_page', 20));

        return response()->json($equipment);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'serial_number' => 'nullable|string|max:100',
            'condition' => 'required|string|in:good,fair,poor,out_of_service',
        ]);

        $equipment = Equipment::create($validated);

        return response()->json($equipment, 201);
    }

    public function show(Equipment $equipment): JsonResponse
    {
        return response()->json($equipment);
    }

    public function update(Request $request, Equipment $equipment): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'serial_number' => 'nullable|string|max:100',
            'condition' => 'sometimes|string|in:good,fair,poor,out_of_service',
        ]);

        $equipment->update($validated);

        return response()->json($equipment);
    }

    public function destroy(Equipment $equipment): JsonResponse
    {
        $equipment->delete();

        return response()->json(null, 204);
    }
}
