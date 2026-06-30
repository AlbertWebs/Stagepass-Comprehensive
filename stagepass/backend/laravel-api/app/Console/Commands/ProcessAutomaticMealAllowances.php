<?php

namespace App\Console\Commands;

use App\Services\MealAllowanceService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class ProcessAutomaticMealAllowances extends Command
{
    protected $signature = 'allowances:process-meals';

    protected $description = 'Grant automatic meal allowances at configured times with role-based amounts.';

    public function handle(MealAllowanceService $meals): int
    {
        $now = Carbon::now($meals->appTimezone());
        $total = 0;

        foreach ([MealAllowanceService::SLOT_BREAKFAST, MealAllowanceService::SLOT_LUNCH, MealAllowanceService::SLOT_DINNER] as $slot) {
            $total += $meals->processScheduledSlot($slot, $now);
        }

        if ($total > 0) {
            $this->info("Granted {$total} meal allowance(s).");
        }

        return self::SUCCESS;
    }
}
