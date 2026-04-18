<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_office_checkins', function (Blueprint $table) {
            $table->decimal('standard_hours', 8, 2)->nullable()->after('total_hours');
            $table->timestamp('overtime_threshold_notified_at')->nullable()->after('extra_hours');
        });

        Schema::table('event_user', function (Blueprint $table) {
            $table->decimal('standard_hours', 8, 2)->nullable()->after('total_hours');
            $table->timestamp('overtime_threshold_notified_at')->nullable()->after('extra_hours');
        });

        Schema::create('overtime_notification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('context', 20); // office | event
            $table->foreignId('daily_office_checkin_id')->nullable()->constrained('daily_office_checkins')->nullOnDelete();
            $table->foreignId('event_user_id')->nullable()->constrained('event_user')->nullOnDelete();
            $table->string('message', 500);
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('overtime_notification_logs');

        Schema::table('event_user', function (Blueprint $table) {
            $table->dropColumn(['standard_hours', 'overtime_threshold_notified_at']);
        });

        Schema::table('daily_office_checkins', function (Blueprint $table) {
            $table->dropColumn(['standard_hours', 'overtime_threshold_notified_at']);
        });
    }
};
