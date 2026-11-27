<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\UserCreatedMail;
use App\Models\User;
use App\Services\TestDataWiper;
use App\Services\AuditTrail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $isTeamLeader = $actor->hasRole('team_leader') || $actor->hasRole('teamleader');
        if (! $this->canAdminPanel($request, 'employees.view') && ! $isTeamLeader) {
            return response()->json(['message' => 'You do not have permission to view the crew directory.'], 403);
        }

        $query = User::query()->with('roles');
        if ($isTeamLeader && ! $this->canAdminPanel($request, 'employees.view')) {
            // Team leaders need the crew picker, not access to administrative or HR accounts.
            $query->whereDoesntHave('roles', fn ($roles) => $roles->whereIn('name', ['super_admin', 'admin', 'director', 'hr', 'accounts']));
        }

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

        $users = $query->orderBy('name')->paginate(min(max((int) $request->input('per_page', 20), 1), 100));

        if (! $actor->hasSuperAdminAccess()) {
            $users->getCollection()->each(fn (User $user) => $user->makeHidden(['last_login_at', 'last_login_ip']));
        }

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->canAdminPanel($request, 'employees.create')) {
            return response()->json(['message' => 'You do not have permission to create employee accounts.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'username' => 'nullable|string|max:80|unique:users,username',
            'pin' => 'nullable|string|max:20',
            'phone' => 'nullable|string|max:20',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'exists:roles,id',
            'is_active' => 'sometimes|boolean',
        ]);

        if (! $request->user()->hasSuperAdminAccess() && ! empty($validated['role_ids'])) {
            return response()->json(['message' => 'Only a Super Administrator can assign account roles.'], 403);
        }

        $user = new User;
        $user->name = $validated['name'];
        $user->email = $validated['email'];
        $user->password = $validated['password'];
        $user->is_active = $validated['is_active'] ?? true;
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
        if (array_key_exists('is_active', $validated)) {
            $user->is_active = $validated['is_active'];
            $user->save();
        }
        app(AuditTrail::class)->record($request, 'user.created', $user, [], [
            'name' => $user->name, 'email' => $user->email, 'username' => $user->username,
            'phone' => $user->phone, 'is_active' => $user->is_active,
            'roles' => $user->roles()->pluck('name')->all(),
        ]);

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

    public function show(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        $isTeamLeader = $actor->hasRole('team_leader') || $actor->hasRole('teamleader');
        if (! $this->canAdminPanel($request, 'employees.view') && ! $isTeamLeader) {
            return response()->json(['message' => 'You do not have permission to view this employee.'], 403);
        }
        if ($isTeamLeader && ! $this->canAdminPanel($request, 'employees.view') && $user->roles()->whereIn('name', ['super_admin', 'admin', 'director', 'hr', 'accounts'])->exists()) {
            return response()->json(['message' => 'You do not have permission to view this account.'], 403);
        }

        $user->load('roles');
        return response()->json($user);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        if (! $this->canAdminPanel($request, 'employees.edit')) {
            return response()->json(['message' => 'You do not have permission to edit employee accounts.'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => 'nullable|string|min:8',
            'username' => ['nullable', 'string', 'max:80', Rule::unique('users', 'username')->ignore($user->id)],
            'pin' => 'nullable|string|max:20',
            'phone' => 'nullable|string|max:20',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'exists:roles,id',
            'is_active' => 'sometimes|boolean',
        ]);

        $actor = $request->user();
        if (! $actor->hasSuperAdminAccess() && (array_key_exists('password', $validated) || array_key_exists('pin', $validated))) {
            return response()->json(['message' => 'Only a Super Administrator can reset sign-in credentials.'], 403);
        }
        if (array_key_exists('role_ids', $validated) && ! $actor->hasSuperAdminAccess()) {
            return response()->json(['message' => 'Only a Super Administrator can assign account roles.'], 403);
        }
        $before = [
            'name' => $user->name, 'email' => $user->email, 'username' => $user->username,
            'phone' => $user->phone, 'is_active' => $user->is_active,
            'roles' => $user->roles()->pluck('name')->all(),
        ];
        if (array_key_exists('role_ids', $validated) && collect($validated['role_ids'] ?? [])->contains(fn ($id) => \App\Models\Role::whereKey($id)->where('name', 'super_admin')->exists()) && ! $actor->hasSuperAdminAccess()) {
            return response()->json(['message' => 'Only a Super Administrator can grant Super Administrator access.'], 403);
        }

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
        if (array_key_exists('is_active', $validated)) {
            if (! $actor->hasSuperAdminAccess()) {
                return response()->json(['message' => 'Only a Super Administrator can activate or deactivate accounts.'], 403);
            }
            if (! $validated['is_active'] && $this->isLastActiveSuperAdministrator($user)) {
                return response()->json(['message' => 'The last active Super Administrator cannot be deactivated.'], 422);
            }
            $user->is_active = $validated['is_active'];
        }
        $user->save();

        if (array_key_exists('role_ids', $validated)) {
            if ($this->isLastActiveSuperAdministrator($user) && ! collect($validated['role_ids'] ?? [])->contains(fn ($id) => \App\Models\Role::whereKey($id)->whereIn('name', ['super_admin', 'admin', 'director'])->exists())) {
                return response()->json(['message' => 'At least one active Super Administrator must remain.'], 422);
            }
            $user->roles()->sync($validated['role_ids'] ?? []);
        }
        if (! $user->is_active) {
            $user->tokens()->delete();
        }
        $updatedUser = $user->fresh();
        app(AuditTrail::class)->record($request, 'user.updated', $updatedUser, $before, [
            'name' => $updatedUser->name, 'email' => $updatedUser->email, 'username' => $updatedUser->username,
            'phone' => $updatedUser->phone, 'is_active' => $updatedUser->is_active,
            'roles' => $updatedUser->roles()->pluck('name')->all(),
            'credentials_reset' => ! empty($validated['password']) || ! empty($validated['pin']),
        ]);

        return response()->json($updatedUser->load('roles'));
    }

    /**
     * Resend welcome / sign-in details email (optional new password and/or PIN applied first).
     */
    public function sendWelcomeEmail(Request $request, User $user): JsonResponse
    {
        $admin = $request->user();
        if (! $admin->hasSuperAdminAccess()) {
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
            Log::error('Welcome email send failed', [
                'user_id' => $user->id,
                'exception' => $e->getMessage(),
            ]);

            $payload = ['message' => 'Could not send email. Check mail configuration.'];
            if (config('app.debug')) {
                $payload['details'] = $e->getMessage();
            }

            return response()->json($payload, 500);
        }

        return response()->json(['message' => 'Welcome email sent.']);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if (! $request->user()->hasSuperAdminAccess()) {
            return response()->json(['message' => 'Only a Super Administrator can delete employee accounts.'], 403);
        }
        if ($this->isLastActiveSuperAdministrator($user)) {
            return response()->json(['message' => 'The last active Super Administrator cannot be deleted.'], 422);
        }
        app(AuditTrail::class)->record($request, 'user.deleted', $user, [
            'name' => $user->name, 'email' => $user->email,
            'roles' => $user->roles()->pluck('name')->all(), 'is_active' => $user->is_active,
        ]);
        $user->delete();
        return response()->json(null, 204);
    }

    private function isLastActiveSuperAdministrator(User $user): bool
    {
        $isSuper = $user->roles()->whereIn('name', ['super_admin', 'admin', 'director'])->exists();
        if (! $isSuper || ! $user->is_active) return false;

        return ! User::query()->where('is_active', true)->where('id', '<>', $user->id)
            ->whereHas('roles', fn ($query) => $query->whereIn('name', ['super_admin', 'admin', 'director']))->exists();
    }

    /**
     * Admin: delete all non-admin users (Crew page lists everyone; many have no "crew" role).
     * Never deletes admins, directors, or the current user.
     */
    public function destroyAllCrew(Request $request, TestDataWiper $wiper): JsonResponse
    {
        $admin = $request->user();
        if (! $admin->hasSuperAdminAccess()) {
            return response()->json(['message' => 'Only admins can delete all crew members.'], 403);
        }

        $request->validate([
            'confirm' => 'required|string|in:DELETE ALL CREW',
        ]);

        $deleted = $wiper->deleteAllNonProtectedUsers($admin);

        return response()->json([
            'message' => $deleted === 0
                ? 'No crew members were deleted.'
                : "Deleted {$deleted} crew member".($deleted === 1 ? '' : 's').'.',
            'deleted' => $deleted,
        ]);
    }

    /**
     * Admin: set or reset another user's PIN (no current PIN required).
     */
    public function setPin(Request $request, User $user): JsonResponse
    {
        $admin = $request->user();
        if (! $admin->hasSuperAdminAccess()) {
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

    private function canAdminPanel(Request $request, string $permission): bool
    {
        $actor = $request->user();
        if (! $actor) return false;
        if ($actor->hasSuperAdminAccess()) return true;
        $abilities = $actor->currentAccessToken()?->abilities ?? [];
        return in_array('admin-panel', $abilities, true) && $actor->is_active && $actor->hasPermission($permission);
    }
}
