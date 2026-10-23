import type { TaskStatus } from '../../api/types';

/** Decision D2: API values are enums; the UI shows these labels. */
export const STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  TODO: 'To-do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

/**
 * One colour per status, shared by the select and the list summary. Literal class
 * names so Tailwind can find them. Colour is never the only cue: the label is
 * always shown next to it.
 */
export const STATUS_TONES: Readonly<
  Record<TaskStatus, { control: string; dot: string }>
> = {
  TODO: {
    control: 'border-slate-300 bg-white text-slate-700',
    dot: 'bg-slate-400',
  },
  IN_PROGRESS: {
    control: 'border-sky-300 bg-sky-50 text-sky-800',
    dot: 'bg-sky-500',
  },
  DONE: {
    control: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  CANCELLED: {
    control: 'border-red-200 bg-red-50 text-red-700',
    dot: 'bg-red-500',
  },
};

/** Same rule as the backend: Done and Cancelled both close a task. */
export const isClosed = (status: TaskStatus): boolean =>
  status === 'DONE' || status === 'CANCELLED';
