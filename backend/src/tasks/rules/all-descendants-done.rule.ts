import { TaskStatus } from '../../generated/prisma/client';
import { ALLOW, RuleResult } from './rule';
import {
  StatusTransitionContext,
  StatusTransitionRule,
} from './status-transition-rule';

/** Decision D4: a task can be Done only when every descendant, at any depth, is Done. */
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
      (descendant) => descendant.status !== TaskStatus.DONE,
    );
    if (openSubtasks.length === 0) {
      return ALLOW;
    }
    return {
      kind: 'reject',
      code: 'SUBTASKS_NOT_DONE',
      detail: `"${task.title}" has ${String(openSubtasks.length)} subtask(s) that are not done yet.`,
      extensions: { openSubtasks },
    };
  }
}
