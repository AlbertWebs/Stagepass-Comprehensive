<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\UserCreatedMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::query()->with('roles');

        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(function ($qry) use ($q) {
                $qry->where('name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%")
                    ->orWhere('username', 'like', "%{$q}%");
            });
        }

        if ($request->filled('role')) {
            $query->whereHas('roles', fn ($q) => $q->where('name', $request->role));
        }

        $users = $query->orderBy('name')->paginate($request->input('per_page', 20));

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'username' => 'nullable|string|max:80|unique:users,username',
            'pin' => 'nullable|string|max:20',
            'phone' => 'nullable|string|max:20',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        $user = new User;
        $user->name = $validated['name'];
        $user->email = $validated['email'];
        $user->password = $validated['password'];
        if (! empty($validated['username'])) {
            $user->username = $validated['username'];
        }
        if (! empty($validated['pin'])) {
            $user->pin = $validated['pin'];
        }
        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'];
        }
        $user->save();

        if (! empty($validated['role_ids'])) {
            $user->roles()->sync($validated['role_ids']);
        }

        if ($user->email) {
            try {
                $plainPin = isset($validated['pin']) && $validated['pin'] !== '' && $validated['pin'] !== null
                    ? (string) $validated['pin']
                    : null;
                Mail::to($user->email)->send(new UserCreatedMail(
                    user: $user,
                    webPassword: $validated['password'],
                    mobilePin: $plainPin,
                    isResend: false,
                ));
            } catch (\Throwable $e) {
                Log::warning('User created but welcome email failed', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'message' => $e->getMessage(),
                ]);
            }
        }

        return response()->json($user->load('roles'), 201);
    }

    public function show(User $user): JsonResponse
    {
        $user->load('roles');
        return response()->json($user);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            'username' => ['nullable', 'string', 'max:80', Rule::unique('users', 'username')->ignore($user->id)],
            'pin' => 'nullable|string|max:20',
            'phone' => 'nullable|string|max:20',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        if (isset($validated['name'])) {
            $user->name = $validated['name'];
        }
        if (isset($validated['email'])) {
            $user->email = $validated['email'];
        }
        if (! empty($validated['password'])) {
            $user->password = $validated['password'];
        }
        if (array_key_exists('username', $validated)) {
            $user->username = $validated['username'] ?: null;
        }
        if (array_key_exists('pin', $validated)) {
            $user->pin = $validated['pin'] ?: null;
        }
        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'] ?: null;
        }
        $user->save();

        if (array_key_exists('role_ids', $validated)) {
            $user->roles()->sync($validated['role_ids'] ?? []);
        }

        return response()->json($user->fresh()->load('roles'));
    }

    /**
     * Resend welcome / sign-in details email (optional new password and/or PIN applied first).
     */
    public function sendWelcomeEmail(Request $request, User $user): JsonResponse
    {
        $admin = $request->user();
        if (! $admin->hasRole('super_admin') && ! $admin->hasRole('director') && ! $admin->hasRole('admin')) {
            return response()->json(['message' => 'Only admins can send welcome emails.'], 403);
        }

        $validated = $request->validate([
            'password' => 'nullable|string|min:8',
            'pin' => 'nullable|string|max:20',
        ]);

        $plainPassword = ! empty($validated['password']) ? (string) $validated['password'] : null;
        $plainPin = array_key_exists('pin', $validated) && $validated['pin'] !== '' && $validated['pin'] !== null
            ? (string) $validated['pin']
            : null;

        if ($plainPassword !== null) {
            $user->password = $plainPassword;
        }
        if ($plainPin !== null) {
            $user->pin = $plainPin;
        }
        if ($plainPassword !== null || $plainPin !== null) {
            $user->save();
        }

        if (! $user->email) {
            return response()->json(['message' => 'This user has no email address.'], 422);
        }

        try {
            Mail::to($user->email)->send(new UserCreatedMail(
                user: $user->fresh()->load('roles'),
                webPassword: $plainPassword,
                mobilePin: $plainPin,
                isResend: true,
            ));
        } catch (\Throwable $e) {
            Log::warning('Welcome email send failed', [
                'user_id' => $user->id,
                'message' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Could not send email. Check mail configuration.'], 500);
        }

        return response()->json(['message' => 'Welcome email sent.']);
    }

    public function destroy(User $user): JsonResponse
    {
        $user->delete();
        return response()->json(null, 204);
    }

    /**
     * Admin: set or reset another user's PIN (no current PIN required).
     */
    public function setPin(Request $request, User $user): JsonResponse
    {
        $admin = $request->user();
        if (! $admin->hasRole('super_admin') && ! $admin->hasRole('director') && ! $admin->hasRole('admin')) {
            return response()->json(['message' => 'Only admins can set a user\'s PIN.'], 403);
        }

        $validated = $request->validate([
            'new_pin' => 'required|string|min:4|max:20',
            'new_pin_confirmation' => 'required|string|same:new_pin',
        ]);

        $user->pin = $validated['new_pin'];
        $user->save();

        return response()->json($user->fresh()->load('roles'));
    }
}
