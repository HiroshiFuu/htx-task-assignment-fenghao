import type { TaskStatus } from '../../generated/prisma/client';
import { Rule, TaskRef } from './rule';

/**
 * Loaded by the service inside the transaction after the rows are locked, so rules
 * are pure functions of a consistent snapshot and need no database access.
 */
export interface StatusTransitionContext {
  task: TaskRef;
  /** Every descendant, at any depth (decision D4). */
  descendants: readonly TaskRef[];
  /** Ancestors ordered nearest first. */
  ancestors: readonly TaskRef[];
  targetStatus: TaskStatus;
  confirmCascade: boolean;
}

export type StatusTransitionRule = Rule<StatusTransitionContext>;

/** DI token for the ordered status-transition rule chain. */
export const STATUS_TRANSITION_RULES = Symbol('STATUS_TRANSITION_RULES');
