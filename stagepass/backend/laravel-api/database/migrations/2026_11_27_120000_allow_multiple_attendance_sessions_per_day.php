<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const UNIQUE_INDEX = 'event_att_session_event_user_work_date';

    public function up(): void
    {
        Schema::table('event_attendance_sessions', function (Blueprint $table) {
            $table->dropUnique(self::UNIQUE_INDEX);
            $table->index(['event_id', 'user_id', 'work_date'], 'event_att_session_event_user_date_idx');
        });
    }

    public function down(): void
    {
        Schema::table('event_attendance_sessions', function (Blueprint $table) {
            $table->dropIndex('event_att_session_event_user_date_idx');
            $table->unique(['event_id', 'user_id', 'work_date'], self::UNIQUE_INDEX);
        });
    }
};
