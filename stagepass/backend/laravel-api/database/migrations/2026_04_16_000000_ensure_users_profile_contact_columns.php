<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Safety net for servers whose users table predates profile fields
 * (fixes "no such column: address" on SQLite / missing columns on MySQL).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'address')) {
            Schema::table('users', function (Blueprint $table) {
                $table->text('address')->nullable();
            });
        }
        if (! Schema::hasColumn('users', 'emergency_contact')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('emergency_contact', 255)->nullable();
            });
        }
    }

    public function down(): void
    {
        $drop = [];
        if (Schema::hasColumn('users', 'address')) {
            $drop[] = 'address';
        }
        if (Schema::hasColumn('users', 'emergency_contact')) {
            $drop[] = 'emergency_contact';
        }
        if ($drop !== []) {
            Schema::table('users', function (Blueprint $table) use ($drop) {
                $table->dropColumn($drop);
            });
        }
    }
};
