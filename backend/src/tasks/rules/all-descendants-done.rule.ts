import { TaskStatus } from '../../generated/prisma/client';
import { ALLOW, RuleResult } from './rule';
import {
  StatusTransitionContext,
  StatusTransitionRule,
} from './status-transition-rule';
import { isClosed } from './task-status';

/**
 * Decision D4: a task can be Done only when every descendant, at any depth, is
 * closed: Done, or Cancelled (cancelled work no longer blocks its parent).
 */
export class AllDescendantsDoneRule implements StatusTransitionRule {
  evaluate({
    task,
    descendants,
    targetStatus,
  }: StatusTransitionContext): RuleResult {
    if (targetStatus !== TaskStatus.DONE) {
      return ALLOW;
    }
    const openSubtasks = descendants.filter(
      (descendant) => !isClosed(descendant.status),
    );
    if (openSubtasks.length === 0) {
      return ALLOW;
    }
    return {
      kind: 'reject',
      code: 'SUBTASKS_NOT_DONE',
      detail: `"${task.title}" has ${String(openSubtasks.length)} subtask(s) that are not done or cancelled yet.`,
      extensions: { openSubtasks },
    };
  }
}
