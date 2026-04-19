<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('geocoded_locations', function (Blueprint $table) {
            $table->id();
            $table->string('google_place_id', 512)->nullable()->unique();
            $table->char('address_hash', 64)->unique();
            $table->string('location_name', 2000);
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('geocoded_locations');
    }
};
