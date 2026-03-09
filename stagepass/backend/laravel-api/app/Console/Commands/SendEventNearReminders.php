<?php

namespace App\Console\Commands;

use App\Models\Event;
use App\Models\ReminderLog;
use App\Notifications\EventNearReminder;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SendEventNearReminders extends Command
{
    protected $signature = 'reminders:event-near
                            {--hours=24 : Send for events starting within this many hours}';

    protected $description = 'Send email and SMS reminders to crew when an event is near (e.g. tomorrow or today)';

    public function handle(): int
    {
        $hours = (int) $this->option('hours');
        $fromDate = now()->toDateString();
        $toDate = now()->addHours($hours)->toDateString();

        $events = Event::query()
            ->whereBetween('date', [$fromDate, $toDate])
            ->with('crew')
            ->get();

        $sent = 0;
        foreach ($events as $event) {
            foreach ($event->crew as $user) {
                $alreadySent = ReminderLog::where('event_id', $event->id)
                    ->where('user_id', $user->id)
                    ->where('type', ReminderLog::TYPE_EVENT_NEAR)
                    ->exists();

                if ($alreadySent) {
                    continue;
                }

                try {
                    $user->notify(new EventNearReminder($event));
                    ReminderLog::logSent($event->id, $user->id, ReminderLog::TYPE_EVENT_NEAR, ReminderLog::CHANNEL_EMAIL);
                    ReminderLog::logSent($event->id, $user->id, ReminderLog::TYPE_EVENT_NEAR, ReminderLog::CHANNEL_SMS);
                    $sent++;
                    $this->info("Sent event-near reminder to {$user->name} for {$event->name}");
                } catch (\Throwable $e) {
                    $this->error("Failed to send to {$user->name}: " . $e->getMessage());
                }
            }
        }

        $this->info("Done. Sent {$sent} event-near reminder(s).");
        return self::SUCCESS;
    }
}
