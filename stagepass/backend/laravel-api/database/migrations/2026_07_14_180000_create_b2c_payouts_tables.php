<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('b2c_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('initiated_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('event_id')->nullable()->constrained('events')->nullOnDelete();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->unsignedInteger('line_count')->default(0);
            $table->string('status', 32)->default('pending'); // pending|processing|completed|partial|failed
            $table->boolean('dry_run')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('b2c_payout_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('b2c_payout_id')->constrained('b2c_payouts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('phone', 20);
            $table->decimal('amount', 12, 2);
            $table->json('event_allowance_ids');
            $table->string('status', 32)->default('pending'); // pending|queued|accepted|completed|failed|skipped
            $table->string('conversation_id', 64)->nullable();
            $table->string('originator_conversation_id', 64)->nullable();
            $table->string('transaction_id', 64)->nullable();
            $table->string('result_code', 32)->nullable();
            $table->text('result_desc')->nullable();
            $table->json('raw_response')->nullable();
            $table->timestamps();

            $table->index(['conversation_id']);
            $table->index(['status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('b2c_payout_items');
        Schema::dropIfExists('b2c_payouts');
    }
};
