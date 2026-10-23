import type { TaskNode, TaskStatus } from '../../api/types';
import { isClosed } from './status';

export interface VisibleRow {
  task: TaskNode;
  /** 0 for top-level tasks. */
  depth: number;
  /** Nearest first. */
  ancestors: TaskNode[];
  hasSubtasks: boolean;
  collapsed: boolean;
}

/** Depth-first rows for the list, skipping the subtrees of collapsed tasks. */
export function visibleRows(
  forest: readonly TaskNode[],
  collapsedIds: ReadonlySet<string>,
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const visit = (task: TaskNode, ancestors: TaskNode[]) => {
    const collapsed = collapsedIds.has(task.id);
    rows.push({
      task,
      depth: ancestors.length,
      ancestors,
      hasSubtasks: task.subtasks.length > 0,
      collapsed,
    });
    if (!collapsed) {
      const childAncestors = [task, ...ancestors];
      task.subtasks.forEach((child) => {
        visit(child, childAncestors);
      });
    }
  };
  forest.forEach((task) => {
    visit(task, []);
  });
  return rows;
}

/**
 * UX hint only (decision D4): descendants at any depth still To-do or In Progress.
 * Cancelled subtasks don't block their parent. The backend makes the final call.
 */
export function countOpenDescendants(task: TaskNode): number {
  return task.subtasks.reduce(
    (sum, child) =>
      sum + (isClosed(child.status) ? 0 : 1) + countOpenDescendants(child),
    0,
  );
}

export const hasOpenDescendant = (task: TaskNode): boolean =>
  countOpenDescendants(task) > 0;

/** Every task in the forest, counted by status, for the list summary. */
export function countByStatus(
  forest: readonly TaskNode[],
): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    DONE: 0,
    CANCELLED: 0,
  };
  const visit = (task: TaskNode) => {
    counts[task.status] += 1;
    task.subtasks.forEach(visit);
  };
  forest.forEach(visit);
  return counts;
}
