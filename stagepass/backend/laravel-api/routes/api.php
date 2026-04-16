<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CommunicationController;
use App\Http\Controllers\Api\DbHealthController;
use App\Http\Controllers\Api\DocsController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\EquipmentController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\EventCrewController;
use App\Http\Controllers\Api\EarnedAllowanceController;
use App\Http\Controllers\Api\HolidayController;
use App\Http\Controllers\Api\EventEquipmentController;
use App\Http\Controllers\Api\EventNoteController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReportsController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\TimeOffController;
use App\Http\Controllers\Api\VehicleController;
use App\Http\Controllers\Api\EventTransportController;
use App\Http\Controllers\Api\BackupController;
use App\Http\Controllers\Api\CheckinsController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\DangerZoneController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::get('/health/db', DbHealthController::class);
Route::get('/settings/public-app', [SettingsController::class, 'publicAppConfig']);
Route::get('/login-display-name', [AuthController::class, 'loginDisplayName']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/me', [AuthController::class, 'me'])->middleware('auth:sanctum');
Route::patch('/me', [AuthController::class, 'updateProfile'])->middleware('auth:sanctum');
Route::post('/me/photo', [AuthController::class, 'uploadPhoto'])->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('roles', [RoleController::class, 'index']);
    Route::get('users', [UserController::class, 'index']);
    Route::post('users', [UserController::class, 'store']);
    Route::post('users/{user}/welcome-email', [UserController::class, 'sendWelcomeEmail']);
    Route::get('users/{user}', [UserController::class, 'show']);
    Route::put('users/{user}', [UserController::class, 'update']);
    Route::post('users/{user}/set-pin', [UserController::class, 'setPin']);
    Route::delete('users/{user}', [UserController::class, 'destroy']);
    Route::get('my-event-today', [EventController::class, 'myEventToday']);
    Route::apiResource('events', EventController::class);
    Route::post('events/{event}/assign-user', [EventCrewController::class, 'assignUser']);
    Route::get('events/{event}/crew-status', [EventCrewController::class, 'crewStatus']);
    Route::post('events/{event}/attendance/manual-checkin/{user}', [EventCrewController::class, 'manualCheckin']);
    Route::post('events/{event}/crew/{user}/pause', [EventCrewController::class, 'pauseCrew']);
    Route::post('events/{event}/crew/{user}/resume', [EventCrewController::class, 'resumeCrew']);
    Route::post('events/{event}/crew/{user}/transport', [EventCrewController::class, 'recordTransport']);
    Route::delete('events/{event}/crew/{user}', [EventCrewController::class, 'removeUser']);
    Route::post('events/{event}/transfer-user', [EventCrewController::class, 'transferUser']);
    Route::get('events/{event}/notes', [EventNoteController::class, 'index']);
    Route::post('events/{event}/notes', [EventNoteController::class, 'store']);
    Route::post('events/{event}/end', [EventController::class, 'end']);
    Route::post('events/{event}/done-for-day', [EventController::class, 'doneForDay']);
    Route::get('attendance/stats', [AttendanceController::class, 'stats']);
    Route::post('attendance/checkin', [AttendanceController::class, 'checkin']);
    Route::post('attendance/office-checkin', [AttendanceController::class, 'officeCheckin']);
    Route::post('attendance/office-checkout', [AttendanceController::class, 'officeCheckout']);
    Route::post('attendance/checkout', [AttendanceController::class, 'checkout']);

    Route::get('clients', [ClientController::class, 'index']);
    Route::post('clients', [ClientController::class, 'store']);
    Route::get('clients/{client}', [ClientController::class, 'show']);
    Route::put('clients/{client}', [ClientController::class, 'update']);
    Route::delete('clients/{client}', [ClientController::class, 'destroy']);

    Route::get('equipment', [EquipmentController::class, 'index']);
    Route::post('equipment', [EquipmentController::class, 'store']);
    Route::get('equipment/{equipment}', [EquipmentController::class, 'show']);
    Route::put('equipment/{equipment}', [EquipmentController::class, 'update']);
    Route::delete('equipment/{equipment}', [EquipmentController::class, 'destroy']);
    Route::post('events/{event}/equipment', [EventEquipmentController::class, 'attach']);
    Route::post('events/{event}/equipment/confirm', [EventEquipmentController::class, 'confirm']);

    Route::get('vehicles', [VehicleController::class, 'index']);
    Route::post('vehicles', [VehicleController::class, 'store']);
    Route::get('vehicles/{vehicle}', [VehicleController::class, 'show']);
    Route::put('vehicles/{vehicle}', [VehicleController::class, 'update']);
    Route::delete('vehicles/{vehicle}', [VehicleController::class, 'destroy']);

    Route::get('transport/assignments', [EventTransportController::class, 'index']);
    Route::post('events/{event}/transport', [EventTransportController::class, 'store']);
    Route::delete('transport/assignments/{eventVehicle}', [EventTransportController::class, 'destroy']);

    Route::get('communications', [CommunicationController::class, 'index']);
    Route::post('communications', [CommunicationController::class, 'store']);
    Route::get('communications/{communication}', [CommunicationController::class, 'show']);
    Route::delete('communications/{communication}', [CommunicationController::class, 'destroy']);

    Route::get('reports', ReportsController::class);
    Route::get('reports/events', [ReportsController::class, 'events']);
    Route::get('reports/crew-attendance', [ReportsController::class, 'crewAttendance']);
    Route::get('reports/crew-payments', [ReportsController::class, 'crewPayments']);
    Route::get('reports/tasks', [ReportsController::class, 'tasks']);
    Route::get('reports/financial', [ReportsController::class, 'financial']);
    Route::get('reports/end-of-day', [ReportsController::class, 'endOfDay']);
    Route::get('reports/export', [ReportsController::class, 'export']);
    Route::get('holidays', [HolidayController::class, 'index']);
    Route::post('holidays', [HolidayController::class, 'store']);
    Route::put('holidays/{holiday}', [HolidayController::class, 'update']);
    Route::delete('holidays/{holiday}', [HolidayController::class, 'destroy']);
    Route::get('checkins/server-date', [CheckinsController::class, 'serverDate']);
    Route::get('checkins', [CheckinsController::class, 'index']);
    Route::get('checkins/daily-status', [CheckinsController::class, 'dailyEmployeeStatus']);
    Route::post('checkins/set-employee-off', [CheckinsController::class, 'setEmployeeOff']);
    Route::post('checkins/send-push', [CheckinsController::class, 'sendPush']);
    Route::get('audit-logs', [AuditLogController::class, 'index']);
    Route::get('docs/guides', [DocsController::class, 'index']);
    Route::get('docs/guides/{name}', [DocsController::class, 'show']);

    Route::get('payments', [PaymentController::class, 'index']);
    Route::post('payments/initiate', [PaymentController::class, 'initiate']);
    Route::post('payments/approve', [PaymentController::class, 'approve']);
    Route::post('payments/reject', [PaymentController::class, 'reject']);
    Route::get('payments/earned-allowances', [EarnedAllowanceController::class, 'index']);
    Route::post('payments/earned-allowances', [EarnedAllowanceController::class, 'store']);
    Route::post('payments/earned-allowances/{eventAllowance}/status', [EarnedAllowanceController::class, 'updateStatus']);
    Route::get('payments/earned-allowances/export', [EarnedAllowanceController::class, 'export']);
    Route::get('payments/allowance-types', [EarnedAllowanceController::class, 'typeIndex']);
    Route::post('payments/allowance-types', [EarnedAllowanceController::class, 'typeStore']);
    Route::put('payments/allowance-types/{allowanceType}', [EarnedAllowanceController::class, 'typeUpdate']);

    Route::get('timeoff', [TimeOffController::class, 'index']);
    Route::post('timeoff', [TimeOffController::class, 'store']);
    Route::put('timeoff/{id}', [TimeOffController::class, 'update']);
    Route::post('timeoff/request', [TimeOffController::class, 'request']);
    Route::post('timeoff/request/{id}/attachments', [TimeOffController::class, 'uploadAttachments']);
    Route::post('timeoff/approve', [TimeOffController::class, 'approve']);
    Route::post('timeoff/reject', [TimeOffController::class, 'reject']);

    Route::get('tasks', [TaskController::class, 'index']);
    Route::post('tasks', [TaskController::class, 'store']);
    Route::get('tasks/{task}', [TaskController::class, 'show']);
    Route::put('tasks/{task}', [TaskController::class, 'update']);
    Route::delete('tasks/{task}', [TaskController::class, 'destroy']);
    Route::patch('tasks/{task}/status', [TaskController::class, 'updateStatus']);
    Route::get('tasks/{task}/comments', [TaskController::class, 'comments']);
    Route::post('tasks/{task}/comments', [TaskController::class, 'storeComment']);

    Route::get('backup', BackupController::class);
    Route::post('danger-zone/wipe-non-user-data', [DangerZoneController::class, 'wipeNonUserData']);
    Route::get('settings/office-checkin-config', [SettingsController::class, 'officeCheckinConfig']);
    Route::get('settings', [SettingsController::class, 'index']);
    Route::put('settings', [SettingsController::class, 'update']);
    Route::post('settings', [SettingsController::class, 'update']);
});
