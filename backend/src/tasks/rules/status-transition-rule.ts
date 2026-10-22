import type { Prisma, TaskStatus } from '../../generated/prisma/client';
import { Rule } from './rule';

export interface StatusTransitionContext {
  /** Rules run inside the locking transaction so their reads stay consistent. */
  tx: Prisma.TransactionClient;
  task: { id: string; title: string; status: TaskStatus };
  targetStatus: TaskStatus;
  confirmCascade: boolean;
}

/** Phase P4 adds AllDescendantsDoneRule and AncestorRollbackRule here. */
export type StatusTransitionRule = Rule<StatusTransitionContext>;

/** DI token for the ordered status-transition rule chain. */
export const STATUS_TRANSITION_RULES = Symbol('STATUS_TRANSITION_RULES');
