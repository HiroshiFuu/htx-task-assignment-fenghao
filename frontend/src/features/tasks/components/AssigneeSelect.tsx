import { useId, type ChangeEvent } from 'react';
import { errorMessage } from '../../../api/client';
import type { Developer, DeveloperSummary, TaskNode } from '../../../api/types';
import type { Feedback } from '../../../components/LiveRegion';
import { selectClass } from '../../../components/styles';
import { eligibleDevelopers } from '../eligibility';
import { useUpdateTaskAssignee } from '../queries';

const UNASSIGNED = '';

interface AssigneeSelectProps {
  task: TaskNode;
  developers: readonly Developer[];
  onFeedback: (feedback: Feedback) => void;
}

/**
 * Lists only developers whose skills cover the task (the backend still enforces it).
 * Optimistic, with rollback and the server's reason on failure.
 */
export function AssigneeSelect({
  task,
  developers,
  onFeedback,
}: AssigneeSelectProps) {
  const id = useId();
  const hintId = useId();
  const { mutate } = useUpdateTaskAssignee();

  const options: DeveloperSummary[] = eligibleDevelopers(
    developers,
    task.skills,
  );
  const current = task.assignee;
  // Keep a stale current assignee selectable so the control never shows a wrong value.
  if (current && !options.some((d) => d.id === current.id)) {
    options.unshift(current);
  }

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const assignee =
      value === UNASSIGNED
        ? null
        : (options.find((d) => d.id === value) ?? null);
    if ((assignee?.id ?? null) === (current?.id ?? null)) {
      return;
    }
    mutate(
      {
        taskId: task.id,
        assignee: assignee && { id: assignee.id, name: assignee.name },
      },
      {
        onSuccess: () => {
          onFeedback({
            kind: 'success',
            message: assignee
              ? `Assigned "${task.title}" to ${assignee.name}.`
              : `Unassigned "${task.title}".`,
          });
        },
        onError: (error) => {
          onFeedback({
            kind: 'error',
            message: `Could not change the assignee of "${task.title}": ${errorMessage(error)}`,
          });
        },
      },
    );
  };

  const noneEligible = options.length === 0;

  return (
    <div className="flex flex-col items-end gap-1 md:items-start">
      <label htmlFor={id} className="sr-only">
        Assignee for {task.title}
      </label>
      <select
        id={id}
        value={current?.id ?? UNASSIGNED}
        onChange={handleChange}
        aria-describedby={noneEligible ? hintId : undefined}
        className={selectClass}
      >
        <option value={UNASSIGNED}>Unassigned</option>
        {options.map((developer) => (
          <option key={developer.id} value={developer.id}>
            {developer.name}
          </option>
        ))}
      </select>
      {noneEligible && (
        <p id={hintId} className="text-xs text-slate-500">
          No developer has all required skills.
        </p>
      )}
    </div>
  );
}
