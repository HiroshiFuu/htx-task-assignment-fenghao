import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { FRONTEND, makeTask, skills } from '../test/fixtures';
import {
  jsonResponse,
  mockFetch,
  problem,
  renderWithProviders,
} from '../test/utils';
import TaskCreatePage from './TaskCreatePage';

function ListStub() {
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  return <p>List page: {flash}</p>;
}

function renderPage() {
  renderWithProviders(<TaskCreatePage />, {
    path: '/tasks/new',
    otherRoutes: { '/': <ListStub /> },
  });
}

describe('TaskCreatePage', () => {
  it('blocks submitting a blank title and focuses the field', async () => {
    const { requests } = mockFetch(({ path }) =>
      path === '/api/skills' ? jsonResponse(skills) : undefined,
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox', { name: /title/i }), '   ');
    await user.click(screen.getByRole('button', { name: 'Save task' }));

    const title = screen.getByRole('textbox', { name: /title/i });
    expect(title).toHaveAccessibleDescription('Enter a title.');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveFocus();
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  });

  it('creates a task with the trimmed title and chosen skills, then returns to the list', async () => {
    const { requests } = mockFetch(({ method, path }) => {
      if (path === '/api/skills') return jsonResponse(skills);
      if (method === 'POST' && path === '/api/tasks') {
        return jsonResponse(makeTask({ title: 'Homepage' }), 201);
      }
      return undefined;
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByRole('textbox', { name: /title/i }),
      '  Homepage  ',
    );
    await user.click(await screen.findByRole('checkbox', { name: 'Frontend' }));
    await user.click(screen.getByRole('button', { name: 'Save task' }));

    expect(
      await screen.findByText('List page: Created "Homepage".'),
    ).toBeInTheDocument();
    expect(requests).toContainEqual({
      method: 'POST',
      path: '/api/tasks',
      body: { title: 'Homepage', skillIds: [FRONTEND.id] },
    });
  });

  it('shows server field errors next to the field', async () => {
    mockFetch(({ method, path }) => {
      if (path === '/api/skills') return jsonResponse(skills);
      if (method === 'POST') {
        return problem(400, 'Request validation failed.', {
          code: 'VALIDATION_FAILED',
          errors: [
            {
              field: 'title',
              messages: ['title must not contain control characters'],
            },
          ],
        });
      }
      return undefined;
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByRole('textbox', { name: /title/i }),
      'Homepage',
    );
    await user.click(screen.getByRole('button', { name: 'Save task' }));

    expect(
      await screen.findByText('title must not contain control characters'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /title/i })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('announces other server errors in the live region', async () => {
    mockFetch(({ method, path }) => {
      if (path === '/api/skills') return jsonResponse(skills);
      if (method === 'POST')
        return problem(429, 'ThrottlerException: Too Many Requests');
      return undefined;
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByRole('textbox', { name: /title/i }),
      'Homepage',
    );
    await user.click(screen.getByRole('button', { name: 'Save task' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Could not create the task: Too many requests. Please wait a moment and try again.',
    );
  });
});
