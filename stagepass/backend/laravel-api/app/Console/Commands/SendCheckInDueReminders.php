<?php

namespace App\Console\Commands;

use App\Models\Event;
use App\Models\EventUser;
use App\Models\ReminderLog;
use App\Notifications\CheckInDueReminder;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SendCheckInDueReminders extends Command
{
    protected $signature = 'reminders:checkin-due
                            {--minutes=30 : Send if event started at least this many minutes ago}
                            {--throttle=120 : Do not resend to same user/event within this many minutes}';

    protected $description = 'Send email and SMS reminders to crew who have not checked in for an event that has started';

    public function handle(): int
    {
        $minutesAfterStart = (int) $this->option('minutes');
        $throttleMinutes = (int) $this->option('throttle');
        $now = now();

        $events = Event::query()
            ->where('date', $now->toDateString())
            ->with('crew')
            ->get();

        $sent = 0;
        foreach ($events as $event) {
            $eventStart = Carbon::parse($event->date->format('Y-m-d') . ' ' . $event->start_time);
            if ($eventStart->addMinutes($minutesAfterStart)->isFuture()) {
                continue;
            }

            $crewWithoutCheckin = EventUser::query()
                ->where('event_id', $event->id)
                ->whereNull('checkin_time')
                ->with('user')
                ->get();

            foreach ($crewWithoutCheckin as $assignment) {
                $user = $assignment->user;
                if (! $user) {
                    continue;
                }

                $lastSent = ReminderLog::where('event_id', $event->id)
                    ->where('user_id', $user->id)
                    ->where('type', ReminderLog::TYPE_CHECKIN_DUE)
                    ->where('sent_at', '>=', $now->copy()->subMinutes($throttleMinutes))
                    ->exists();

                if ($lastSent) {
                    continue;
                }

                try {
                    $user->notify(new CheckInDueReminder($event));
                    ReminderLog::logSent($event->id, $user->id, ReminderLog::TYPE_CHECKIN_DUE, ReminderLog::CHANNEL_EMAIL);
                    ReminderLog::logSent($event->id, $user->id, ReminderLog::TYPE_CHECKIN_DUE, ReminderLog::CHANNEL_SMS);
                    $sent++;
                    $this->info("Sent check-in reminder to {$user->name} for {$event->name}");
                } catch (\Throwable $e) {
                    $this->error("Failed to send to {$user->name}: " . $e->getMessage());
                }
            }
        }

        $this->info("Done. Sent {$sent} check-in reminder(s).");
        return self::SUCCESS;
    }
}
