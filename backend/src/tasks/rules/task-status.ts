import { TaskStatus } from '../../generated/prisma/client';

/**
 * Done and Cancelled both close a task: no work is left on it. The tree invariant is
 * "a Done task has only closed descendants".
 */
const CLOSED_STATUSES: ReadonlySet<TaskStatus> = new Set([
  TaskStatus.DONE,
  TaskStatus.CANCELLED,
]);

export const isClosed = (status: TaskStatus): boolean =>
  CLOSED_STATUSES.has(status);
