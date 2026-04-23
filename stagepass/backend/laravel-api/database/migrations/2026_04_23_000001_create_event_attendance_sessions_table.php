<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_attendance_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            /** Calendar work day (venue timezone / app) this shift belongs to — for multi-day events. */
            $table->date('work_date');
            $table->dateTime('checkin_time');
            $table->dateTime('checkout_time');
            $table->decimal('total_hours', 8, 2)->nullable();
            $table->decimal('standard_hours', 8, 2)->nullable();
            $table->decimal('extra_hours', 8, 2)->nullable();
            $table->boolean('is_sunday')->default(false);
            $table->boolean('is_holiday')->default(false);
            $table->string('holiday_name')->nullable();
            $table->unsignedInteger('pause_duration')->default(0);
            $table->double('checkin_latitude')->nullable();
            $table->double('checkin_longitude')->nullable();
            $table->timestamps();
            $table->unique(['event_id', 'user_id', 'work_date'], 'event_att_session_event_user_work_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_attendance_sessions');
    }
};
