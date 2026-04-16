<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\Task;
use App\Models\TaskComment;
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
        if (! $this->canCreateTasks($request) && ! $this->canCreateTasksForEvent($request, $eventId)) {
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

        if (! empty($validated['assignee_ids'])) {
            $task->assignees()->sync($validated['assignee_ids']);
        }

        return response()->json($task->load(['event', 'creator', 'assignees']), 201);
    }

    /**
     * Show single task. Admin or assigned crew.
     */
    public function show(Request $request, Task $task): JsonResponse
    {
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
        if (! $this->isAdmin($request)) {
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

        $assigneeIds = $validated['assignee_ids'] ?? null;
        $syncAssignees = array_key_exists('assignee_ids', $validated);
        unset($validated['assignee_ids']);
        if (! empty($validated)) {
            $task->update($validated);
        }
        if ($syncAssignees) {
            $task->assignees()->sync($assigneeIds ?? []);
        }

        return response()->json($task->load(['event', 'creator', 'assignees']));
    }

    /**
     * Delete task (admin only).
     */
    public function destroy(Request $request, Task $task): JsonResponse
    {
        if (! $this->isAdmin($request)) {
            return response()->json(['message' => 'Only admins can delete tasks.'], 403);
        }
        $task->delete();
        return response()->json(null, 204);
    }

    /**
     * Update task status (crew for assigned tasks, or admin).
     */
    public function updateStatus(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();
        if (! $this->isAdmin($request)) {
            $assigned = $task->assignees()->where('users.id', $user->id)->exists();
            if (! $assigned) {
                return response()->json(['message' => 'You are not assigned to this task.'], 403);
            }
        }

        $validated = $request->validate([
            'status' => 'required|in:pending,in_progress,completed',
        ]);
        $task->update(['status' => $validated['status']]);
        return response()->json($task->fresh()->load(['event', 'creator', 'assignees']));
    }

    /**
     * List comments for a task.
     */
    public function comments(Request $request, Task $task): JsonResponse
    {
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
        return response()->json($comment->load('user'), 201);
    }
}
