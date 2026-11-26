<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * Check a granular admin permission for web sessions while preserving a small,
     * explicit set of legacy mobile role capabilities.
     *
     * @param  array<int, string>  $mobileRoles
     */
    protected function denyUnlessAdminPermission(Request $request, string $permission, array $mobileRoles = []): ?JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        if (! $user->is_active) {
            return response()->json(['message' => 'This account is inactive.'], 403);
        }

        $abilities = $user->currentAccessToken()?->abilities ?? [];
        if (in_array('admin-panel', $abilities, true)) {
            return ($user->hasSuperAdminAccess() || $user->hasPermission($permission))
                ? null
                : response()->json(['message' => 'You do not have permission to perform this action.'], 403);
        }

        if ($user->hasSuperAdminAccess() || ($mobileRoles !== [] && $user->roles()->whereIn('name', $mobileRoles)->exists())) {
            return null;
        }

        return response()->json(['message' => 'You do not have permission to perform this action.'], 403);
    }
}
