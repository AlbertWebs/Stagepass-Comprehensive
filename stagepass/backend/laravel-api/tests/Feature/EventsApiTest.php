<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventsApiTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        $token = $user->createToken('test')->plainTextToken;
        return ['Authorization' => 'Bearer ' . $token];
    }

    public function test_my_event_today_returns_null_when_no_event(): void
    {
        $user = User::factory()->create();
        $response = $this->withHeaders($this->auth($user))
            ->getJson('/api/my-event-today');
        $response->assertStatus(200)->assertJson(['event' => null]);
    }

    public function test_my_event_today_accepts_x_local_date_header_and_returns_event_structure(): void
    {
        $user = User::factory()->create();
        $today = now()->toDateString();
        Event::create([
            'name' => 'Test Event',
            'date' => $today,
            'start_time' => '09:00',
            'team_leader_id' => $user->id,
            'status' => Event::STATUS_CREATED,
        ]);
        $response = $this->withHeaders(array_merge($this->auth($user), ['X-Local-Date' => $today]))
            ->getJson('/api/my-event-today');
        $response->assertStatus(200)->assertJsonStructure(['event']);
    }

    public function test_events_index_returns_paginated_list(): void
    {
        $user = User::factory()->create();
        Event::create([
            'name' => 'Past Event',
            'date' => now()->subDay()->toDateString(),
            'start_time' => '09:00',
            'created_by_id' => $user->id,
            'status' => Event::STATUS_CREATED,
        ]);
        $response = $this->withHeaders($this->auth($user))
            ->getJson('/api/events');
        $response->assertStatus(200);
        $this->assertArrayHasKey('data', $response->json());
    }

    public function test_events_index_includes_event_when_user_is_on_crew(): void
    {
        $creator = User::factory()->create();
        $crew = User::factory()->create();
        $event = Event::create([
            'name' => 'Crew Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'created_by_id' => $creator->id,
            'status' => Event::STATUS_CREATED,
        ]);
        $event->crew()->attach($crew->id, ['role_in_event' => null]);

        $response = $this->withHeaders($this->auth($crew))
            ->getJson('/api/events');
        $response->assertStatus(200);
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($event->id, $ids);
    }

    public function test_events_index_includes_event_when_user_is_team_leader_only(): void
    {
        $creator = User::factory()->create();
        $leader = User::factory()->create();
        $event = Event::create([
            'name' => 'Team leader event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'created_by_id' => $creator->id,
            'team_leader_id' => $leader->id,
            'status' => Event::STATUS_CREATED,
        ]);

        $response = $this->withHeaders($this->auth($leader))
            ->getJson('/api/events');
        $response->assertStatus(200);
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($event->id, $ids);
    }

    public function test_events_store_creates_event(): void
    {
        $user = User::factory()->create();
        $payload = [
            'name' => 'New Event',
            'date' => now()->addDays(2)->toDateString(),
            'start_time' => '10:00',
            'location_name' => 'Main Hall',
        ];
        $response = $this->withHeaders($this->auth($user))
            ->postJson('/api/events', $payload);
        $response->assertStatus(201)
            ->assertJsonPath('name', 'New Event')
            ->assertJsonPath('created_by_id', $user->id);
        $this->assertDatabaseHas('events', ['name' => 'New Event']);
    }

    public function test_events_show_returns_event(): void
    {
        $user = User::factory()->create();
        $event = Event::create([
            'name' => 'Show Event',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'created_by_id' => $user->id,
            'status' => Event::STATUS_CREATED,
        ]);
        $response = $this->withHeaders($this->auth($user))
            ->getJson('/api/events/' . $event->id);
        $response->assertStatus(200)->assertJsonPath('id', $event->id)->assertJsonPath('name', 'Show Event');
    }

    public function test_events_update_modifies_event(): void
    {
        $user = User::factory()->create();
        $event = Event::create([
            'name' => 'Original',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'created_by_id' => $user->id,
            'status' => Event::STATUS_CREATED,
        ]);
        $response = $this->withHeaders($this->auth($user))
            ->putJson('/api/events/' . $event->id, ['name' => 'Updated Name']);
        $response->assertStatus(200)->assertJsonPath('name', 'Updated Name');
        $event->refresh();
        $this->assertSame('Updated Name', $event->name);
    }

    public function test_events_destroy_deletes_event(): void
    {
        $user = User::factory()->create();
        $event = Event::create([
            'name' => 'To Delete',
            'date' => now()->toDateString(),
            'start_time' => '09:00',
            'created_by_id' => $user->id,
            'status' => Event::STATUS_CREATED,
        ]);
        $response = $this->withHeaders($this->auth($user))
            ->deleteJson('/api/events/' . $event->id);
        $response->assertStatus(204);
        $this->assertDatabaseMissing('events', ['id' => $event->id]);
    }
}
