import { TaskStatus } from '../../generated/prisma/client';
import { AllDescendantsDoneRule } from './all-descendants-done.rule';
import { TaskRef } from './rule';
import { StatusTransitionContext } from './status-transition-rule';

const ref = (id: string, status: TaskStatus): TaskRef => ({
  id,
  title: `Task ${id}`,
  status,
});

function context(
  descendants: TaskRef[],
  targetStatus: TaskStatus = TaskStatus.DONE,
): StatusTransitionContext {
  return {
    task: ref('1', TaskStatus.IN_PROGRESS),
    descendants,
    ancestors: [],
    targetStatus,
    confirmCascade: false,
  };
}

describe('AllDescendantsDoneRule', () => {
  const rule = new AllDescendantsDoneRule();

  it('rejects Done while a grandchild is still open (all depths, decision D4)', () => {
    const result = rule.evaluate(
      context([ref('1.1', TaskStatus.DONE), ref('1.1.1', TaskStatus.TODO)]),
    );
    expect(result).toEqual({
      kind: 'reject',
      code: 'SUBTASKS_NOT_DONE',
      detail: '"Task 1" has 1 subtask(s) that are not done yet.',
      extensions: { openSubtasks: [ref('1.1.1', TaskStatus.TODO)] },
    });
  });

  it('allows Done when every descendant is Done', () => {
    expect(
      rule.evaluate(
        context([ref('1.1', TaskStatus.DONE), ref('1.1.1', TaskStatus.DONE)]),
      ).kind,
    ).toBe('allow');
  });

  it('allows Done for a task without subtasks', () => {
    expect(rule.evaluate(context([])).kind).toBe('allow');
  });

  it('ignores open descendants when the target is not Done', () => {
    expect(
      rule.evaluate(
        context([ref('1.1', TaskStatus.TODO)], TaskStatus.IN_PROGRESS),
      ).kind,
    ).toBe('allow');
  });
});
