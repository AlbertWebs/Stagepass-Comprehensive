<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Communication;
use App\Models\Event;
use App\Models\User;
use App\Notifications\InternalBroadcastNotification;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CommunicationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Communication::query()
            ->with(['sentBy:id,name,email', 'event:id,name,date'])
            ->orderByDesc('created_at');

        $perPage = min((int) $request->input('per_page', 20), 100);
        $items = $query->paginate($perPage);

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'body' => 'required|string|max:10000',
            'recipient_scope' => 'required|in:all_staff,crew,event_crew',
            'event_id' => 'required_if:recipient_scope,event_crew|nullable|exists:events,id',
            'send_as_message' => 'boolean',
            'send_as_email' => 'boolean',
        ]);

        $sendAsMessage = $request->boolean('send_as_message', true);
        $sendAsEmail = $request->boolean('send_as_email', false);

        if (! $sendAsMessage && ! $sendAsEmail) {
            return response()->json([
                'message' => 'Select at least one channel: in-app message and/or email.',
            ], 422);
        }

        $user = $request->user();
        $recipients = $this->resolveRecipients(
            $validated['recipient_scope'],
            $validated['event_id'] ?? null
        );

        $communication = DB::transaction(function () use ($validated, $user, $sendAsMessage, $sendAsEmail, $recipients) {
            $comm = Communication::create([
                'sent_by_id' => $user->id,
                'subject' => $validated['subject'],
                'body' => $validated['body'],
                'recipient_scope' => $validated['recipient_scope'],
                'event_id' => $validated['event_id'] ?? null,
                'send_as_message' => $sendAsMessage,
                'send_as_email' => $sendAsEmail,
                'sent_at' => now(),
            ]);

            $notification = new InternalBroadcastNotification(
                $comm->subject,
                $comm->body,
                $user->name,
                $comm->id,
                $sendAsMessage,
                $sendAsEmail
            );

            foreach ($recipients as $recipient) {
                if ($recipient->id !== $user->id) {
                    $recipient->notify($notification);
                }
            }

            return $comm;
        });

        $communication->load(['sentBy:id,name,email', 'event:id,name,date']);

        return response()->json($communication, 201);
    }

    public function show(Communication $communication): JsonResponse
    {
        $communication->load(['sentBy:id,name,email', 'event:id,name,date']);
        $recipients = $this->resolveRecipients(
            $communication->recipient_scope,
            $communication->event_id
        )->values();

        $notifications = DatabaseNotification::query()
            ->where('type', InternalBroadcastNotification::class)
            ->where('data->communication_id', $communication->id)
            ->whereIn('notifiable_id', $recipients->pluck('id')->all())
            ->get(['notifiable_id', 'read_at']);

        $byUser = [];
        foreach ($notifications as $n) {
            $byUser[(int) $n->notifiable_id] = $n;
        }

        $recipientStatus = $recipients->map(function (User $u) use ($byUser) {
            $row = $byUser[(int) $u->id] ?? null;
            $openedAt = $row?->read_at;
            return [
                'user_id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'opened' => $openedAt !== null,
                'opened_at' => $openedAt?->toISOString(),
            ];
        });

        $openedCount = $recipientStatus->where('opened', true)->count();

        return response()->json(array_merge($communication->toArray(), [
            'recipient_count' => $recipientStatus->count(),
            'opened_count' => $openedCount,
            'unopened_count' => max(0, $recipientStatus->count() - $openedCount),
            'recipients_status' => $recipientStatus->values(),
        ]));
    }

    public function destroy(Communication $communication): JsonResponse
    {
        $communication->delete();
        return response()->json(null, 204);
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, User>
     */
    private function resolveRecipients(string $scope, ?int $eventId): \Illuminate\Database\Eloquent\Collection
    {
        if ($scope === Communication::SCOPE_EVENT_CREW && $eventId) {
            $event = Event::find($eventId);
            if (! $event) {
                return collect();
            }
            return $event->crew()->get();
        }

        if ($scope === Communication::SCOPE_CREW) {
            return User::query()
                ->whereHas('roles', fn ($q) => $q->whereIn('name', ['crew', 'team_leader', 'director', 'super_admin']))
                ->get();
        }

        return User::query()->get();
    }
}
