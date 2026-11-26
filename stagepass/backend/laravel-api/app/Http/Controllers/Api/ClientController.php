<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Services\AuditTrail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'clients.view', ['event_manager'])) return $denial;

        $query = Client::query()
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%' . $request->search . '%';
                $q->where('name', 'like', $term)
                    ->orWhere('contact_name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('phone', 'like', $term);
            })
            ->orderBy('name');

        $perPage = min((int) $request->input('per_page', 20), 100);
        $clients = $query->paginate($perPage);

        return response()->json($clients);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'clients.create', ['event_manager'])) return $denial;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_name' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:1000',
            'notes' => 'nullable|string|max:5000',
        ]);

        $client = Client::create($validated);
        app(AuditTrail::class)->record($request, 'client.created', $client, [], $client->only(['name', 'contact_name', 'email', 'phone', 'address']));

        return response()->json($client, 201);
    }

    public function show(Request $request, Client $client): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'clients.view', ['event_manager'])) return $denial;

        $client->loadCount('events');
        return response()->json($client);
    }

    public function update(Request $request, Client $client): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'clients.edit', ['event_manager'])) return $denial;

        $before = $client->only(['name', 'contact_name', 'email', 'phone', 'address']);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'contact_name' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:1000',
            'notes' => 'nullable|string|max:5000',
        ]);

        $client->update($validated);
        app(AuditTrail::class)->record($request, 'client.updated', $client, $before, $client->fresh()->only(['name', 'contact_name', 'email', 'phone', 'address']));

        return response()->json($client);
    }

    public function destroy(Request $request, Client $client): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'clients.delete', ['event_manager'])) return $denial;

        $before = $client->only(['name', 'contact_name', 'email', 'phone', 'address']);
        $client->delete();
        app(AuditTrail::class)->record($request, 'client.deleted', $client, $before);
        return response()->json(null, 204);
    }
}
