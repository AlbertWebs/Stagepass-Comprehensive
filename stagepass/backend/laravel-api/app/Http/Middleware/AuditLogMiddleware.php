<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditLogMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        // Only log API requests
        if (! $request->is('api/*') || $request->is('up')) {
            return;
        }
        $path = $request->path();
        // Skip login/forgot-password (avoid logging credentials) and audit-logs to avoid recursion
        if (str_contains($path, 'login') || str_contains($path, 'forgot-password') || str_contains($path, 'audit-logs')) {
            return;
        }

        $userId = $request->user()?->id;
        $method = $request->method();
        $fullUrl = $request->fullUrl();
        if (strlen($fullUrl) > 1000) {
            $fullUrl = substr($fullUrl, 0, 997) . '...';
        }
        $userAgent = $request->userAgent();
        $clientHeader = $request->header('X-Client') ?? $request->header('X-App-Source');
        $source = AuditLog::inferSource($userAgent, $clientHeader);
        $status = $response->getStatusCode();

        try {
            AuditLog::create([
                'user_id' => $userId,
                'method' => $method,
                'path' => $request->path(),
                'full_url' => $fullUrl,
                'source' => $source,
                'ip_address' => $request->ip(),
                'user_agent' => $userAgent,
                'response_status' => $status,
            ]);
        } catch (\Throwable) {
            // Don't break the app if logging fails
        }
    }
}
