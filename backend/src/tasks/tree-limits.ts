/** Decision D10: depth counts levels including the root (1 / 1.1 / … / 1.1.1.1.1). */
export const MAX_TREE_DEPTH = 5;
export const MAX_TREE_NODES = 50;

export interface TreeLimitViolation {
  field: string;
  message: string;
}

/**
 * Iterative (no recursion) so a deeply nested 100kb body cannot overflow the stack,
 * and it stops as soon as a limit is exceeded so the work stays bounded. Shapes it
 * does not understand are left to DTO validation.
 */
export function checkTreeLimits(body: unknown): TreeLimitViolation | null {
  const stack: Array<{ node: unknown; depth: number }> = [
    { node: body, depth: 1 },
  ];
  let nodes = 0;
  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: unknown; depth: number };
    nodes += 1;
    if (nodes > MAX_TREE_NODES) {
      return {
        field: 'subtasks',
        message: `A task tree can contain at most ${String(MAX_TREE_NODES)} tasks in one request.`,
      };
    }
    if (depth > MAX_TREE_DEPTH) {
      return {
        field: 'subtasks',
        message: `Subtasks can be nested at most ${String(MAX_TREE_DEPTH)} levels deep.`,
      };
    }
    if (typeof node === 'object' && node !== null && 'subtasks' in node) {
      const { subtasks } = node;
      if (Array.isArray(subtasks)) {
        for (const child of subtasks as unknown[]) {
          stack.push({ node: child, depth: depth + 1 });
        }
      }
    }
  }
  return null;
}
