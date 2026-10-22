import type { TaskNode } from '../../api/types';

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

/** UX hint only (decision D4): the backend makes the final call. */
export function hasOpenDescendant(task: TaskNode): boolean {
  return task.subtasks.some(
    (child) => child.status !== 'DONE' || hasOpenDescendant(child),
  );
}
