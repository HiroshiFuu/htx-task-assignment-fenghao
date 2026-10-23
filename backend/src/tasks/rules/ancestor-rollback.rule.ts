import { TaskStatus } from '../../generated/prisma/client';
import { ALLOW, RuleResult } from './rule';
import {
  StatusTransitionContext,
  StatusTransitionRule,
} from './status-transition-rule';
import { isClosed } from './task-status';

/**
 * Decision D5: reopening a closed (Done or Cancelled) task would leave Done ancestors
 * with an open descendant, so they are rolled back to IN_PROGRESS, but only after
 * the client confirms. Because "a Done task has only closed descendants", this only
 * arises when the task goes from closed to open; Done ↔ Cancelled needs no cascade.
 */
export class AncestorRollbackRule implements StatusTransitionRule {
  evaluate({
    task,
    ancestors,
    targetStatus,
    confirmCascade,
  }: StatusTransitionContext): RuleResult {
    if (!isClosed(task.status) || isClosed(targetStatus)) {
      return ALLOW;
    }
    const doneAncestors = ancestors.filter(
      (ancestor) => ancestor.status === TaskStatus.DONE,
    );
    if (doneAncestors.length === 0) {
      return ALLOW;
    }
    if (!confirmCascade) {
      return {
        kind: 'requireConfirmation',
        code: 'CASCADE_CONFIRMATION_REQUIRED',
        detail: `Reopening "${task.title}" will move ${String(doneAncestors.length)} completed parent task(s) back to In Progress.`,
        affectedTasks: doneAncestors,
      };
    }
    return {
      kind: 'allow',
      cascadeTaskIds: doneAncestors.map((ancestor) => ancestor.id),
    };
  }
}
