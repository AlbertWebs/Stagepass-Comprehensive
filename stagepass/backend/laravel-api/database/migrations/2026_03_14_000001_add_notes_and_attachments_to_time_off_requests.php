<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_off_requests', function (Blueprint $table) {
            $table->text('notes')->nullable()->after('reason');
        });

        Schema::create('time_off_request_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('time_off_request_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('original_name')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_off_request_attachments');
        Schema::table('time_off_requests', function (Blueprint $table) {
            $table->dropColumn('notes');
        });
    }
};
