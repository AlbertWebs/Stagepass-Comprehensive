<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('director') && ! $user->hasRole('admin')) {
            return response()->json(['message' => 'Only management can view audit logs.'], 403);
        }

        $query = AuditLog::query()->with('user:id,name,email');

        if ($request->boolean('mutating_only')) {
            $query->whereIn('method', ['POST', 'PUT', 'PATCH', 'DELETE']);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }
        if ($request->filled('source')) {
            $query->where('source', $request->source);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }
        if ($request->filled('method')) {
            $query->where('method', strtoupper($request->method));
        }
        if ($request->filled('path')) {
            $query->where('path', 'like', '%' . $request->path . '%');
        }
        if ($request->filled('status')) {
            $query->where('response_status', $request->status);
        }

        $perPage = min((int) $request->input('per_page', 25), 100);
        $logs = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json($logs);
    }
}
