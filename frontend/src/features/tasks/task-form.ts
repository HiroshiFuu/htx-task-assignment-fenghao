import type { CreateTaskInput, FieldError } from '../../api/types';

export const TITLE_MAX_LENGTH = 500;
// Mirrors the backend: PostgreSQL cannot store NUL, and titles are single-line.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

export interface TaskFormState {
  title: string;
  skillIds: string[];
  submitAttempted: boolean;
  /** Field errors returned by the API (400 problem+json `errors`). */
  serverErrors: { title?: string; skillIds?: string };
}

export type TaskFormAction =
  | { type: 'SET_TITLE'; title: string }
  | { type: 'TOGGLE_SKILL'; skillId: string }
  | { type: 'SUBMIT_ATTEMPTED' }
  | { type: 'SERVER_FIELD_ERRORS'; errors: readonly FieldError[] };

export const initialTaskFormState: TaskFormState = {
  title: '',
  skillIds: [],
  submitAttempted: false,
  serverErrors: {},
};

export function taskFormReducer(
  state: TaskFormState,
  action: TaskFormAction,
): TaskFormState {
  switch (action.type) {
    case 'SET_TITLE':
      return {
        ...state,
        title: action.title,
        serverErrors: { ...state.serverErrors, title: undefined },
      };
    case 'TOGGLE_SKILL':
      return {
        ...state,
        skillIds: state.skillIds.includes(action.skillId)
          ? state.skillIds.filter((id) => id !== action.skillId)
          : [...state.skillIds, action.skillId],
        serverErrors: { ...state.serverErrors, skillIds: undefined },
      };
    case 'SUBMIT_ATTEMPTED':
      return { ...state, submitAttempted: true };
    case 'SERVER_FIELD_ERRORS':
      return { ...state, serverErrors: toServerErrors(action.errors) };
  }
}

function toServerErrors(
  errors: readonly FieldError[],
): TaskFormState['serverErrors'] {
  const messageFor = (field: string) =>
    errors
      .filter((e) => e.field === field || e.field.startsWith(`${field}.`))
      .flatMap((e) => e.messages)
      .join(' ') || undefined;
  return { title: messageFor('title'), skillIds: messageFor('skillIds') };
}

/** Client-side checks mirror the API's; the API remains the authority. */
export function validateTaskForm(state: Pick<TaskFormState, 'title'>): {
  title?: string;
} {
  const title = state.title.trim();
  if (title.length === 0) {
    return { title: 'Enter a title.' };
  }
  if (title.length > TITLE_MAX_LENGTH) {
    return {
      title: `Title must be ${String(TITLE_MAX_LENGTH)} characters or fewer.`,
    };
  }
  if (CONTROL_CHARACTERS.test(title)) {
    return { title: 'Title cannot contain tabs or other control characters.' };
  }
  return {};
}

export function toCreateTaskInput(state: TaskFormState): CreateTaskInput {
  const title = state.title.trim();
  return state.skillIds.length > 0
    ? { title, skillIds: state.skillIds }
    : { title };
}
