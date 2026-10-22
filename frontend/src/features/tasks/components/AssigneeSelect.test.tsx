import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  BACKEND,
  developers,
  FRONTEND,
  makeTask,
} from '../../../test/fixtures';
import { renderWithProviders } from '../../../test/utils';
import { AssigneeSelect } from './AssigneeSelect';

function optionNames(): string[] {
  const select = screen.getByRole('combobox', { name: /assignee for/i });
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);
}

describe('AssigneeSelect', () => {
  it('offers only developers with every required skill, plus Unassigned', () => {
    renderWithProviders(
      <AssigneeSelect
        task={makeTask({ skills: [FRONTEND] })}
        developers={developers}
        onFeedback={vi.fn()}
      />,
    );
    expect(optionNames()).toEqual(['Unassigned', 'Alice', 'Carol']);
  });

  it('offers only Carol for a Frontend + Backend task', () => {
    renderWithProviders(
      <AssigneeSelect
        task={makeTask({ skills: [BACKEND, FRONTEND] })}
        developers={developers}
        onFeedback={vi.fn()}
      />,
    );
    expect(optionNames()).toEqual(['Unassigned', 'Carol']);
  });

  it('explains when nobody qualifies', () => {
    renderWithProviders(
      <AssigneeSelect
        task={makeTask({ skills: [{ id: 'skill-x', name: 'Rust' }] })}
        developers={developers}
        onFeedback={vi.fn()}
      />,
    );
    expect(optionNames()).toEqual(['Unassigned']);
    expect(
      screen.getByRole('combobox', { name: /assignee for/i }),
    ).toHaveAccessibleDescription('No developer has all required skills.');
  });

  it('shows the current assignee as selected', () => {
    renderWithProviders(
      <AssigneeSelect
        task={makeTask({ assignee: { id: 'dev-carol', name: 'Carol' } })}
        developers={developers}
        onFeedback={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: /assignee for/i })).toHaveValue(
      'dev-carol',
    );
  });
});
