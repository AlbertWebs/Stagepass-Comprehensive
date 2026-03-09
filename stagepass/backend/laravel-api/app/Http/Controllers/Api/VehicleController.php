<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Vehicle::query();

        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('registration_number', 'like', $term);
            });
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        $query->orderBy('name');

        $perPage = min((int) $request->input('per_page', 20), 100);
        $vehicles = $query->paginate($perPage);

        return response()->json($vehicles);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'registration_number' => 'nullable|string|max:100',
            'capacity' => 'nullable|integer|min:1|max:999',
            'status' => 'nullable|string|in:available,in_use,maintenance',
            'notes' => 'nullable|string|max:2000',
        ]);

        $validated['status'] = $validated['status'] ?? Vehicle::STATUS_AVAILABLE;
        $vehicle = Vehicle::create($validated);

        return response()->json($vehicle, 201);
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        return response()->json($vehicle);
    }

    public function update(Request $request, Vehicle $vehicle): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'registration_number' => 'nullable|string|max:100',
            'capacity' => 'nullable|integer|min:1|max:999',
            'status' => 'sometimes|string|in:available,in_use,maintenance',
            'notes' => 'nullable|string|max:2000',
        ]);

        $vehicle->update($validated);

        return response()->json($vehicle);
    }

    public function destroy(Vehicle $vehicle): JsonResponse
    {
        $vehicle->delete();
        return response()->json(null, 204);
    }
}
