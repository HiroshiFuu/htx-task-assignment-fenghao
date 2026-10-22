import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import type {
  CreateTaskInput,
  DeveloperSummary,
  TaskNode,
  TaskStatus,
} from '../../api/types';

export const queryKeys = {
  tasks: ['tasks'] as const,
  developers: ['developers'] as const,
  skills: ['skills'] as const,
};

export function useTasks() {
  return useQuery({ queryKey: queryKeys.tasks, queryFn: api.listTasks });
}

export function useDevelopers() {
  return useQuery({
    queryKey: queryKeys.developers,
    queryFn: api.listDevelopers,
  });
}

export function useSkills() {
  return useQuery({ queryKey: queryKeys.skills, queryFn: api.listSkills });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.createTask(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
  });
}

function findTask(
  forest: readonly TaskNode[] | undefined,
  id: string,
): TaskNode | undefined {
  for (const task of forest ?? []) {
    if (task.id === id) return task;
    const found = findTask(task.subtasks, id);
    if (found) return found;
  }
  return undefined;
}

/** Replaces one task's own fields anywhere in the forest, keeping current subtasks. */
function patchTask(
  forest: TaskNode[] | undefined,
  id: string,
  patch: (task: TaskNode) => TaskNode,
): TaskNode[] | undefined {
  return forest?.map((task) =>
    task.id === id
      ? { ...patch(task), subtasks: task.subtasks }
      : { ...task, subtasks: patchTask(task.subtasks, id, patch) ?? [] },
  );
}

interface OptimisticSnapshot {
  previousTask: TaskNode | undefined;
}

/**
 * Shared optimistic-update flow: patch the cached task immediately, restore only
 * that task's own fields if the server rejects the change (other rows may hold
 * their own optimistic edits), and refetch either way so the list ends up matching
 * the server.
 */
function useOptimisticTaskMutation<
  Variables extends { taskId: string },
  Result,
>(
  mutationFn: (variables: Variables) => Promise<Result>,
  applyToTask: (task: TaskNode, variables: Variables) => TaskNode,
  alsoInvalidate: readonly (readonly string[])[] = [],
) {
  const queryClient = useQueryClient();
  return useMutation<Result, Error, Variables, OptimisticSnapshot>({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks });
      const previousTask = findTask(
        queryClient.getQueryData<TaskNode[]>(queryKeys.tasks),
        variables.taskId,
      );
      queryClient.setQueryData<TaskNode[]>(queryKeys.tasks, (tasks) =>
        patchTask(tasks, variables.taskId, (task) =>
          applyToTask(task, variables),
        ),
      );
      return { previousTask };
    },
    onError: (_error, variables, snapshot) => {
      const previousTask = snapshot?.previousTask;
      if (previousTask) {
        queryClient.setQueryData<TaskNode[]>(queryKeys.tasks, (tasks) =>
          patchTask(tasks, variables.taskId, () => previousTask),
        );
      }
    },
    onSettled: async () => {
      await Promise.all(
        [queryKeys.tasks, ...alsoInvalidate].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}

export interface UpdateStatusVariables {
  taskId: string;
  status: TaskStatus;
}

export function useUpdateTaskStatus() {
  return useOptimisticTaskMutation(
    ({ taskId, status }: UpdateStatusVariables) =>
      api.updateTaskStatus(taskId, status),
    (task, { status }) => ({ ...task, status }),
    // A developer's task summaries include status.
    [queryKeys.developers],
  );
}

/**
 * Decision D5: a confirmed cascade changes several tasks at once, so it is not
 * applied optimistically; the whole tree is refetched once the server confirms.
 */
export function useConfirmedCascadeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: UpdateStatusVariables) =>
      api.updateTaskStatus(taskId, status, true),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
        queryClient.invalidateQueries({ queryKey: queryKeys.developers }),
      ]),
  });
}

export interface UpdateAssigneeVariables {
  taskId: string;
  assignee: DeveloperSummary | null;
}

export function useUpdateTaskAssignee() {
  return useOptimisticTaskMutation(
    ({ taskId, assignee }: UpdateAssigneeVariables) =>
      api.updateTaskAssignee(taskId, assignee?.id ?? null),
    (task, { assignee }) => ({ ...task, assignee }),
    [queryKeys.developers],
  );
}
