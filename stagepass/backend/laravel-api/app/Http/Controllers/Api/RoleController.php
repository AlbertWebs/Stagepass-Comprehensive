<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Services\AuditTrail;

class RoleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // The mobile admin app needs the role catalogue for its user profile screen.
        // It can read the catalogue, but only an admin-panel session can change roles.
        if (! $request->user()?->hasSuperAdminAccess()) {
            return response()->json(['message' => 'Only a Super Administrator can view account roles.'], 403);
        }
        $roles = Role::with('permissions:id,name,label,module,action')
            ->withCount('users')->orderBy('name')->get(['id', 'name', 'label', 'is_system']);
        return response()->json($roles);
    }

    public function permissions(): JsonResponse
    {
        $permissions = \App\Models\Permission::query()->orderBy('module')->orderBy('name')->get(['id', 'name', 'label', 'module', 'action']);
        return response()->json($permissions->groupBy('module')->map(fn ($items, $module) => [
            'module' => $module,
            'permissions' => $items->values(),
        ])->values());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', 'regex:/^[a-z][a-z0-9_]*$/', 'unique:roles,name'],
            'label' => ['required', 'string', 'max:120'],
            'permission_ids' => ['present', 'array'],
            'permission_ids.*' => ['integer', 'distinct', 'exists:permissions,id'],
        ]);

        $role = DB::transaction(function () use ($data): Role {
            $role = Role::create(['name' => $data['name'], 'label' => $data['label'], 'is_system' => false]);
            $role->permissions()->sync($data['permission_ids']);
            return $role->load('permissions')->loadCount('users');
        });
        app(AuditTrail::class)->record($request, 'role.created', $role, [], [
            'name' => $role->name, 'label' => $role->label, 'permissions' => $role->permissions->pluck('name')->all(),
        ]);

        return response()->json($role, 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80', 'regex:/^[a-z][a-z0-9_]*$/', Rule::unique('roles', 'name')->ignore($role->id)],
            'label' => ['sometimes', 'required', 'string', 'max:120'],
            'permission_ids' => ['sometimes', 'array'],
            'permission_ids.*' => ['integer', 'distinct', 'exists:permissions,id'],
        ]);

        $allPermissionIds = \App\Models\Permission::query()->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $requestedPermissionIds = collect($data['permission_ids'] ?? [])->map(fn ($id) => (int) $id)->sort()->values()->all();
        if ($role->name === 'super_admin' && (isset($data['name']) || (isset($data['permission_ids']) && $requestedPermissionIds !== $allPermissionIds))) {
            return response()->json(['message' => 'The Super Administrator role and its full permissions are protected.'], 422);
        }
        if ($role->is_system && isset($data['name'])) {
            return response()->json(['message' => 'System role names cannot be changed.'], 422);
        }

        $before = ['name' => $role->name, 'label' => $role->label, 'permissions' => $role->permissions()->pluck('name')->all()];
        DB::transaction(function () use ($role, $data): void {
            $role->fill(collect($data)->only(['name', 'label'])->all())->save();
            if (array_key_exists('permission_ids', $data)) {
                $role->permissions()->sync($data['permission_ids']);
            }
        });

        $fresh = $role->fresh()->load('permissions')->loadCount('users');
        app(AuditTrail::class)->record($request, 'role.updated', $fresh, $before, [
            'name' => $fresh->name, 'label' => $fresh->label, 'permissions' => $fresh->permissions->pluck('name')->all(),
        ]);
        return response()->json($fresh);
    }

    public function destroy(Request $request, Role $role): JsonResponse
    {
        if ($role->is_system || in_array($role->name, ['super_admin', 'admin', 'director'], true)) {
            return response()->json(['message' => 'Built-in system roles cannot be deleted.'], 422);
        }
        if ($role->users()->exists()) {
            return response()->json(['message' => 'Reassign this role’s users before deleting it.'], 422);
        }
        app(AuditTrail::class)->record($request, 'role.deleted', $role, [
            'name' => $role->name, 'label' => $role->label, 'permissions' => $role->permissions()->pluck('name')->all(),
        ]);
        $role->delete();
        return response()->json(null, 204);
    }
}
