import { describe, expect, it } from 'vitest';
import {
  canAddSubtask,
  draftReducer,
  initialDraftState,
  MAX_DEPTH,
  MAX_NODES,
  nodeAt,
  nodeLabel,
  toCreateTaskInput,
  validateDraft,
  validateTitle,
  type DraftAction,
  type DraftState,
} from './task-draft';

let counter = 0;
const nextKey = () => `k${String((counter += 1))}`;

function apply(state: DraftState, ...actions: DraftAction[]): DraftState {
  return actions.reduce(draftReducer, state);
}

/** Wireframe 3: 1 / 1.1 / 1.1.1 / 1.1.2 */
function wireframe(): DraftState {
  return apply(
    initialDraftState('root'),
    { type: 'UPDATE_TITLE', path: [], title: 'Profile' },
    { type: 'ADD_SUBTASK', path: [], key: 'a' },
    { type: 'UPDATE_TITLE', path: [0], title: 'API' },
    { type: 'ADD_SUBTASK', path: [0], key: 'b' },
    { type: 'ADD_SUBTASK', path: [0], key: 'c' },
    { type: 'UPDATE_TITLE', path: [0, 0], title: 'Upload' },
    { type: 'UPDATE_TITLE', path: [0, 1], title: 'Validate' },
    { type: 'TOGGLE_SKILL', path: [0, 1], skillId: 'backend' },
  );
}

describe('draftReducer', () => {
  it('builds a nested tree with add, title and skill actions', () => {
    expect(toCreateTaskInput(wireframe().root)).toEqual({
      title: 'Profile',
      subtasks: [
        {
          title: 'API',
          subtasks: [
            { title: 'Upload' },
            { title: 'Validate', skillIds: ['backend'] },
          ],
        },
      ],
    });
  });

  it('removes a nested node with its own subtasks', () => {
    const state = apply(wireframe(), { type: 'REMOVE_NODE', path: [0, 0] });
    expect(nodeAt(state.root, [0])?.subtasks.map((n) => n.title)).toEqual([
      'Validate',
    ]);
    const emptied = apply(wireframe(), { type: 'REMOVE_NODE', path: [0] });
    expect(emptied.root.subtasks).toEqual([]);
  });

  it('never removes the root', () => {
    const state = wireframe();
    expect(draftReducer(state, { type: 'REMOVE_NODE', path: [] })).toBe(state);
  });

  it('toggles a skill off again and marks the new node for focus', () => {
    const state = apply(
      wireframe(),
      { type: 'TOGGLE_SKILL', path: [0, 1], skillId: 'backend' },
      { type: 'ADD_SUBTASK', path: [], key: 'new' },
    );
    expect(nodeAt(state.root, [0, 1])?.skillIds).toEqual([]);
    expect(state.focusKey).toBe('new');
  });

  it('maps nested API field errors to their node and clears them on edit', () => {
    const withErrors = apply(wireframe(), {
      type: 'SERVER_FIELD_ERRORS',
      errors: [
        { field: 'subtasks.0.subtasks.1.title', messages: ['too long'] },
        { field: 'subtasks', messages: ['Too many tasks.'] },
      ],
    });
    expect(withErrors.serverErrors).toEqual({ c: { title: 'too long' } });
    expect(withErrors.treeError).toBe('Too many tasks.');

    const edited = apply(withErrors, {
      type: 'UPDATE_TITLE',
      path: [0, 1],
      title: 'Validate image',
    });
    expect(edited.serverErrors.c?.title).toBeUndefined();
  });
});

describe('tree limits', () => {
  it(`allows subtasks only down to ${String(MAX_DEPTH)} levels`, () => {
    let state = initialDraftState(nextKey());
    const path: number[] = [];
    while (canAddSubtask(state.root, path)) {
      state = draftReducer(state, {
        type: 'ADD_SUBTASK',
        path,
        key: nextKey(),
      });
      path.push(0);
    }
    expect(path.length + 1).toBe(MAX_DEPTH);
    expect(nodeLabel(path)).toBe('1.1.1.1.1');
    // The reducer refuses beyond the limit too.
    expect(
      draftReducer(state, { type: 'ADD_SUBTASK', path, key: nextKey() }),
    ).toBe(state);
  });

  it(`allows at most ${String(MAX_NODES)} tasks`, () => {
    let state = initialDraftState(nextKey());
    for (let i = 1; i < MAX_NODES; i += 1) {
      state = draftReducer(state, {
        type: 'ADD_SUBTASK',
        path: [],
        key: nextKey(),
      });
    }
    expect(canAddSubtask(state.root, [])).toBe(false);
  });
});

describe('validation', () => {
  it.each([
    ['', 'Enter a title.'],
    ['   ', 'Enter a title.'],
    ['x'.repeat(501), 'Title must be 500 characters or fewer.'],
    [
      'tab\there',
      'Title cannot contain tabs, control or text-direction characters.',
    ],
    [
      'evil‮txt.exe',
      'Title cannot contain tabs, control or text-direction characters.',
    ],
    [
      'c1\u0085control',
      'Title cannot contain tabs, control or text-direction characters.',
    ],
  ])('rejects %j', (title, message) => {
    expect(validateTitle(title)).toBe(message);
  });

  it('reports every invalid node in document order', () => {
    const state = apply(
      wireframe(),
      { type: 'UPDATE_TITLE', path: [0, 0], title: ' ' },
      { type: 'UPDATE_TITLE', path: [], title: '' },
    );
    expect([...validateDraft(state.root).keys()]).toEqual(['root', 'b']);
  });

  it('labels nodes 1 / 1.1 / 1.1.2', () => {
    expect([nodeLabel([]), nodeLabel([0]), nodeLabel([0, 1])]).toEqual([
      '1',
      '1.1',
      '1.1.2',
    ]);
  });
});
