<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->foreignId('created_by_id')->nullable()->after('status')->constrained('users')->nullOnDelete();
        });

        // So existing events (created before this column) show for the first user in the DB
        $firstUserId = \DB::table('users')->orderBy('id')->value('id');
        if ($firstUserId) {
            \DB::table('events')->whereNull('created_by_id')->update(['created_by_id' => $firstUserId]);
        }
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropForeign(['created_by_id']);
        });
    }
};
