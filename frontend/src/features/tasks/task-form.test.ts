import { describe, expect, it } from 'vitest';
import {
  initialTaskFormState,
  taskFormReducer,
  toCreateTaskInput,
  validateTaskForm,
} from './task-form';

describe('validateTaskForm', () => {
  it.each([
    ['', 'Enter a title.'],
    ['    ', 'Enter a title.'],
    ['x'.repeat(501), 'Title must be 500 characters or fewer.'],
    ['tab\there', 'Title cannot contain tabs or other control characters.'],
  ])('rejects %j', (title, message) => {
    expect(validateTaskForm({ title })).toEqual({ title: message });
  });

  it('accepts a title that is 500 characters after trimming', () => {
    expect(validateTaskForm({ title: `  ${'x'.repeat(500)}  ` })).toEqual({});
  });
});

describe('taskFormReducer', () => {
  it('toggles skills on and off', () => {
    const on = taskFormReducer(initialTaskFormState, {
      type: 'TOGGLE_SKILL',
      skillId: 'a',
    });
    expect(on.skillIds).toEqual(['a']);
    const off = taskFormReducer(on, { type: 'TOGGLE_SKILL', skillId: 'a' });
    expect(off.skillIds).toEqual([]);
  });

  it('maps server field errors and clears the title error when the title changes', () => {
    const withErrors = taskFormReducer(initialTaskFormState, {
      type: 'SERVER_FIELD_ERRORS',
      errors: [
        { field: 'title', messages: ['title is too long'] },
        { field: 'skillIds.0', messages: ['must be a UUID'] },
      ],
    });
    expect(withErrors.serverErrors).toEqual({
      title: 'title is too long',
      skillIds: 'must be a UUID',
    });

    const edited = taskFormReducer(withErrors, {
      type: 'SET_TITLE',
      title: 'New',
    });
    expect(edited.serverErrors.title).toBeUndefined();
    expect(edited.serverErrors.skillIds).toBe('must be a UUID');
  });
});

describe('toCreateTaskInput', () => {
  it('trims the title and omits empty skills', () => {
    expect(
      toCreateTaskInput({ ...initialTaskFormState, title: '  Hello  ' }),
    ).toEqual({ title: 'Hello' });
  });

  it('includes selected skills', () => {
    expect(
      toCreateTaskInput({
        ...initialTaskFormState,
        title: 'Hello',
        skillIds: ['a'],
      }),
    ).toEqual({ title: 'Hello', skillIds: ['a'] });
  });
});
