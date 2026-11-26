<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_allowances', function (Blueprint $table): void {
            $table->foreignId('hr_verified_by')->nullable()->after('approved_by')->constrained('users')->nullOnDelete();
            $table->timestamp('hr_verified_at')->nullable()->after('approved_at')->index();
            $table->text('hr_verification_note')->nullable()->after('approval_comment');
        });

        // Keep previously approved/paid records usable while requiring an explicit HR review
        // for new pending records that have not entered the existing approval workflow yet.
        DB::table('event_allowances')
            ->whereIn('status', ['approved', 'paid'])
            ->whereNull('hr_verified_at')
            ->update(['hr_verified_at' => DB::raw('COALESCE(approved_at, paid_at, recorded_at, created_at)')]);
    }

    public function down(): void
    {
        Schema::table('event_allowances', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('hr_verified_by');
            $table->dropColumn(['hr_verified_at', 'hr_verification_note']);
        });
    }
};
