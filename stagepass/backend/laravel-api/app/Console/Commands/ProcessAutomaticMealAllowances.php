<?php

namespace App\Console\Commands;

use App\Models\AllowanceType;
use App\Models\Event;
use App\Models\EventAllowance;
use App\Models\EventUser;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class ProcessAutomaticMealAllowances extends Command
{
    protected $signature = 'allowances:process-meals';

    protected $description = 'Grant automatic meal allowances when crew are checked in at configured times.';

    public function handle(): int
    {
        $now = Carbon::now((string) config('app.timezone', 'Africa/Nairobi'));
        $slotMinute = $now->format('H:i');
        $today = $now->toDateString();

        $slots = [
            'breakfast' => [
                'time_key' => 'meal_allowance_breakfast_time',
                'amount_key' => 'meal_allowance_breakfast_amount',
                'type_name' => 'Breakfast',
            ],
            'lunch' => [
                'time_key' => 'meal_allowance_lunch_time',
                'amount_key' => 'meal_allowance_lunch_amount',
                'type_name' => 'Lunch',
            ],
            'dinner' => [
                'time_key' => 'meal_allowance_dinner_time',
                'amount_key' => 'meal_allowance_dinner_amount',
                'type_name' => 'Dinner',
            ],
        ];

        foreach ($slots as $mealSlot => $cfg) {
            $configured = substr(trim((string) Setting::get($cfg['time_key'], match ($mealSlot) {
                'breakfast' => '06:30',
                'lunch' => '13:00',
                'dinner' => '20:30',
            })), 0, 5);
            if ($configured !== $slotMinute) {
                continue;
            }

            $amount = (float) Setting::get($cfg['amount_key'], 0);
            if ($amount <= 0) {
                continue;
            }

            $type = AllowanceType::query()->where('name', $cfg['type_name'])->where('is_active', true)->first();
            if (! $type) {
                continue;
            }

            $this->grantForSlot($mealSlot, $today, $amount, $type->id);
        }

        return self::SUCCESS;
    }

    private function grantForSlot(string $mealSlot, string $mealGrantDate, float $amount, int $allowanceTypeId): void
    {
        $assignments = EventUser::query()
            ->whereNotNull('checkin_time')
            ->whereNull('checkout_time')
            ->whereHas('event', function ($q) use ($mealGrantDate) {
                $q->whereNotIn('status', [
                    Event::STATUS_COMPLETED,
                    Event::STATUS_CLOSED,
                    Event::STATUS_DONE_FOR_DAY,
                ])
                    ->whereDate('date', '<=', $mealGrantDate)
                    ->whereRaw('COALESCE(end_date, date) >= ?', [$mealGrantDate]);
            })
            ->with('event')
            ->get();

        foreach ($assignments as $assignment) {
            $event = $assignment->event;
            if (! $event) {
                continue;
            }

            $dedupeKey = $event->id . '-' . $assignment->user_id . '-' . $mealSlot . '-' . $mealGrantDate;

            try {
                DB::transaction(function () use ($assignment, $event, $mealSlot, $mealGrantDate, $amount, $allowanceTypeId, $dedupeKey) {
                    $exists = EventAllowance::query()->where('dedupe_key', $dedupeKey)->exists();
                    if ($exists) {
                        return;
                    }

                    EventAllowance::create([
                        'event_id' => $event->id,
                        'crew_id' => $assignment->user_id,
                        'allowance_type_id' => $allowanceTypeId,
                        'amount' => $amount,
                        'description' => 'Automatic meal allowance',
                        'recorded_by' => $assignment->user_id,
                        'recorded_at' => now(),
                        'status' => EventAllowance::STATUS_APPROVED,
                        'approved_by' => null,
                        'approved_at' => now(),
                        'source' => EventAllowance::SOURCE_AUTOMATIC,
                        'meal_slot' => $mealSlot,
                        'meal_grant_date' => $mealGrantDate,
                        'dedupe_key' => $dedupeKey,
                    ]);
                });
            } catch (UniqueConstraintViolationException) {
                // Idempotent under race
            }
        }
    }
}
