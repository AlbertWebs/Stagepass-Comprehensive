<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DbHealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::connection()->getPdo();
            DB::select('SELECT 1');

            return response()->json([
                'ok' => true,
                'message' => 'Database connection is healthy.',
                'connection' => DB::getDefaultConnection(),
                'driver' => DB::connection()->getDriverName(),
                'timestamp' => now()->toIso8601String(),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Database connection failed.',
                'connection' => DB::getDefaultConnection(),
                'error' => $e->getMessage(),
                'timestamp' => now()->toIso8601String(),
            ], 500);
        }
    }
}
