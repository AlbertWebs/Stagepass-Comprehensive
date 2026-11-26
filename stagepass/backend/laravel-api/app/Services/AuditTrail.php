<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditTrail
{
    /** Record only explicitly selected, non-secret before/after fields. */
    public function record(Request $request, string $action, Model $subject, array $before = [], array $after = []): void
    {
        AuditLog::create([
            'user_id' => $request->user()?->id,
            'method' => $request->method(),
            'path' => $request->path(),
            'full_url' => substr($request->fullUrl(), 0, 1000),
            'source' => AuditLog::inferSource($request->userAgent(), $request->header('X-Client-Type')),
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
            'response_status' => 200,
            'action' => $action,
            'subject_type' => $subject->getTable(),
            'subject_id' => $subject->getKey(),
            'before_values' => $before ?: null,
            'after_values' => $after ?: null,
        ]);
    }
}
