<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->timestamp('ended_at')->nullable()->after('status');
            $table->foreignId('ended_by_id')->nullable()->after('ended_at')->constrained('users')->nullOnDelete();
            $table->text('end_comment')->nullable()->after('ended_by_id');
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropForeign(['ended_by_id']);
            $table->dropColumn(['ended_at', 'ended_by_id', 'end_comment']);
        });
    }
};
