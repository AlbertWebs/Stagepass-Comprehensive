<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('event_meals')) {
            return;
        }

        if (! Schema::hasColumn('event_meals', 'work_date')) {
            Schema::table('event_meals', function (Blueprint $table) {
                $table->string('work_date', 10)->nullable()->after('event_id');
            });
        }

        $meals = DB::table('event_meals')->select('id', 'event_id')->get();
        foreach ($meals as $row) {
            $raw = DB::table('events')->where('id', $row->event_id)->value('date');
            if ($raw === null) {
                continue;
            }
            $d = (string) (is_string($raw) ? substr($raw, 0, 10) : (string) $raw);
            if ($d !== '' && $d !== '0000-00-00') {
                DB::table('event_meals')->where('id', $row->id)->update(['work_date' => $d]);
            }
        }

        if (Schema::hasColumn('event_meals', 'work_date')) {
            Schema::table('event_meals', function (Blueprint $table) {
                $table->dropUnique(['event_id', 'user_id']);
            });
            Schema::table('event_meals', function (Blueprint $table) {
                $table->unique(['event_id', 'user_id', 'work_date'], 'event_meals_event_user_work_date');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('event_meals') || ! Schema::hasColumn('event_meals', 'work_date')) {
            return;
        }
        Schema::table('event_meals', function (Blueprint $table) {
            try {
                $table->dropUnique('event_meals_event_user_work_date');
            } catch (\Throwable $e) {
            }
        });
        Schema::table('event_meals', function (Blueprint $table) {
            $table->unique(['event_id', 'user_id']);
        });
        Schema::table('event_meals', function (Blueprint $table) {
            $table->dropColumn('work_date');
        });
    }
};
