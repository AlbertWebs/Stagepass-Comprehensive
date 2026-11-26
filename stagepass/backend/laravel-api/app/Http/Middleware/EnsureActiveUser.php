<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveUser
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() && ! $request->user()->is_active) {
            $request->user()->tokens()->delete();
            return response()->json(['message' => 'This account is inactive. Contact your administrator.'], 403);
        }

        return $next($request);
    }
}
