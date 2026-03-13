<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_office_checkins', function (Blueprint $table) {
            $table->dateTime('checkout_time')->nullable()->after('checkin_time');
        });
    }

    public function down(): void
    {
        Schema::table('daily_office_checkins', function (Blueprint $table) {
            $table->dropColumn('checkout_time');
        });
    }
};
