<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Services\AuditTrail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'transport.view', ['logistics'])) return $denial;

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
        if ($denial = $this->denyUnlessAdminPermission($request, 'transport.create', ['logistics'])) return $denial;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'registration_number' => 'nullable|string|max:100',
            'capacity' => 'nullable|integer|min:1|max:999',
            'status' => 'nullable|string|in:available,in_use,maintenance',
            'notes' => 'nullable|string|max:2000',
        ]);

        $validated['status'] = $validated['status'] ?? Vehicle::STATUS_AVAILABLE;
        $vehicle = Vehicle::create($validated);
        app(AuditTrail::class)->record($request, 'vehicle.created', $vehicle, [], $vehicle->only(['name', 'registration_number', 'capacity', 'status']));

        return response()->json($vehicle, 201);
    }

    public function show(Request $request, Vehicle $vehicle): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'transport.view', ['logistics'])) return $denial;

        return response()->json($vehicle);
    }

    public function update(Request $request, Vehicle $vehicle): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'transport.edit', ['logistics'])) return $denial;

        $before = $vehicle->only(['name', 'registration_number', 'capacity', 'status']);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'registration_number' => 'nullable|string|max:100',
            'capacity' => 'nullable|integer|min:1|max:999',
            'status' => 'sometimes|string|in:available,in_use,maintenance',
            'notes' => 'nullable|string|max:2000',
        ]);

        $vehicle->update($validated);
        app(AuditTrail::class)->record($request, 'vehicle.updated', $vehicle, $before, $vehicle->fresh()->only(['name', 'registration_number', 'capacity', 'status']));

        return response()->json($vehicle);
    }

    public function destroy(Request $request, Vehicle $vehicle): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'transport.delete', ['logistics'])) return $denial;

        $before = $vehicle->only(['name', 'registration_number', 'capacity', 'status']);
        $vehicle->delete();
        app(AuditTrail::class)->record($request, 'vehicle.deleted', $vehicle, $before);
        return response()->json(null, 204);
    }
}
