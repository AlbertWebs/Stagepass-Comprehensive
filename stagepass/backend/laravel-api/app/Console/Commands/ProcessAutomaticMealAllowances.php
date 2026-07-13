<?php

namespace App\Console\Commands;

use App\Mail\AllowanceCronRunMail;
use App\Services\MealAllowanceService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class ProcessAutomaticMealAllowances extends Command
{
    protected $signature = 'allowances:process-meals';

    protected $description = 'Grant automatic meal allowances at configured times with role-based amounts.';

    private const NOTIFY_TO = 'albertmuhatia@gmail.com';

    public function handle(MealAllowanceService $meals): int
    {
        $tz = $meals->appTimezone();
        $now = Carbon::now($tz);
        $slotResults = [];
        $total = 0;
        $status = 'success';
        $errorMessage = null;

        try {
            foreach ([MealAllowanceService::SLOT_BREAKFAST, MealAllowanceService::SLOT_LUNCH, MealAllowanceService::SLOT_DINNER] as $slot) {
                $scheduledTime = $meals->scheduledTimeForSlot($slot);
                $dueThisMinute = $scheduledTime === $now->format('H:i');
                $granted = $meals->processScheduledSlot($slot, $now);
                $total += $granted;

                $slotResults[] = [
                    'slot' => $slot,
                    'label' => $meals->typeNameForSlot($slot),
                    'scheduled_time' => $scheduledTime,
                    'due_this_minute' => $dueThisMinute,
                    'granted' => $granted,
                ];
            }
        } catch (Throwable $e) {
            $status = 'failed';
            $errorMessage = $e->getMessage();
            Log::error('allowances:process-meals failed', [
                'error' => $errorMessage,
            ]);
            $this->error($errorMessage);
        }

        if ($total > 0) {
            $this->info("Granted {$total} meal allowance(s).");
            $this->sendRunNotification($now, $tz, $total, $status, $slotResults, $errorMessage);
        } else {
            Log::info('allowances:process-meals completed with no allocations', [
                'status' => $status,
                'at' => $now->toIso8601String(),
            ]);
        }

        return $status === 'success' ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @param  list<array{slot: string, label: string, scheduled_time: string, due_this_minute: bool, granted: int}>  $slotResults
     */
    private function sendRunNotification(
        Carbon $now,
        string $timezone,
        int $grantedCount,
        string $status,
        array $slotResults,
        ?string $errorMessage,
    ): void {
        $to = trim((string) env('ALLOWANCE_CRON_EMAIL_TO', self::NOTIFY_TO));
        if ($to === '' || ! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $to = self::NOTIFY_TO;
        }

        try {
            Mail::to($to)->send(new AllowanceCronRunMail(
                sentAt: $now,
                appName: (string) config('app.name', 'Stagepass'),
                appUrl: (string) config('app.url', ''),
                timezone: $timezone,
                grantedCount: $grantedCount,
                hostname: gethostname() ?: null,
                status: $status,
                slotResults: $slotResults,
                errorMessage: $errorMessage,
            ));
            Log::info('allowances:process-meals notification sent', [
                'to' => $to,
                'status' => $status,
                'granted' => $grantedCount,
            ]);
        } catch (Throwable $e) {
            Log::error('allowances:process-meals notification failed', [
                'to' => $to,
                'error' => $e->getMessage(),
            ]);
            $this->error('Failed to send run email: '.$e->getMessage());
        }
    }
}
