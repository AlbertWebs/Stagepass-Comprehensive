<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Database\Seeders\SettingsSeeder;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('director')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json(Setting::getAll());
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('director')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*' => 'nullable',
        ]);
        $allowed = array_keys(SettingsSeeder::DEFAULTS);
        $toSet = [];
        foreach ($validated['settings'] as $key => $value) {
            if (in_array($key, $allowed, true)) {
                $toSet[$key] = $value;
            }
        }
        Setting::setMany($toSet);
        return response()->json(Setting::getAll());
    }
}
