import type { CreateTaskInput, FieldError } from '../../api/types';

export const TITLE_MAX_LENGTH = 500;
/** Mirrors the backend (decision D10): levels including the root, and tasks per request. */
export const MAX_DEPTH = 5;
export const MAX_NODES = 50;
// Mirrors the backend: PostgreSQL cannot store NUL, titles are single-line, and
// bidi overrides would make a title render reversed for everyone.
const CONTROL_CHARACTERS = /[\p{Cc}‪-‮⁦-⁩]/u;

export interface DraftNode {
  /** Stable React key; never sent to the API. */
  key: string;
  title: string;
  skillIds: string[];
  subtasks: DraftNode[];
}

/** Child indexes from the root: [] is the root, [0, 1] is task 1.1.2. */
export type NodePath = readonly number[];

export interface DraftState {
  root: DraftNode;
  submitAttempted: boolean;
  /** API field errors keyed by node key. */
  serverErrors: Partial<Record<string, { title?: string; skillIds?: string }>>;
  /** API errors that belong to the whole tree (e.g. size limits). */
  treeError?: string;
  /** Newly added node, so its title field can take focus. */
  focusKey?: string;
}

export type DraftAction =
  | { type: 'ADD_SUBTASK'; path: NodePath; key: string }
  | { type: 'REMOVE_NODE'; path: NodePath }
  | { type: 'UPDATE_TITLE'; path: NodePath; title: string }
  | { type: 'TOGGLE_SKILL'; path: NodePath; skillId: string }
  | { type: 'SUBMIT_ATTEMPTED' }
  | { type: 'SERVER_FIELD_ERRORS'; errors: readonly FieldError[] }
  | { type: 'RESET'; key: string };

export const emptyNode = (key: string): DraftNode => ({
  key,
  title: '',
  skillIds: [],
  subtasks: [],
});

export function initialDraftState(key: string): DraftState {
  return { root: emptyNode(key), submitAttempted: false, serverErrors: {} };
}

/** "1", "1.1", "1.1.2": the numbering shown next to each task. */
export const nodeLabel = (path: NodePath): string =>
  ['1', ...path.map((index) => String(index + 1))].join('.');

export function countNodes(node: DraftNode): number {
  return 1 + node.subtasks.reduce((sum, child) => sum + countNodes(child), 0);
}

export function canAddSubtask(root: DraftNode, path: NodePath): boolean {
  return path.length + 1 < MAX_DEPTH && countNodes(root) < MAX_NODES;
}

export function nodeAt(root: DraftNode, path: NodePath): DraftNode | undefined {
  let node = root;
  for (const index of path) {
    const child = node.subtasks.at(index);
    if (!child) return undefined;
    node = child;
  }
  return node;
}

/** DOM id of a node's title input, used to move focus to the first invalid one. */
export const titleInputId = (key: string) => `task-title-${key}`;

/** Immutable update of the node at `path`. */
function updateAt(
  node: DraftNode,
  path: NodePath,
  update: (target: DraftNode) => DraftNode,
): DraftNode {
  if (path.length === 0) {
    return update(node);
  }
  const [index, ...rest] = path;
  return {
    ...node,
    subtasks: node.subtasks.map((child, i) =>
      i === index ? updateAt(child, rest, update) : child,
    ),
  };
}

function withoutServerError(
  errors: DraftState['serverErrors'],
  key: string | undefined,
  field: 'title' | 'skillIds',
): DraftState['serverErrors'] {
  if (!key || !errors[key]) return errors;
  return { ...errors, [key]: { ...errors[key], [field]: undefined } };
}

export function draftReducer(
  state: DraftState,
  action: DraftAction,
): DraftState {
  switch (action.type) {
    case 'ADD_SUBTASK':
      if (!canAddSubtask(state.root, action.path)) return state;
      return {
        ...state,
        root: updateAt(state.root, action.path, (node) => ({
          ...node,
          subtasks: [...node.subtasks, emptyNode(action.key)],
        })),
        treeError: undefined,
        focusKey: action.key,
      };
    case 'REMOVE_NODE': {
      if (action.path.length === 0) return state;
      const parentPath = action.path.slice(0, -1);
      const index = action.path[action.path.length - 1];
      return {
        ...state,
        root: updateAt(state.root, parentPath, (node) => ({
          ...node,
          subtasks: node.subtasks.filter((_, i) => i !== index),
        })),
        treeError: undefined,
        focusKey: undefined,
      };
    }
    case 'UPDATE_TITLE':
      return {
        ...state,
        root: updateAt(state.root, action.path, (node) => ({
          ...node,
          title: action.title,
        })),
        serverErrors: withoutServerError(
          state.serverErrors,
          nodeAt(state.root, action.path)?.key,
          'title',
        ),
      };
    case 'TOGGLE_SKILL':
      return {
        ...state,
        root: updateAt(state.root, action.path, (node) => ({
          ...node,
          skillIds: node.skillIds.includes(action.skillId)
            ? node.skillIds.filter((id) => id !== action.skillId)
            : [...node.skillIds, action.skillId],
        })),
        serverErrors: withoutServerError(
          state.serverErrors,
          nodeAt(state.root, action.path)?.key,
          'skillIds',
        ),
      };
    case 'SUBMIT_ATTEMPTED':
      return { ...state, submitAttempted: true };
    case 'SERVER_FIELD_ERRORS':
      return { ...state, ...mapServerErrors(state.root, action.errors) };
    case 'RESET':
      return initialDraftState(action.key);
  }
}

/**
 * Maps API field paths such as "subtasks.0.subtasks.1.title" to the node they
 * belong to. Anything else (e.g. the tree-size check on "subtasks") is a tree error.
 */
function mapServerErrors(
  root: DraftNode,
  errors: readonly FieldError[],
): Pick<DraftState, 'serverErrors' | 'treeError'> {
  const serverErrors: DraftState['serverErrors'] = {};
  const treeMessages: string[] = [];
  for (const error of errors) {
    const parts = error.field.split('.');
    const path: number[] = [];
    while (parts[0] === 'subtasks' && /^\d+$/.test(parts[1] ?? '')) {
      path.push(Number(parts[1]));
      parts.splice(0, 2);
    }
    const field = parts[0];
    const node = nodeAt(root, path);
    if (node && (field === 'title' || field === 'skillIds')) {
      serverErrors[node.key] = {
        ...serverErrors[node.key],
        [field]: error.messages.join(' '),
      };
    } else {
      treeMessages.push(...error.messages);
    }
  }
  return {
    serverErrors,
    treeError: treeMessages.length > 0 ? treeMessages.join(' ') : undefined,
  };
}

/** Client-side checks mirror the API's; the API remains the authority. */
export function validateTitle(title: string): string | undefined {
  const trimmed = title.trim();
  if (trimmed.length === 0) return 'Enter a title.';
  if (trimmed.length > TITLE_MAX_LENGTH) {
    return `Title must be ${String(TITLE_MAX_LENGTH)} characters or fewer.`;
  }
  if (CONTROL_CHARACTERS.test(trimmed)) {
    return 'Title cannot contain tabs, control or text-direction characters.';
  }
  return undefined;
}

/** Title errors by node key, in document order (so the first one can be focused). */
export function validateDraft(root: DraftNode): Map<string, string> {
  const errors = new Map<string, string>();
  const visit = (node: DraftNode) => {
    const error = validateTitle(node.title);
    if (error) errors.set(node.key, error);
    node.subtasks.forEach(visit);
  };
  visit(root);
  return errors;
}

export function toCreateTaskInput(node: DraftNode): CreateTaskInput {
  return {
    title: node.title.trim(),
    ...(node.skillIds.length > 0 && { skillIds: node.skillIds }),
    ...(node.subtasks.length > 0 && {
      subtasks: node.subtasks.map(toCreateTaskInput),
    }),
  };
}
