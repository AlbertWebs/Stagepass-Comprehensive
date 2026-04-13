<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Database\Seeders\SettingsSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class SettingsController extends Controller
{
    /**
     * Minimal app policy for unauthenticated clients (e.g. login screen before token).
     */
    public function publicAppConfig(): JsonResponse
    {
        return response()
            ->json([
                'allow_biometric_mobile_login' => $this->allowBiometricMobileLogin(),
            ])
            ->header('Cache-Control', 'public, max-age=60');
    }

    private function allowBiometricMobileLogin(): bool
    {
        return Setting::getBool('allow_biometric_mobile_login', true);
    }

    /**
     * Office check-in config (location + time window) for any authenticated user.
     * Used by mobile app so crew can see office check-in without full settings access.
     */
    public function officeCheckinConfig(Request $request): JsonResponse
    {
        $lat = Setting::get('office_latitude');
        $lng = Setting::get('office_longitude');
        $radius = (int) Setting::get('office_radius_m', 100);
        $start = Setting::get('office_checkin_start_time', '09:00');
        $end = Setting::get('office_checkin_end_time', '10:00');

        return response()->json([
            'office_latitude' => $lat !== null && $lat !== '' ? (float) $lat : null,
            'office_longitude' => $lng !== null && $lng !== '' ? (float) $lng : null,
            'office_radius_m' => $radius > 0 ? $radius : 100,
            'office_checkin_start_time' => is_string($start) ? $start : '09:00',
            'office_checkin_end_time' => is_string($end) ? $end : '10:00',
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('director') && ! $user->hasRole('admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()
            ->json(Setting::getAll())
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('director') && ! $user->hasRole('admin')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Accept JSON body: { "settings": { "app_name": "...", ... } } or flat { "app_name": "...", ... }
        // Prefer raw body: Laravel does not always merge JSON into input() for POST
        $settingsInput = null;
        $raw = $request->getContent();
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                if (isset($decoded['settings']) && is_array($decoded['settings'])) {
                    $settingsInput = $decoded['settings'];
                } elseif (! isset($decoded['settings'])) {
                    // Flat object as settings
                    $settingsInput = $decoded;
                }
            }
        }
        if (! is_array($settingsInput)) {
            $settingsInput = $request->input('settings');
        }
        if (! is_array($settingsInput)) {
            return response()->json(['message' => 'Invalid payload: send JSON body { "settings": { "key": "value", ... } }'], 422);
        }

        $allowed = array_keys(SettingsSeeder::DEFAULTS);
        $toSet = [];
        foreach ($settingsInput as $key => $value) {
            if (in_array($key, $allowed, true)) {
                $toSet[$key] = $value;
            }
        }

        if (! Schema::hasTable('settings')) {
            Log::warning('Settings table missing');
            return response()->json([
                'message' => 'Settings table not found. Run: php artisan migrate',
            ], 503);
        }

        if (count($toSet) === 0) {
            Log::warning('Settings update: no keys to save', ['received_keys' => array_keys($settingsInput), 'allowed_keys' => $allowed]);
            return response()->json([
                'message' => 'No valid settings to save. Check that keys match the allowed list.',
            ], 422);
        }

        try {
            Setting::setMany($toSet);
        } catch (\Throwable $e) {
            Log::error('Settings update failed', ['exception' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json([
                'message' => 'Failed to save settings to database.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }

        return response()
            ->json(Setting::getAll())
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
}
