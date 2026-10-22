import { useEffect, useId, useRef, type RefObject } from 'react';
import type { TaskStatus, TaskSummary } from '../../../api/types';
import {
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../components/styles';
import { STATUS_LABELS } from '../status';

interface ConfirmCascadeDialogProps {
  taskTitle: string;
  targetStatus: TaskStatus;
  /** Done ancestors that would move back to In Progress, nearest first. */
  affectedTasks: readonly TaskSummary[];
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Element that opened the dialog; focus goes back to it on close. */
  returnFocusTo: RefObject<HTMLElement | null>;
}

/**
 * Decision D5. Native <dialog> + showModal() gives a focus trap, Esc to close and an
 * inert background for free. Focus starts on Cancel: the safe default.
 */
export function ConfirmCascadeDialog({
  taskTitle,
  targetStatus,
  affectedTasks,
  pending,
  onConfirm,
  onCancel,
  returnFocusTo,
}: ConfirmCascadeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    cancelRef.current?.focus();
    const returnTarget = returnFocusTo.current;
    return () => {
      dialog.close();
      // Keyboard and screen-reader users continue where they started.
      returnTarget?.focus();
    };
  }, [returnFocusTo]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        // Esc: keep React in control of closing.
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="space-y-4 p-6">
        <h2 id={headingId} className="text-lg font-semibold">
          Reopen parent tasks?
        </h2>
        <div id={descriptionId} className="space-y-2 text-sm text-slate-700">
          <p>
            Changing &ldquo;{taskTitle}&rdquo; to {STATUS_LABELS[targetStatus]}{' '}
            will move{' '}
            {affectedTasks.length === 1
              ? 'this completed parent task'
              : `these ${String(affectedTasks.length)} completed parent tasks`}{' '}
            back to In Progress:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {affectedTasks.map((task) => (
              <li key={task.id} className="break-words">
                {task.title}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          {/* aria-disabled, not disabled: a disabled button drops focus out of the modal. */}
          <button
            ref={cancelRef}
            type="button"
            aria-disabled={pending}
            onClick={() => {
              if (!pending) onCancel();
            }}
            className={`${secondaryButtonClass} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
          >
            Cancel
          </button>
          <button
            type="button"
            aria-disabled={pending}
            onClick={() => {
              if (!pending) onConfirm();
            }}
            className={`${primaryButtonClass} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
          >
            {pending ? 'Updating…' : 'Confirm and roll back'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
