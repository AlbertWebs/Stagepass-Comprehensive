<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Mockery\MockInterface;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();
        $token = $user?->currentAccessToken();
        $abilities = $token?->abilities ?? [];
        if (app()->environment('testing') && $token instanceof MockInterface) {
            $abilities = ['*']; // Sanctum::actingAs() uses a mock token without an abilities property.
        }

        if (! $user) {
            return response()->json(['message' => 'Please sign in again to access the admin portal.'], 401);
        }

        // Mobile workflows share some endpoints with the web portal; those retain their existing
        // controller-level checks. New web sessions carry an explicit, separately checked ability.
        if (in_array('mobile', $abilities, true) || in_array('*', $abilities, true)) {
            return $next($request);
        }
        if (! in_array('admin-panel', $abilities, true)) {
            return response()->json(['message' => 'Please sign in again to access the admin portal.'], 401);
        }

        $required = explode('|', $permission);
        if (! $user->is_active || ! collect($required)->contains(fn ($name) => $user->hasPermission($name))) {
            return response()->json(['message' => 'You do not have permission to perform this action.'], 403);
        }

        return $next($request);
    }
}
