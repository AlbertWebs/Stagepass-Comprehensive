<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_user', function (Blueprint $table) {
            $table->boolean('is_paused')->default(false)->after('holiday_name');
            $table->timestamp('pause_start_time')->nullable()->after('is_paused');
            $table->timestamp('pause_end_time')->nullable()->after('pause_start_time');
            $table->unsignedInteger('pause_duration')->default(0)->after('pause_end_time');
            $table->foreignId('paused_by')->nullable()->after('pause_duration')->constrained('users')->nullOnDelete();
            $table->string('pause_reason', 255)->nullable()->after('paused_by');
            $table->enum('transport_type', ['organization', 'cab', 'none'])->nullable()->after('pause_reason');
            $table->decimal('transport_amount', 10, 2)->nullable()->after('transport_type');
            $table->foreignId('transport_recorded_by')->nullable()->after('transport_amount')->constrained('users')->nullOnDelete();
            $table->timestamp('transport_recorded_at')->nullable()->after('transport_recorded_by');
        });

        Schema::table('events', function (Blueprint $table) {
            $table->timestamp('closed_at')->nullable()->after('ended_at');
            $table->foreignId('closed_by')->nullable()->after('closed_at')->constrained('users')->nullOnDelete();
            $table->text('closing_comment')->nullable()->after('closed_by');
        });
    }

    public function down(): void
    {
        Schema::table('event_user', function (Blueprint $table) {
            $table->dropConstrainedForeignId('transport_recorded_by');
            $table->dropConstrainedForeignId('paused_by');
            $table->dropColumn([
                'is_paused',
                'pause_start_time',
                'pause_end_time',
                'pause_duration',
                'pause_reason',
                'transport_type',
                'transport_amount',
                'transport_recorded_at',
            ]);
        });

        Schema::table('events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('closed_by');
            $table->dropColumn(['closed_at', 'closing_comment']);
        });
    }
};
