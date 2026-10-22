import { useId, useRef, useState, type ChangeEvent } from 'react';
import { cascadeAffectedTasks, errorMessage } from '../../../api/client';
import {
  TASK_STATUSES,
  type TaskNode,
  type TaskStatus,
  type TaskSummary,
} from '../../../api/types';
import type { Feedback } from '../../../components/LiveRegion';
import { selectClass } from '../../../components/styles';
import { useConfirmedCascadeStatus, useUpdateTaskStatus } from '../queries';
import { STATUS_LABELS } from '../status';
import { hasOpenDescendant } from '../tree';
import { ConfirmCascadeDialog } from './ConfirmCascadeDialog';

interface StatusSelectProps {
  task: TaskNode;
  /** Nearest first; used to predict a cascade without a round trip. */
  ancestors: readonly TaskNode[];
  onFeedback: (feedback: Feedback) => void;
}

interface PendingCascade {
  status: TaskStatus;
  affectedTasks: readonly TaskSummary[];
}

const toSummary = ({ id, title, status }: TaskNode): TaskSummary => ({
  id,
  title,
  status,
});

/**
 * Plain changes are optimistic with rollback. A change that would reopen Done
 * parents (decision D5) asks first and is not optimistic: the dialog opens straight
 * away when the cached tree predicts it, or when the server answers 409 because the
 * cache was stale.
 */
export function StatusSelect({
  task,
  ancestors,
  onFeedback,
}: StatusSelectProps) {
  const id = useId();
  const hintId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const optimistic = useUpdateTaskStatus();
  const cascade = useConfirmedCascadeStatus();
  const [pendingCascade, setPendingCascade] = useState<PendingCascade | null>(
    null,
  );
  const doneBlocked = task.status !== 'DONE' && hasOpenDescendant(task);

  const reportError = (error: unknown) => {
    onFeedback({
      kind: 'error',
      message: `Could not change the status of "${task.title}": ${errorMessage(error)}`,
    });
  };

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const status = TASK_STATUSES.find((s) => s === event.target.value);
    if (!status || status === task.status) {
      return;
    }
    if (task.status === 'DONE') {
      const doneAncestors = ancestors.filter((a) => a.status === 'DONE');
      if (doneAncestors.length > 0) {
        setPendingCascade({
          status,
          affectedTasks: doneAncestors.map(toSummary),
        });
        return;
      }
    }
    optimistic.mutate(
      { taskId: task.id, status },
      {
        onSuccess: () => {
          onFeedback({
            kind: 'success',
            message: `"${task.title}" is now ${STATUS_LABELS[status]}.`,
          });
        },
        onError: (error) => {
          const affectedTasks = cascadeAffectedTasks(error);
          if (affectedTasks) {
            setPendingCascade({ status, affectedTasks });
          } else {
            reportError(error);
          }
        },
      },
    );
  };

  const confirmCascade = (status: TaskStatus) => {
    cascade.mutate(
      { taskId: task.id, status },
      {
        onSuccess: (result) => {
          setPendingCascade(null);
          const updated = 1 + result.cascadedTaskIds.length;
          onFeedback({
            kind: 'success',
            message: `"${task.title}" is now ${STATUS_LABELS[status]}; updated ${String(updated)} tasks.`,
          });
        },
        onError: (error) => {
          setPendingCascade(null);
          reportError(error);
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
        ref={selectRef}
        id={id}
        // Cancelling the dialog needs no reset: the value always mirrors the cache.
        value={task.status}
        onChange={handleChange}
        aria-describedby={doneBlocked ? hintId : undefined}
        className={selectClass}
      >
        {TASK_STATUSES.map((status) => (
          <option
            key={status}
            value={status}
            disabled={status === 'DONE' && doneBlocked}
          >
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      {doneBlocked && (
        <span id={hintId} className="sr-only">
          Done is unavailable until all subtasks are done.
        </span>
      )}
      {pendingCascade && (
        <ConfirmCascadeDialog
          taskTitle={task.title}
          targetStatus={pendingCascade.status}
          affectedTasks={pendingCascade.affectedTasks}
          pending={cascade.isPending}
          onConfirm={() => {
            confirmCascade(pendingCascade.status);
          }}
          onCancel={() => {
            setPendingCascade(null);
          }}
          returnFocusTo={selectRef}
        />
      )}
    </>
  );
}
