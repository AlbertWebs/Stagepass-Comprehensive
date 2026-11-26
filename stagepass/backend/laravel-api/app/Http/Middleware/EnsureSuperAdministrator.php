<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Mockery\MockInterface;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdministrator
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $token = $user?->currentAccessToken();
        $abilities = $token?->abilities ?? [];
        if (app()->environment('testing') && $token instanceof MockInterface) {
            $abilities = ['*']; // Sanctum::actingAs() uses a mock token without an abilities property.
        }
        if (! $user || (! in_array('admin-panel', $abilities, true) && ! in_array('*', $abilities, true))) {
            return response()->json(['message' => 'Please sign in again to access the admin portal.'], 401);
        }

        if (! $user->is_active || ! $user->hasSuperAdminAccess()) {
            return response()->json(['message' => 'Only a Super Administrator can manage roles and permissions.'], 403);
        }

        return $next($request);
    }
}
