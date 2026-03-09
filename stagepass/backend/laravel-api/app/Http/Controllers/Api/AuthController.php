<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $username = $request->input('username');
        $pin = $request->input('pin');

        // Mobile: username + PIN
        if ($username !== null && $pin !== null) {
            $request->validate([
                'username' => 'required|string|max:80',
                'pin' => 'required|string|max:20',
                'fcm_token' => 'nullable|string',
            ]);

            $user = User::where('username', $request->username)->first();

            if (! $user || ! $user->pin || ! Hash::check($request->pin, $user->pin)) {
                throw ValidationException::withMessages([
                    'username' => ['The provided credentials are incorrect.'],
                ]);
            }
        } else {
            // Web admin: email + password
            $request->validate([
                'email' => 'required|email',
                'password' => 'required',
                'fcm_token' => 'nullable|string',
            ]);

            $user = User::where('email', $request->email)->first();

            if (! $user || ! Hash::check($request->password, $user->password)) {
                throw ValidationException::withMessages([
                    'email' => ['The provided credentials are incorrect.'],
                ]);
            }
        }

        $user->forceFill(['fcm_token' => $request->fcm_token])->save();

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->load('roles'),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()->load('roles'));
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $rules = [
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:8|confirmed',
            'current_pin' => 'required_with:new_pin|nullable|string|max:20',
            'new_pin' => 'nullable|string|min:4|max:20|confirmed',
        ];
        $validated = $request->validate($rules);
        if (! empty($validated['name'])) {
            $user->name = $validated['name'];
        }
        if (! empty($validated['email'])) {
            $user->email = $validated['email'];
        }
        if (! empty($validated['password'])) {
            $user->password = $validated['password'];
        }
        if (! empty($validated['new_pin'])) {
            if (empty($user->pin)) {
                throw ValidationException::withMessages(['current_pin' => ['PIN is not set for this account.']]);
            }
            if (! Hash::check($validated['current_pin'], $user->pin)) {
                throw ValidationException::withMessages(['current_pin' => ['Current PIN is incorrect.']]);
            }
            $user->pin = $validated['new_pin'];
        }
        $user->save();
        return response()->json($user->fresh()->load('roles'));
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);

        Password::sendResetLink($request->only('email'));

        return response()->json([
            'message' => 'If an account exists for that email, we have sent a password reset link.',
        ]);
    }

    /**
     * Upload profile/passport photo. Expects multipart form with "photo" file.
     * Returns the updated user (with avatar_url).
     */
    public function uploadPhoto(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpeg,jpg,png|max:5120',
        ]);

        $user = $request->user();
        $file = $request->file('photo');

        $dir = 'profiles';
        $name = $user->id . '_' . now()->format('YmdHis') . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs($dir, $name, 'public');

        $base = rtrim(config('app.url'), '/');
        $user->avatar_url = $base . '/storage/' . $path;
        $user->save();

        return response()->json($user->fresh()->load('roles'));
    }
}
