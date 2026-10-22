import { describe, expect, it } from 'vitest';
import { makeTask } from '../../test/fixtures';
import { hasOpenDescendant, visibleRows } from './tree';

const leafA = makeTask({ id: '1.1.1', title: 'Upload', status: 'DONE' });
const leafB = makeTask({ id: '1.1.2', title: 'Validate', status: 'TODO' });
const child = makeTask({ id: '1.1', title: 'API', subtasks: [leafA, leafB] });
const root = makeTask({ id: '1', title: 'Profile', subtasks: [child] });
const other = makeTask({ id: '2', title: 'Other' });

describe('visibleRows', () => {
  it('flattens depth-first with depth and ancestors (nearest first)', () => {
    const rows = visibleRows([root, other], new Set());
    expect(rows.map((r) => [r.task.id, r.depth])).toEqual([
      ['1', 0],
      ['1.1', 1],
      ['1.1.1', 2],
      ['1.1.2', 2],
      ['2', 0],
    ]);
    expect(rows[2].ancestors.map((a) => a.id)).toEqual(['1.1', '1']);
  });

  it('hides the subtree of a collapsed task but keeps the task itself', () => {
    const rows = visibleRows([root, other], new Set(['1.1']));
    expect(rows.map((r) => r.task.id)).toEqual(['1', '1.1', '2']);
    expect(rows[1]).toMatchObject({ collapsed: true, hasSubtasks: true });
  });
});

describe('hasOpenDescendant', () => {
  it('looks at every depth', () => {
    expect(hasOpenDescendant(root)).toBe(true);
    expect(hasOpenDescendant(makeTask({ subtasks: [leafA] }))).toBe(false);
    expect(hasOpenDescendant(other)).toBe(false);
  });
});
