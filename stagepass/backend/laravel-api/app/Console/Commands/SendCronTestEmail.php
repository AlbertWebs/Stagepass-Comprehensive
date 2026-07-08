<?php

namespace App\Console\Commands;

use App\Mail\CronHeartbeatMail;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SendCronTestEmail extends Command
{
    protected $signature = 'cron:send-test-email
                            {--to= : Recipient (default: CRON_TEST_EMAIL_TO or albertmuhatia@gmail.com)}';

    protected $description = 'Send a cron/scheduler heartbeat email (for verifying cPanel cron).';

    public function handle(): int
    {
        $to = trim((string) ($this->option('to') ?: env('CRON_TEST_EMAIL_TO', 'albertmuhatia@gmail.com')));
        if ($to === '' || ! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $this->error('A valid recipient email is required.');

            return self::FAILURE;
        }

        $tz = (string) config('app.timezone', 'UTC');
        $now = Carbon::now($tz);

        try {
            Mail::to($to)->send(new CronHeartbeatMail(
                sentAt: $now,
                appName: (string) config('app.name', 'Stagepass'),
                appUrl: (string) config('app.url', ''),
                timezone: $tz,
                hostname: gethostname() ?: null,
            ));
        } catch (Throwable $e) {
            Log::error('cron:send-test-email failed', [
                'to' => $to,
                'error' => $e->getMessage(),
            ]);
            $this->error('Failed to send: '.$e->getMessage());

            return self::FAILURE;
        }

        Log::info('cron:send-test-email sent', ['to' => $to, 'at' => $now->toIso8601String()]);
        $this->info("Cron heartbeat sent to {$to} at {$now->toDateTimeString()} ({$tz}).");

        return self::SUCCESS;
    }
}
