<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_user', function (Blueprint $table) {
            $table->decimal('extra_hours', 8, 2)->nullable()->after('total_hours');
            $table->boolean('is_sunday')->default(false)->after('extra_hours');
            $table->boolean('is_holiday')->default(false)->after('is_sunday');
            $table->string('holiday_name')->nullable()->after('is_holiday');
        });

        Schema::table('daily_office_checkins', function (Blueprint $table) {
            $table->decimal('total_hours', 8, 2)->nullable()->after('checkout_time');
            $table->decimal('extra_hours', 8, 2)->nullable()->after('total_hours');
            $table->boolean('is_sunday')->default(false)->after('extra_hours');
            $table->boolean('is_holiday')->default(false)->after('is_sunday');
            $table->string('holiday_name')->nullable()->after('is_holiday');
        });
    }

    public function down(): void
    {
        Schema::table('event_user', function (Blueprint $table) {
            $table->dropColumn(['extra_hours', 'is_sunday', 'is_holiday', 'holiday_name']);
        });

        Schema::table('daily_office_checkins', function (Blueprint $table) {
            $table->dropColumn(['total_hours', 'extra_hours', 'is_sunday', 'is_holiday', 'holiday_name']);
        });
    }
};
