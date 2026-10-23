import { TASK_STATUSES, type TaskNode } from '../../../api/types';
import { STATUS_LABELS, STATUS_TONES } from '../status';
import { countByStatus } from '../tree';

/** At-a-glance progress across every task and subtask. */
export function StatusSummary({ tasks }: { tasks: readonly TaskNode[] }) {
  const counts = countByStatus(tasks);
  const total = TASK_STATUSES.reduce((sum, status) => sum + counts[status], 0);

  return (
    <dl
      aria-label="Task counts"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600"
    >
      <div className="flex items-baseline gap-1.5">
        <dt className="font-medium text-slate-900">All tasks</dt>
        <dd className="tabular-nums">{total}</dd>
      </div>
      {TASK_STATUSES.map((status) => (
        <div key={status} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${STATUS_TONES[status].dot}`}
          />
          <dt>{STATUS_LABELS[status]}</dt>
          <dd className="font-medium text-slate-900 tabular-nums">
            {counts[status]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
