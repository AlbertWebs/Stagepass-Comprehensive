<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('allowance_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('event_allowances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('crew_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('allowance_type_id')->constrained('allowance_types');
            $table->decimal('amount', 10, 2);
            $table->string('description', 1000)->nullable();
            $table->foreignId('recorded_by')->constrained('users');
            $table->timestamp('recorded_at')->nullable();
            $table->enum('status', ['pending', 'approved', 'paid'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['event_id', 'status']);
            $table->index(['crew_id', 'status']);
            $table->unique(['event_id', 'crew_id', 'allowance_type_id', 'recorded_at'], 'event_allowances_dedupe_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_allowances');
        Schema::dropIfExists('allowance_types');
    }
};
