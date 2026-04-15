<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Notifications\TimeOffRequestSubmittedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class TimeOffNotificationsTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken];
    }

    private function attachRole(User $user, string $name, string $label): void
    {
        $role = Role::firstOrCreate(['name' => $name], ['label' => $label]);
        $user->roles()->syncWithoutDetaching([$role->id]);
    }

    public function test_admins_receive_email_notification_when_user_submits_time_off_request(): void
    {
        Notification::fake();

        $requester = User::factory()->create();
        $admin = User::factory()->create();
        $director = User::factory()->create();
        $crew = User::factory()->create();

        $this->attachRole($admin, 'admin', 'Admin');
        $this->attachRole($director, 'director', 'Director');
        $this->attachRole($crew, 'crew', 'Crew');

        $this->withHeaders($this->auth($requester))
            ->postJson('/api/timeoff/request', [
                'start_date' => now()->addDay()->toDateString(),
                'end_date' => now()->addDays(2)->toDateString(),
                'reason' => 'Medical',
                'notes' => 'Hospital review',
            ])
            ->assertCreated();

        Notification::assertSentTo($admin, TimeOffRequestSubmittedNotification::class);
        Notification::assertSentTo($director, TimeOffRequestSubmittedNotification::class);
        Notification::assertNotSentTo($crew, TimeOffRequestSubmittedNotification::class);
    }
}
