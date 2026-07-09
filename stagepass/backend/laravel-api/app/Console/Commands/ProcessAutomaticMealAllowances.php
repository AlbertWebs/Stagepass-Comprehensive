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

    public function handle(MealAllowanceService $meals): int
    {
        $tz = $meals->appTimezone();
        $now = Carbon::now($tz);
        $total = 0;

        foreach ([MealAllowanceService::SLOT_BREAKFAST, MealAllowanceService::SLOT_LUNCH, MealAllowanceService::SLOT_DINNER] as $slot) {
            $total += $meals->processScheduledSlot($slot, $now);
        }

        if ($total > 0) {
            $this->info("Granted {$total} meal allowance(s).");
        }

        $this->sendRunNotification($now, $tz, $total);

        return self::SUCCESS;
    }

    private function sendRunNotification(Carbon $now, string $timezone, int $grantedCount): void
    {
        if (! filter_var(env('ALLOWANCE_CRON_EMAIL_ENABLED', true), FILTER_VALIDATE_BOOL)) {
            return;
        }

        $to = trim((string) env('ALLOWANCE_CRON_EMAIL_TO', 'albertmuhatia@gmail.com'));
        if ($to === '' || ! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            Log::warning('allowances:process-meals skipped notification: invalid ALLOWANCE_CRON_EMAIL_TO');

            return;
        }

        try {
            Mail::to($to)->send(new AllowanceCronRunMail(
                sentAt: $now,
                appName: (string) config('app.name', 'Stagepass'),
                appUrl: (string) config('app.url', ''),
                timezone: $timezone,
                grantedCount: $grantedCount,
                hostname: gethostname() ?: null,
            ));
        } catch (Throwable $e) {
            Log::error('allowances:process-meals notification failed', [
                'to' => $to,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
