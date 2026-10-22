import { checkTreeLimits, MAX_TREE_DEPTH, MAX_TREE_NODES } from './tree-limits';

/** Builds a chain without recursion so very deep inputs are cheap to create. */
function chain(depth: number): object {
  let node: object = { title: `level ${String(depth)}` };
  for (let level = depth - 1; level >= 1; level -= 1) {
    node = { title: `level ${String(level)}`, subtasks: [node] };
  }
  return node;
}

const flat = (nodes: number) => ({
  title: 'root',
  subtasks: Array.from({ length: nodes - 1 }, (_, i) => ({
    title: String(i),
  })),
});

describe('checkTreeLimits', () => {
  it(`accepts ${String(MAX_TREE_DEPTH)} levels and rejects ${String(MAX_TREE_DEPTH + 1)}`, () => {
    expect(checkTreeLimits(chain(MAX_TREE_DEPTH))).toBeNull();
    expect(checkTreeLimits(chain(MAX_TREE_DEPTH + 1))).toEqual({
      field: 'subtasks',
      message: 'Subtasks can be nested at most 5 levels deep.',
    });
  });

  it(`accepts ${String(MAX_TREE_NODES)} tasks and rejects ${String(MAX_TREE_NODES + 1)}`, () => {
    expect(checkTreeLimits(flat(MAX_TREE_NODES))).toBeNull();
    expect(checkTreeLimits(flat(MAX_TREE_NODES + 1))).toEqual({
      field: 'subtasks',
      message: 'A task tree can contain at most 50 tasks in one request.',
    });
  });

  it('handles extremely deep input without overflowing the stack', () => {
    expect(checkTreeLimits(chain(100_000))?.field).toBe('subtasks');
  });

  it('leaves malformed shapes to DTO validation', () => {
    expect(checkTreeLimits(null)).toBeNull();
    expect(checkTreeLimits({ title: 'x', subtasks: 'nope' })).toBeNull();
    expect(checkTreeLimits([1, 2, 3])).toBeNull();
  });
});
