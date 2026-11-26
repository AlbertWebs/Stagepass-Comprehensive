<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\Task;
use App\Notifications\WorkflowPushNotification;
use App\Models\TaskComment;
use App\Services\AuditTrail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    /**
     * Some environments store Team Leader role as "teamleader" instead of "team_leader".
     */
    private function hasAnyRole(Request $request, array $roleNames): bool
    {
        $user = $request->user();
        if (! $user) {
            return false;
        }
        foreach ($roleNames as $roleName) {
            if ($user->hasRole($roleName)) {
                return true;
            }
        }
        return false;
    }

    private function isAdmin(\Illuminate\Http\Request $request): bool
    {
        $user = $request->user();
        $abilities = $user?->currentAccessToken()?->abilities ?? [];
        if (in_array('admin-panel', $abilities, true)) {
            return (bool) $user?->is_active && (bool) $user?->hasPermission('tasks.view');
        }

        return $this->hasAnyRole($request, ['super_admin', 'director', 'admin']);
    }

    private function canCreateTasks(\Illuminate\Http\Request $request): bool
    {
        return $this->hasAnyRole($request, [
            'super_admin',
            'director',
            'admin',
            'team_leader',
            'teamleader',
        ]);
    }

    /**
     * Allow event-level team leaders (and event creators) to create tasks for that event
     * even if their global role set does not include "team_leader".
     */
    private function canCreateTasksForEvent(Request $request, ?int $eventId): bool
    {
        if (! $eventId) {
            return false;
        }
        $user = $request->user();
        if (! $user) {
            return false;
        }
        $event = Event::query()->find($eventId);
        if (! $event) {
            return false;
        }
        return (int) $event->team_leader_id === (int) $user->id
            || (int) $event->created_by_id === (int) $user->id;
    }

    /**
     * List tasks. Admin: all with filters. Crew: only assigned to current user.
     */
    public function index(Request $request): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'tasks.view', ['crew', 'team_leader', 'teamleader'])) return $denial;

        $user = $request->user();
        if ($this->isAdmin($request)) {
            $query = Task::query()->with(['event:id,name,date', 'creator:id,name', 'assignees:id,name']);
            if ($request->filled('event_id')) {
                $query->where('event_id', $request->event_id);
            }
            if ($request->filled('user_id')) {
                $query->whereHas('assignees', fn ($q) => $q->where('users.id', $request->user_id));
            }
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }
            if ($request->filled('search')) {
                $term = '%' . $request->search . '%';
                $query->where(function ($q) use ($term) {
                    $q->where('title', 'like', $term)
                        ->orWhere('description', 'like', $term)
                        ->orWhere('notes', 'like', $term);
                });
            }
            $query->orderByRaw("CASE status WHEN 'completed' THEN 1 WHEN 'in_progress' THEN 0 ELSE -1 END")
                ->orderBy('due_date')->orderBy('id');
            $tasks = $query->paginate((int) $request->get('per_page', 20));
            return response()->json($tasks);
        }

        // Crew: only tasks assigned to me
        $tasks = Task::query()
            ->with(['event:id,name,date', 'creator:id,name', 'assignees:id,name'])
            ->whereHas('assignees', fn ($q) => $q->where('users.id', $user->id))
            ->orderByRaw("CASE status WHEN 'completed' THEN 1 WHEN 'in_progress' THEN 0 ELSE -1 END")
            ->orderBy('due_date')->orderBy('id')
            ->paginate((int) $request->get('per_page', 50));
        return response()->json($tasks);
    }

    /**
     * Create task (admin + team leader).
     */
    public function store(Request $request): JsonResponse
    {
        $eventId = $request->filled('event_id') ? (int) $request->input('event_id') : null;
        $abilities = $request->user()?->currentAccessToken()?->abilities ?? [];
        $allowed = in_array('admin-panel', $abilities, true)
            ? $request->user()->is_active && $request->user()->hasPermission('tasks.create')
            : ($this->canCreateTasks($request) || $this->canCreateTasksForEvent($request, $eventId));
        if (! $allowed) {
            return response()->json(['message' => 'Only admins or team leaders can create tasks.'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'event_id' => 'nullable|exists:events,id',
            'priority' => 'nullable|in:low,medium,high',
            'due_date' => 'nullable|date',
            'notes' => 'nullable|string|max:5000',
            'assignee_ids' => 'nullable|array',
            'assignee_ids.*' => 'exists:users,id',
        ]);

        $task = Task::create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'event_id' => $validated['event_id'] ?? null,
            'created_by' => $request->user()->id,
            'priority' => $validated['priority'] ?? Task::PRIORITY_MEDIUM,
            'due_date' => $validated['due_date'] ?? null,
            'status' => Task::STATUS_PENDING,
            'notes' => $validated['notes'] ?? null,
        ]);
        app(AuditTrail::class)->record($request, 'task.created', $task, [], [
            'title' => $task->title,
            'event_id' => $task->event_id,
            'priority' => $task->priority,
            'due_date' => $task->due_date,
        ]);

        if (! empty($validated['assignee_ids'])) {
            $task->assignees()->sync($validated['assignee_ids']);
            $task->load('assignees');
            foreach ($task->assignees as $assignee) {
                if ((int) $assignee->id === (int) $request->user()->id) continue;
                $assignee->notify(new WorkflowPushNotification(
                    'New task assigned',
                    'You have been assigned: ' . $task->title,
                    'task_assigned',
                    ['task_id' => (string) $task->id, 'task_title' => $task->title]
                ));
            }
        }

        return response()->json($task->load(['event', 'creator', 'assignees']), 201);
    }

    /**
     * Show single task. Admin or assigned crew.
     */
    public function show(Request $request, Task $task): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'tasks.view', ['crew', 'team_leader', 'teamleader'])) return $denial;

        $user = $request->user();
        if (! $this->isAdmin($request)) {
            $assigned = $task->assignees()->where('users.id', $user->id)->exists();
            if (! $assigned) {
                return response()->json(['message' => 'You do not have access to this task.'], 403);
            }
        }

        $task->load(['event', 'creator', 'assignees', 'comments.user']);
        return response()->json($task);
    }

    /**
     * Update task (admin only).
     */
    public function update(Request $request, Task $task): JsonResponse
    {
        $abilities = $request->user()?->currentAccessToken()?->abilities ?? [];
        $allowed = in_array('admin-panel', $abilities, true)
            ? $request->user()->is_active && $request->user()->hasPermission('tasks.edit')
            : $this->isAdmin($request);
        if (! $allowed) {
            return response()->json(['message' => 'Only admins can edit tasks.'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:5000',
            'event_id' => 'nullable|exists:events,id',
            'priority' => 'nullable|in:low,medium,high',
            'due_date' => 'nullable|date',
            'status' => 'nullable|in:pending,in_progress,completed',
            'notes' => 'nullable|string|max:5000',
            'assignee_ids' => 'nullable|array',
            'assignee_ids.*' => 'exists:users,id',
        ]);

        $previousAssigneeIds = $task->assignees()->pluck('users.id')->map(fn ($id) => (int) $id)->all();
        $before = $task->only(['title', 'description', 'event_id', 'priority', 'due_date', 'status']);
        $before['assignee_ids'] = $previousAssigneeIds;
        $assigneeIds = $validated['assignee_ids'] ?? null;
        $syncAssignees = array_key_exists('assignee_ids', $validated);
        unset($validated['assignee_ids']);
        if (! empty($validated)) {
            $task->update($validated);
        }
        if ($syncAssignees) {
            $task->assignees()->sync($assigneeIds ?? []);
            $newAssigneeIds = array_values(array_diff(array_map('intval', $assigneeIds ?? []), $previousAssigneeIds));
            if ($newAssigneeIds !== []) {
                $task->load('assignees');
                foreach ($task->assignees->whereIn('id', $newAssigneeIds) as $assignee) {
                    $assignee->notify(new WorkflowPushNotification(
                        'New task assigned',
                        'You have been assigned: ' . $task->title,
                        'task_assigned',
                        ['task_id' => (string) $task->id, 'task_title' => $task->title]
                    ));
                }
            }
        }
        $contentChanged = collect(['title', 'description', 'due_date', 'priority', 'event_id'])
            ->contains(fn (string $key) => array_key_exists($key, $validated));
        if ($contentChanged) {
            $task->loadMissing('assignees');
            foreach ($task->assignees->whereNotIn('id', $newAssigneeIds ?? []) as $assignee) {
                if ((int) $assignee->id === (int) $request->user()->id) continue;
                $assignee->notify(new WorkflowPushNotification(
                    'Task updated',
                    'Task details changed: ' . $task->title,
                    'task_updated',
                    ['task_id' => (string) $task->id, 'task_title' => $task->title]
                ));
            }
        }

        $task->refresh();
        app(AuditTrail::class)->record($request, 'task.updated', $task, $before, [
            ...$task->only(['title', 'description', 'event_id', 'priority', 'due_date', 'status']),
            'assignee_ids' => $task->assignees()->pluck('users.id')->map(fn ($id) => (int) $id)->all(),
        ]);

        return response()->json($task->load(['event', 'creator', 'assignees']));
    }

    /**
     * Delete task (admin only).
     */
    public function destroy(Request $request, Task $task): JsonResponse
    {
        $abilities = $request->user()?->currentAccessToken()?->abilities ?? [];
        $allowed = in_array('admin-panel', $abilities, true)
            ? $request->user()->is_active && $request->user()->hasPermission('tasks.delete')
            : $this->isAdmin($request);
        if (! $allowed) {
            return response()->json(['message' => 'Only admins can delete tasks.'], 403);
        }
        $task->loadMissing('assignees');
        $before = [
            ...$task->only(['title', 'event_id', 'priority', 'due_date', 'status']),
            'assignee_ids' => $task->assignees->pluck('id')->map(fn ($id) => (int) $id)->all(),
        ];
        foreach ($task->assignees as $assignee) {
            if ((int) $assignee->id === (int) $request->user()->id) continue;
            $assignee->notify(new WorkflowPushNotification(
                'Task cancelled',
                'The task "' . $task->title . '" has been removed.',
                'task_cancelled',
                ['task_id' => (string) $task->id, 'task_title' => $task->title]
            ));
        }
        $task->delete();
        app(AuditTrail::class)->record($request, 'task.deleted', $task, $before);
        return response()->json(null, 204);
    }

    /**
     * Update task status (crew for assigned tasks, or admin).
     */
    public function updateStatus(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();
        $abilities = $user?->currentAccessToken()?->abilities ?? [];
        $canEditAsAdmin = in_array('admin-panel', $abilities, true)
            ? $user->is_active && $user->hasPermission('tasks.edit')
            : $this->isAdmin($request);
        if (! $canEditAsAdmin) {
            $assigned = $task->assignees()->where('users.id', $user->id)->exists();
            if (! $assigned) {
                return response()->json(['message' => 'You are not assigned to this task.'], 403);
            }
        }

        $validated = $request->validate([
            'status' => 'required|in:pending,in_progress,completed',
        ]);
        $previousStatus = $task->status;
        $task->update(['status' => $validated['status']]);
        if ($previousStatus !== $task->status) {
            app(AuditTrail::class)->record($request, 'task.status_changed', $task, ['status' => $previousStatus], ['status' => $task->status]);
        }
        if ($previousStatus !== $task->status) {
            $task->loadMissing(['creator', 'event.teamLeader']);
            $recipients = collect([$task->creator, $task->event?->teamLeader])
                ->filter()
                ->unique('id');
            foreach ($recipients as $recipient) {
                if ((int) $recipient->id === (int) $user->id) continue;
                $recipient->notify(new WorkflowPushNotification(
                    'Task status updated',
                    ($task->assignees()->where('users.id', $user->id)->exists() ? $user->name . ' marked ' : 'Task ') . $task->title . ' as ' . str_replace('_', ' ', $task->status) . '.',
                    'task_status_updated',
                    ['task_id' => (string) $task->id, 'task_title' => $task->title, 'status' => $task->status]
                ));
            }
        }
        return response()->json($task->fresh()->load(['event', 'creator', 'assignees']));
    }

    /**
     * List comments for a task.
     */
    public function comments(Request $request, Task $task): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'tasks.view', ['crew', 'team_leader', 'teamleader'])) return $denial;

        $user = $request->user();
        if (! $this->isAdmin($request)) {
            $assigned = $task->assignees()->where('users.id', $user->id)->exists();
            if (! $assigned) {
                return response()->json(['message' => 'You do not have access to this task.'], 403);
            }
        }
        $comments = $task->comments()->with('user:id,name')->orderBy('created_at')->get();
        return response()->json(['data' => $comments]);
    }

    /**
     * Add a comment (assigned crew or admin).
     */
    public function storeComment(Request $request, Task $task): JsonResponse
    {
        if ($denial = $this->denyUnlessAdminPermission($request, 'tasks.view', ['crew', 'team_leader', 'teamleader'])) return $denial;

        $user = $request->user();
        if (! $this->isAdmin($request)) {
            $assigned = $task->assignees()->where('users.id', $user->id)->exists();
            if (! $assigned) {
                return response()->json(['message' => 'You are not assigned to this task.'], 403);
            }
        }

        $validated = $request->validate(['body' => 'required|string|max:2000']);
        $comment = $task->comments()->create([
            'user_id' => $user->id,
            'body' => $validated['body'],
        ]);
        $task->loadMissing(['assignees', 'creator', 'event.teamLeader']);
        $recipients = $task->assignees
            ->concat(collect([$task->creator, $task->event?->teamLeader]))
            ->filter()
            ->unique('id');
        foreach ($recipients as $recipient) {
            if ((int) $recipient->id === (int) $user->id) continue;
            $recipient->notify(new WorkflowPushNotification(
                'New task comment',
                $user->name . ' commented on "' . $task->title . '": ' . mb_strimwidth($comment->body, 0, 100, '…'),
                'task_comment_added',
                ['task_id' => (string) $task->id, 'task_title' => $task->title]
            ));
        }
        return response()->json($comment->load('user'), 201);
    }
}
