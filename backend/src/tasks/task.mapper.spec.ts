import { buildTaskForest } from './task.mapper';
import type { TaskRow } from './tasks.repository';

function row(id: string, parentId: string | null): TaskRow {
  const at = new Date('2026-10-22T00:00:00.000Z');
  return {
    id,
    title: `Task ${id}`,
    status: 'TODO',
    assigneeId: null,
    assignee: null,
    parentId,
    position: 0,
    skills: [],
    createdAt: at,
    updatedAt: at,
  };
}

const ids = (nodes: { id: string; subtasks: unknown[] }[]): unknown =>
  nodes.map((n) => ({
    id: n.id,
    subtasks: ids(n.subtasks as { id: string; subtasks: unknown[] }[]),
  }));

describe('buildTaskForest', () => {
  it('nests rows under their parents, keeping row order among siblings', () => {
    const forest = buildTaskForest([
      row('1', null),
      row('2', null),
      row('1.1', '1'),
      row('1.1.1', '1.1'),
      row('1.1.2', '1.1'),
    ]);
    expect(ids(forest)).toEqual([
      {
        id: '1',
        subtasks: [
          {
            id: '1.1',
            subtasks: [
              { id: '1.1.1', subtasks: [] },
              { id: '1.1.2', subtasks: [] },
            ],
          },
        ],
      },
      { id: '2', subtasks: [] },
    ]);
  });

  it('treats a row whose parent is outside the set as the root of a subtree', () => {
    const [subtree] = buildTaskForest([row('1.1', '1'), row('1.1.1', '1.1')]);
    expect(subtree.id).toBe('1.1');
    expect(subtree.parentId).toBe('1');
    expect(subtree.subtasks.map((s) => s.id)).toEqual(['1.1.1']);
  });
});
