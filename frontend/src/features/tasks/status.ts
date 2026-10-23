import type { TaskStatus } from '../../api/types';

/** Decision D2: API values are enums; the UI shows these labels. */
export const STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  TODO: 'To-do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

/** Same rule as the backend: Done and Cancelled both close a task. */
export const isClosed = (status: TaskStatus): boolean =>
  status === 'DONE' || status === 'CANCELLED';
