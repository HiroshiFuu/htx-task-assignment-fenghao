import type { TaskStatus } from '../../generated/prisma/client';

export interface TaskRef {
  id: string;
  title: string;
  status: TaskStatus;
}

/** Tasks listed in a 409 so the client can show what a confirmation would change. */
export type AffectedTask = TaskRef;

export type RuleResult =
  /** cascadeTaskIds: extra tasks the service must update in the same transaction. */
  | { kind: 'allow'; cascadeTaskIds?: readonly string[] }
  | {
      kind: 'reject';
      code: string;
      detail: string;
      extensions?: Record<string, unknown>;
    }
  | {
      kind: 'requireConfirmation';
      code: string;
      detail: string;
      affectedTasks: AffectedTask[];
    };

export const ALLOW: RuleResult = Object.freeze({ kind: 'allow' });

/** One link of a Chain of Responsibility: allow to pass the request on, or stop it. */
export interface Rule<Context> {
  evaluate(context: Context): RuleResult | Promise<RuleResult>;
}

/**
 * Runs rules in order and stops at the first one that does not allow. When every
 * rule allows, their cascade requests are merged.
 */
export async function runRuleChain<Context>(
  rules: readonly Rule<Context>[],
  context: Context,
): Promise<RuleResult> {
  const cascadeTaskIds = new Set<string>();
  for (const rule of rules) {
    const result = await rule.evaluate(context);
    if (result.kind !== 'allow') {
      return result;
    }
    result.cascadeTaskIds?.forEach((id) => cascadeTaskIds.add(id));
  }
  return cascadeTaskIds.size > 0
    ? { kind: 'allow', cascadeTaskIds: [...cascadeTaskIds] }
    : ALLOW;
}
