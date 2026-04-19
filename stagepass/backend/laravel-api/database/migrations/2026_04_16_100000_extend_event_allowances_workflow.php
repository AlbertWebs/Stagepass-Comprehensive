<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'sqlite') {
            Schema::table('event_allowances', function (Blueprint $table) {
                $table->dropUnique('event_allowances_dedupe_key');
            });
        } else {
            Schema::table('event_allowances', function (Blueprint $table) {
                $table->dropUnique(['event_id', 'crew_id', 'allowance_type_id', 'recorded_at']);
            });
        }

        Schema::table('event_allowances', function (Blueprint $table) {
            $table->string('source', 20)->default('manual');
            $table->string('attachment_path', 500)->nullable();
            $table->text('rejection_comment')->nullable();
            $table->text('approval_comment')->nullable();
            $table->string('meal_slot', 20)->nullable();
            $table->date('meal_grant_date')->nullable();
            $table->string('dedupe_key', 96)->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
        });

        Schema::table('event_allowances', function (Blueprint $table) {
            $table->unique('dedupe_key');
        });

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE event_allowances MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'paid') NOT NULL DEFAULT 'pending'");
        }
    }

    public function down(): void
    {
        Schema::table('event_allowances', function (Blueprint $table) {
            $table->dropUnique(['dedupe_key']);
        });

        Schema::table('event_allowances', function (Blueprint $table) {
            $table->dropForeign(['rejected_by']);
            $table->dropColumn([
                'source',
                'attachment_path',
                'rejection_comment',
                'approval_comment',
                'meal_slot',
                'meal_grant_date',
                'dedupe_key',
                'rejected_by',
                'rejected_at',
            ]);
        });

        Schema::table('event_allowances', function (Blueprint $table) {
            $table->unique(['event_id', 'crew_id', 'allowance_type_id', 'recorded_at'], 'event_allowances_dedupe_key');
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE event_allowances MODIFY COLUMN status ENUM('pending', 'approved', 'paid') NOT NULL DEFAULT 'pending'");
        }
    }
};
