import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { TaskNode } from '../api/types';
import { developers, makeTask } from '../test/fixtures';
import {
  deferred,
  jsonResponse,
  mockFetch,
  problem,
  renderWithProviders,
} from '../test/utils';
import TaskListPage from './TaskListPage';

const TITLE = 'Build the landing page';

function serveList(tasks: TaskNode[]) {
  return ({ method, path }: { method: string; path: string }) => {
    if (method === 'GET' && path === '/api/tasks') return jsonResponse(tasks);
    if (method === 'GET' && path === '/api/developers')
      return jsonResponse(developers);
    return undefined;
  };
}

describe('TaskListPage', () => {
  it('shows tasks in a table with title, skills, status and assignee', async () => {
    mockFetch(serveList([makeTask()]));
    renderWithProviders(<TaskListPage />);

    const table = await screen.findByRole('table', { name: 'Tasks' });
    expect(table).toHaveTextContent(TITLE);
    expect(table).toHaveTextContent('Frontend');
    expect(
      screen.getByRole('combobox', { name: `Status for ${TITLE}` }),
    ).toHaveValue('TODO');
    expect(
      screen.getByRole('combobox', { name: `Assignee for ${TITLE}` }),
    ).toHaveValue('');
  });

  it('shows an empty state with a link to create a task', async () => {
    mockFetch(serveList([]));
    renderWithProviders(<TaskListPage />);
    expect(await screen.findByText('No tasks yet.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Create the first task' }),
    ).toHaveAttribute('href', '/tasks/new');
  });

  it('shows a load error with a retry button', async () => {
    mockFetch(({ path }) =>
      path === '/api/tasks'
        ? problem(503, 'Database is unavailable.')
        : jsonResponse(developers),
    );
    renderWithProviders(<TaskListPage />);
    expect(
      await screen.findByText('Could not load tasks: Database is unavailable.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });

  it('changes status optimistically and rolls back with the server reason on failure', async () => {
    const patch = deferred<Response>();
    const list = serveList([makeTask()]);
    mockFetch((request) =>
      request.method === 'PATCH' ? patch.promise : list(request),
    );
    const user = userEvent.setup();
    renderWithProviders(<TaskListPage />);

    const status = await screen.findByRole('combobox', {
      name: `Status for ${TITLE}`,
    });
    await user.selectOptions(status, 'DONE');
    // Optimistic: the new value shows before the server answers.
    expect(status).toHaveValue('DONE');

    patch.resolve(
      problem(422, 'Not all subtasks are done.', { code: 'SUBTASKS_NOT_DONE' }),
    );

    await waitFor(() => {
      expect(status).toHaveValue('TODO');
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      `Could not change the status of "${TITLE}": Not all subtasks are done.`,
    );
  });

  it('assigns a developer and announces success', async () => {
    let task = makeTask();
    const { requests } = mockFetch((request) => {
      if (
        request.method === 'PATCH' &&
        request.path === '/api/tasks/task-1/assignee'
      ) {
        task = { ...task, assignee: { id: 'dev-alice', name: 'Alice' } };
        return jsonResponse(task);
      }
      return serveList([task])(request);
    });
    const user = userEvent.setup();
    renderWithProviders(<TaskListPage />);

    const assignee = await screen.findByRole('combobox', {
      name: `Assignee for ${TITLE}`,
    });
    await user.selectOptions(assignee, 'dev-alice');

    expect(
      await screen.findByText(`Assigned "${TITLE}" to Alice.`),
    ).toBeInTheDocument();
    expect(assignee).toHaveValue('dev-alice');
    expect(requests).toContainEqual({
      method: 'PATCH',
      path: '/api/tasks/task-1/assignee',
      body: { developerId: 'dev-alice' },
    });
  });

  it('rolls back an assignment the server rejects', async () => {
    const list = serveList([makeTask()]);
    mockFetch((request) =>
      request.method === 'PATCH'
        ? problem(422, 'Alice lacks the required skill(s): Backend.', {
            code: 'SKILL_MISMATCH',
          })
        : list(request),
    );
    const user = userEvent.setup();
    renderWithProviders(<TaskListPage />);

    const assignee = await screen.findByRole('combobox', {
      name: `Assignee for ${TITLE}`,
    });
    await user.selectOptions(assignee, 'dev-alice');

    expect(
      await screen.findByText(
        `Could not change the assignee of "${TITLE}": Alice lacks the required skill(s): Backend.`,
      ),
    ).toBeInTheDocument();
    expect(assignee).toHaveValue('');
  });
});
