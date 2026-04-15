<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\AssignedEventOnLoginPush;
use App\Services\AttendanceOvertimeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private AttendanceOvertimeService $overtime
    ) {}

    private const DEFAULT_HOMEPAGE_PREFERENCES = [
        'visibility' => [
            'upcoming_events' => true,
            'my_events' => true,
            'attendance_stats' => true,
            'recent_activities' => true,
            'assigned_tasks' => true,
            'announcements' => true,
        ],
        'order' => [
            'upcoming_events',
            'my_events',
            'attendance_stats',
            'recent_activities',
            'assigned_tasks',
            'announcements',
        ],
        'layout' => 'comfortable',
    ];

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
        $this->sendAssignedEventPushOnLogin($request, $user);

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->formatUserPayload($user->load('roles')),
        ]);
    }

    /**
     * Return display name for login screen personalization (unauthenticated).
     * Query by username. Returns 404 if not found.
     */
    public function loginDisplayName(Request $request): JsonResponse
    {
        $identifier = $request->input('username');
        if (empty($identifier) || ! is_string($identifier)) {
            return response()->json(['message' => 'Username required'], 422);
        }
        $identifier = trim($identifier);
        $user = User::where('username', $identifier)->first();
        if (! $user) {
            return response()->json(['message' => 'Not found'], 404);
        }
        return response()->json(['name' => $user->name]);
    }

    private function sendAssignedEventPushOnLogin(Request $request, User $user): void
    {
        if (empty($user->fcm_token)) {
            return;
        }

        $localDate = $request->header('X-Local-Date');
        $today = $localDate && preg_match('/^\d{4}-\d{2}-\d{2}$/', $localDate)
            ? $localDate
            : now('Africa/Nairobi')->toDateString();

        $event = Event::query()
            ->spansDate($today)
            ->where(function ($q) use ($user) {
                $q->where('team_leader_id', $user->id)
                    ->orWhereHas('crew', fn ($crewQ) => $crewQ->where('user_id', $user->id));
            })
            ->whereNotIn('status', [Event::STATUS_COMPLETED, Event::STATUS_CLOSED, Event::STATUS_DONE_FOR_DAY])
            ->orderBy('start_time')
            ->first();

        if (! $event) {
            return;
        }

        $user->notify(new AssignedEventOnLoginPush($event));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('roles');
        // Use fixed timezone for office "today" so calendar day matches business location (Nairobi).
        $today = now('Africa/Nairobi')->toDateString();
        // Use whereDate so comparison is robust regardless of column cast/format.
        $officeCheckin = \App\Models\DailyOfficeCheckin::where('user_id', $user->id)
            ->whereDate('date', $today)
            ->first();
        $officeCheckedInToday = $officeCheckin !== null;

        // Diagnostic: if no row found, log recent check-ins for this user to compare stored dates.
        if (! $officeCheckin) {
            $recent = \App\Models\DailyOfficeCheckin::where('user_id', $user->id)
                ->orderByDesc('checkin_time')
                ->limit(3)
                ->get(['id', 'date', 'checkin_time']);
            Log::info('GET /me no office check-in today; recent rows', [
                'user_id' => $user->id,
                'today' => $today,
                'recent_dates' => $recent->map(fn ($r) => [
                    'id' => $r->id,
                    'date' => $r->date?->format('Y-m-d') ?? (is_string($r->date) ? $r->date : null),
                    'checkin_time' => $r->checkin_time?->toIso8601String(),
                ])->toArray(),
            ]);
        }
        $officeCheckinTime = $officeCheckin?->checkin_time?->toIso8601String();
        $officeCheckedOutToday = $officeCheckin?->checkout_time !== null;
        $officeCheckoutTime = $officeCheckin?->checkout_time?->toIso8601String();
        $officeLiveTotals = null;
        if ($officeCheckin?->checkin_time) {
            $officeLiveTotals = $this->overtime->calculate(
                $officeCheckin->checkin_time,
                $officeCheckin->checkout_time ?: now(config('app.timezone', 'Africa/Nairobi'))
            );
        }

        $hasApprovedTimeOffToday = \App\Models\TimeOffRequest::where('user_id', $user->id)
            ->where('status', \App\Models\TimeOffRequest::STATUS_APPROVED)
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->exists();

        $payload = $this->formatUserPayload($user);
        $payload['office_checked_in_today'] = $officeCheckedInToday;
        $payload['office_checkin_time'] = $officeCheckinTime;
        $payload['office_checked_out_today'] = $officeCheckedOutToday;
        $payload['office_checkout_time'] = $officeCheckoutTime;
        $payload['office_total_hours'] = $officeLiveTotals['total_hours'] ?? null;
        $payload['office_extra_hours'] = $officeLiveTotals['extra_hours'] ?? null;
        $payload['office_is_sunday'] = $officeLiveTotals['is_sunday'] ?? false;
        $payload['office_is_holiday'] = $officeLiveTotals['is_holiday'] ?? false;
        $payload['office_holiday_name'] = $officeLiveTotals['holiday_name'] ?? null;
        $payload['office_day_type'] = $officeLiveTotals['day_type'] ?? null;
        $payload['has_approved_time_off_today'] = $hasApprovedTimeOffToday;
        $payload['homepage_preferences'] = $this->normalizeHomepagePreferences($user->homepage_preferences);
        $payload['allow_biometric_mobile_login'] = $this->allowBiometricMobileLogin();

        Log::info('GET /me office state', [
            'user_id' => $user->id,
            'today' => $today,
            'office_checked_in_today' => $officeCheckedInToday,
            'office_checkin_time' => $officeCheckinTime,
        ]);

        return response()->json($payload);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $rules = [
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'phone' => 'sometimes|nullable|string|max:20',
            'phone_number' => 'sometimes|nullable|string|max:20',
            'address' => 'sometimes|nullable|string|max:1000',
            'emergency_contact' => 'sometimes|nullable|string|max:255',
            'password' => 'nullable|string|min:8|confirmed',
            'current_pin' => 'required_with:new_pin|nullable|string|max:20',
            'new_pin' => 'nullable|string|min:4|max:20|confirmed',
            'fcm_token' => 'nullable|string|max:500',
            'homepage_preferences' => 'sometimes|array',
        ];
        $validated = $request->validate($rules);
        if (! empty($validated['name'])) {
            $user->name = $validated['name'];
        }
        if (! empty($validated['email'])) {
            $user->email = $validated['email'];
        }
        if (array_key_exists('phone_number', $validated) || array_key_exists('phone', $validated)) {
            $phone = $validated['phone_number'] ?? $validated['phone'] ?? null;
            $user->phone = $phone !== '' ? $phone : null;
        }
        if (array_key_exists('address', $validated)) {
            $user->address = ($validated['address'] ?? '') !== '' ? $validated['address'] : null;
        }
        if (array_key_exists('emergency_contact', $validated)) {
            $user->emergency_contact = ($validated['emergency_contact'] ?? '') !== '' ? $validated['emergency_contact'] : null;
        }
        if (! empty($validated['password'])) {
            $user->password = $validated['password'];
        }
        if (array_key_exists('fcm_token', $validated)) {
            $user->fcm_token = $validated['fcm_token'] ?: null;
        }
        if (array_key_exists('homepage_preferences', $validated)) {
            $user->homepage_preferences = $this->normalizeHomepagePreferences($validated['homepage_preferences']);
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
        return response()->json($this->formatUserPayload($user->fresh()->load('roles')));
    }

    private function allowBiometricMobileLogin(): bool
    {
        return Setting::getBool('allow_biometric_mobile_login', true);
    }

    private function normalizeHomepagePreferences(?array $prefs): array
    {
        $base = self::DEFAULT_HOMEPAGE_PREFERENCES;
        if (! is_array($prefs)) {
            return $base;
        }

        $visibility = $base['visibility'];
        if (isset($prefs['visibility']) && is_array($prefs['visibility'])) {
            foreach ($visibility as $key => $default) {
                if (array_key_exists($key, $prefs['visibility'])) {
                    $visibility[$key] = (bool) $prefs['visibility'][$key];
                }
            }
        }

        $allowedOrder = array_keys($base['visibility']);
        $incomingOrder = isset($prefs['order']) && is_array($prefs['order']) ? $prefs['order'] : [];
        $order = [];
        foreach ($incomingOrder as $item) {
            if (is_string($item) && in_array($item, $allowedOrder, true) && ! in_array($item, $order, true)) {
                $order[] = $item;
            }
        }
        foreach ($allowedOrder as $item) {
            if (! in_array($item, $order, true)) {
                $order[] = $item;
            }
        }

        $layout = isset($prefs['layout']) && in_array($prefs['layout'], ['compact', 'comfortable'], true)
            ? $prefs['layout']
            : $base['layout'];

        return [
            'visibility' => $visibility,
            'order' => $order,
            'layout' => $layout,
        ];
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

        // Use the incoming request root so avatars work when APP_URL still points at localhost
        // but the API is served from a public host (e.g. https://app.stagepass.co.ke).
        $base = rtrim($request->root(), '/');
        $user->avatar_url = $base . '/storage/' . $path;
        $user->save();

        return response()->json($this->formatUserPayload($user->fresh()->load('roles')));
    }

    /**
     * Keep payload backward compatible with mobile app fields.
     */
    private function formatUserPayload(User $user): array
    {
        $payload = $user->toArray();
        $payload['phone_number'] = $user->phone;
        $payload['address'] = $user->address;
        $payload['emergency_contact'] = $user->emergency_contact;

        return $payload;
    }
}
