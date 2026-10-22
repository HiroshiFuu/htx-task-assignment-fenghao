import type { TaskStatus } from '../../generated/prisma/client';

export interface AffectedTask {
  id: string;
  title: string;
  status: TaskStatus;
}

export type RuleResult =
  | { kind: 'allow' }
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

/** Runs rules in order and stops at the first one that does not allow. */
export async function runRuleChain<Context>(
  rules: readonly Rule<Context>[],
  context: Context,
): Promise<RuleResult> {
  for (const rule of rules) {
    const result = await rule.evaluate(context);
    if (result.kind !== 'allow') {
      return result;
    }
  }
  return ALLOW;
}
