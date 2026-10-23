import { useId, useRef, useState, type ChangeEvent } from 'react';
import { cascadeAffectedTasks, errorMessage } from '../../../api/client';
import {
  TASK_STATUSES,
  type TaskNode,
  type TaskStatus,
  type TaskSummary,
} from '../../../api/types';
import { LockIcon } from '../../../components/icons';
import type { Feedback } from '../../../components/LiveRegion';
import { statusSelectBaseClass } from '../../../components/styles';
import { useConfirmedCascadeStatus, useUpdateTaskStatus } from '../queries';
import { isClosed, STATUS_LABELS, STATUS_TONES } from '../status';
import { countOpenDescendants } from '../tree';
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
  const openSubtasks = task.status === 'DONE' ? 0 : countOpenDescendants(task);
  const doneBlocked = openSubtasks > 0;

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
    // Reopening a closed (Done or Cancelled) task under Done parents cascades.
    if (isClosed(task.status) && !isClosed(status)) {
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
            kind: status === 'CANCELLED' ? 'cancelled' : 'success',
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
    <div className="flex flex-col items-end gap-1 md:items-start">
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
        className={`${statusSelectBaseClass} ${STATUS_TONES[task.status].control}`}
      >
        {TASK_STATUSES.map((status) => {
          const locked = status === 'DONE' && doneBlocked;
          return (
            <option key={status} value={status} disabled={locked}>
              {/* Spelled out: a greyed-out option alone is easy to miss. */}
              {locked ? 'Done (locked)' : STATUS_LABELS[status]}
            </option>
          );
        })}
      </select>
      {doneBlocked && (
        <p
          id={hintId}
          className="flex max-w-40 items-start gap-1 text-xs text-amber-800"
        >
          <LockIcon className="mt-px size-3.5 shrink-0" />
          <span>
            {`Done locked: ${String(openSubtasks)} ${
              openSubtasks === 1 ? 'subtask' : 'subtasks'
            } still open.`}
          </span>
        </p>
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
    </div>
  );
}
