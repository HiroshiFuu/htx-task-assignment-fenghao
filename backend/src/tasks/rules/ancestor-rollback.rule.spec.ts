import { TaskStatus } from '../../generated/prisma/client';
import { AncestorRollbackRule } from './ancestor-rollback.rule';
import { TaskRef } from './rule';
import { StatusTransitionContext } from './status-transition-rule';

const ref = (id: string, status: TaskStatus): TaskRef => ({
  id,
  title: `Task ${id}`,
  status,
});

const DONE_ANCESTORS = [ref('1.1', TaskStatus.DONE), ref('1', TaskStatus.DONE)];

function context(
  overrides: Partial<StatusTransitionContext> = {},
): StatusTransitionContext {
  return {
    task: ref('1.1.1', TaskStatus.DONE),
    descendants: [],
    ancestors: DONE_ANCESTORS,
    targetStatus: TaskStatus.TODO,
    confirmCascade: false,
    ...overrides,
  };
}

describe('AncestorRollbackRule', () => {
  const rule = new AncestorRollbackRule();

  it('requires confirmation and lists Done ancestors nearest first', () => {
    expect(rule.evaluate(context())).toEqual({
      kind: 'requireConfirmation',
      code: 'CASCADE_CONFIRMATION_REQUIRED',
      detail:
        'Reopening "Task 1.1.1" will move 2 completed parent task(s) back to In Progress.',
      affectedTasks: DONE_ANCESTORS,
    });
  });

  it('allows with the ancestors to cascade once confirmed', () => {
    expect(rule.evaluate(context({ confirmCascade: true }))).toEqual({
      kind: 'allow',
      cascadeTaskIds: ['1.1', '1'],
    });
  });

  it('only cascades ancestors that are Done', () => {
    const result = rule.evaluate(
      context({
        ancestors: [
          ref('1.1', TaskStatus.DONE),
          ref('1', TaskStatus.IN_PROGRESS),
        ],
        confirmCascade: true,
      }),
    );
    expect(result).toEqual({ kind: 'allow', cascadeTaskIds: ['1.1'] });
  });

  it('allows without confirmation when no ancestor is Done', () => {
    expect(
      rule.evaluate(
        context({ ancestors: [ref('1.1', TaskStatus.IN_PROGRESS)] }),
      ),
    ).toEqual({ kind: 'allow' });
  });

  it('also requires confirmation when reopening a Cancelled task under Done parents', () => {
    expect(
      rule.evaluate(
        context({
          task: ref('1.1.1', TaskStatus.CANCELLED),
          targetStatus: TaskStatus.IN_PROGRESS,
        }),
      ),
    ).toMatchObject({
      kind: 'requireConfirmation',
      affectedTasks: DONE_ANCESTORS,
    });
  });

  it('needs no cascade between Done and Cancelled (the task stays closed)', () => {
    expect(
      rule.evaluate(context({ targetStatus: TaskStatus.CANCELLED })),
    ).toEqual({ kind: 'allow' });
    expect(
      rule.evaluate(
        context({
          task: ref('1.1.1', TaskStatus.CANCELLED),
          targetStatus: TaskStatus.DONE,
        }),
      ),
    ).toEqual({ kind: 'allow' });
  });

  it('does nothing when the task is not leaving Done', () => {
    expect(
      rule.evaluate(
        context({
          task: ref('1.1.1', TaskStatus.TODO),
          targetStatus: TaskStatus.IN_PROGRESS,
        }),
      ).kind,
    ).toBe('allow');
    expect(rule.evaluate(context({ targetStatus: TaskStatus.DONE })).kind).toBe(
      'allow',
    );
  });
});
