import { useId, type ChangeEvent } from 'react';
import { errorMessage } from '../../../api/client';
import { TASK_STATUSES, type TaskNode } from '../../../api/types';
import type { Feedback } from '../../../components/LiveRegion';
import { selectClass } from '../../../components/styles';
import { useUpdateTaskStatus } from '../queries';
import { STATUS_LABELS } from '../status';

interface StatusSelectProps {
  task: TaskNode;
  onFeedback: (feedback: Feedback) => void;
}

/** Optimistic: the cache changes immediately and is rolled back if the API refuses. */
export function StatusSelect({ task, onFeedback }: StatusSelectProps) {
  const id = useId();
  const { mutate } = useUpdateTaskStatus();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const status = TASK_STATUSES.find((s) => s === event.target.value);
    if (!status || status === task.status) {
      return;
    }
    mutate(
      { taskId: task.id, status },
      {
        onSuccess: () => {
          onFeedback({
            kind: 'success',
            message: `"${task.title}" is now ${STATUS_LABELS[status]}.`,
          });
        },
        onError: (error) => {
          onFeedback({
            kind: 'error',
            message: `Could not change the status of "${task.title}": ${errorMessage(error)}`,
          });
        },
      },
    );
  };

  return (
    <>
      <label htmlFor={id} className="sr-only">
        Status for {task.title}
      </label>
      <select
        id={id}
        value={task.status}
        onChange={handleChange}
        className={selectClass}
      >
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </>
  );
}
