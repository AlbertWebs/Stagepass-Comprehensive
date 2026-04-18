<?php

namespace App\Console\Commands;

use App\Models\DailyOfficeCheckin;
use App\Models\EventUser;
use App\Models\OvertimeNotificationLog;
use App\Models\User;
use App\Services\AttendanceOvertimeService;
use App\Services\ExpoPushSender;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendOvertimeThresholdNotifications extends Command
{
    protected $signature = 'attendance:send-overtime-threshold-notifications';

    protected $description = 'Notify users when worked time reaches 8 hours (extra hours start) for open office/event sessions';

    private const MESSAGE = 'Extra hours are starting now. Your standard 8 working hours have been completed.';

    public function __construct(
        private AttendanceOvertimeService $overtime,
        private ExpoPushSender $expoPush
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $tz = 'Africa/Nairobi';
        $now = Carbon::now($tz);
        $officeCount = 0;
        $eventCount = 0;

        DailyOfficeCheckin::query()
            ->whereNull('checkout_time')
            ->whereNotNull('checkin_time')
            ->whereNull('overtime_threshold_notified_at')
            ->chunkById(100, function ($rows) use ($tz, $now, &$officeCount) {
                foreach ($rows as $record) {
                    $calc = $this->overtime->calculate(
                        Carbon::parse($record->checkin_time),
                        $now,
                        $tz
                    );
                    if ($calc['total_minutes'] < AttendanceOvertimeService::STANDARD_MINUTES) {
                        continue;
                    }
                    $user = User::find($record->user_id);
                    if (! $user) {
                        continue;
                    }
                    if (empty($user->fcm_token)) {
                        $record->overtime_threshold_notified_at = $now;
                        $record->save();

                        continue;
                    }
                    $sent = $this->expoPush->send(
                        $user->fcm_token,
                        'Extra hours',
                        self::MESSAGE,
                        ['type' => 'overtime_threshold', 'context' => 'office', 'daily_office_checkin_id' => (string) $record->id]
                    );
                    if ($sent) {
                        $record->overtime_threshold_notified_at = $now;
                        $record->save();
                        OvertimeNotificationLog::create([
                            'user_id' => $user->id,
                            'context' => 'office',
                            'daily_office_checkin_id' => $record->id,
                            'event_user_id' => null,
                            'message' => self::MESSAGE,
                        ]);
                        $officeCount++;
                        Log::info('Overtime threshold push (office)', [
                            'user_id' => $user->id,
                            'daily_office_checkin_id' => $record->id,
                        ]);
                    }
                }
            });

        EventUser::query()
            ->whereNotNull('checkin_time')
            ->whereNull('checkout_time')
            ->whereNull('overtime_threshold_notified_at')
            ->chunkById(100, function ($rows) use (&$eventCount) {
                $asOf = Carbon::now();
                foreach ($rows as $assignment) {
                    $pausedMinutes = (int) ($assignment->pause_duration ?? 0);
                    if ($assignment->is_paused && $assignment->pause_start_time) {
                        $pausedMinutes += Carbon::parse($assignment->pause_start_time)->diffInMinutes($asOf);
                    }
                    $calc = $this->overtime->calculate(
                        Carbon::parse($assignment->checkin_time),
                        $asOf,
                        null,
                        $pausedMinutes
                    );
                    if ($calc['total_minutes'] < AttendanceOvertimeService::STANDARD_MINUTES) {
                        continue;
                    }
                    $user = User::find($assignment->user_id);
                    if (! $user) {
                        continue;
                    }
                    if (empty($user->fcm_token)) {
                        $assignment->overtime_threshold_notified_at = $asOf;
                        $assignment->save();

                        continue;
                    }
                    $sent = $this->expoPush->send(
                        $user->fcm_token,
                        'Extra hours',
                        self::MESSAGE,
                        ['type' => 'overtime_threshold', 'context' => 'event', 'event_user_id' => (string) $assignment->id]
                    );
                    if ($sent) {
                        $assignment->overtime_threshold_notified_at = $asOf;
                        $assignment->save();
                        OvertimeNotificationLog::create([
                            'user_id' => $user->id,
                            'context' => 'event',
                            'daily_office_checkin_id' => null,
                            'event_user_id' => $assignment->id,
                            'message' => self::MESSAGE,
                        ]);
                        $eventCount++;
                        Log::info('Overtime threshold push (event)', [
                            'user_id' => $user->id,
                            'event_user_id' => $assignment->id,
                        ]);
                    }
                }
            });

        if ($officeCount > 0 || $eventCount > 0) {
            $this->info("Sent office: {$officeCount}, event: {$eventCount}");
        }

        return self::SUCCESS;
    }
}
