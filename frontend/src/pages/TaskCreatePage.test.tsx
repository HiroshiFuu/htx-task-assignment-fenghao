import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BACKEND, FRONTEND, makeTask, skills } from '../test/fixtures';
import {
  jsonResponse,
  mockFetch,
  problem,
  renderWithProviders,
  type MockHandler,
} from '../test/utils';
import TaskCreatePage from './TaskCreatePage';

function ListStub() {
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  return <p>List page: {flash}</p>;
}

function renderPage(handler: MockHandler) {
  const mock = mockFetch((request) =>
    request.path === '/api/skills' ? jsonResponse(skills) : handler(request),
  );
  renderWithProviders(<TaskCreatePage />, {
    path: '/tasks/new',
    otherRoutes: { '/': <ListStub /> },
  });
  return mock;
}

const title = (label: string) =>
  screen.findByRole('textbox', { name: `Title for task ${label}` });

describe('TaskCreatePage', () => {
  it('blocks submitting a blank title and focuses the field', async () => {
    const { requests } = renderPage(() => undefined);
    const user = userEvent.setup();

    await user.type(await title('1'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save task' }));

    const input = await title('1');
    expect(input).toHaveAccessibleDescription('Enter a title.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveFocus();
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  });

  it('builds the wireframe tree (1 / 1.1 / 1.1.1 / 1.1.2) and saves it in one request', async () => {
    const { requests } = renderPage(({ method }) =>
      method === 'POST'
        ? jsonResponse(makeTask({ title: 'Profile' }), 201)
        : undefined,
    );
    const user = userEvent.setup();

    await user.type(await title('1'), '  Profile  ');
    await user.click(screen.getByRole('checkbox', { name: 'Frontend' }));
    await user.click(
      screen.getByRole('button', { name: 'Add subtask to task 1' }),
    );
    // The new subtask's title takes focus, so typing goes straight into it.
    expect(await title('1.1')).toHaveFocus();
    await user.keyboard('API');
    await user.click(
      screen.getByRole('button', { name: 'Add subtask to task 1.1' }),
    );
    await user.keyboard('Upload');
    await user.click(
      screen.getByRole('button', { name: 'Add subtask to task 1.1' }),
    );
    await user.keyboard('Validate');
    const backendForLeaf = screen.getAllByRole('checkbox', {
      name: 'Backend',
    })[3];
    await user.click(backendForLeaf);

    await user.click(screen.getByRole('button', { name: 'Save 4 tasks' }));

    expect(
      await screen.findByText('List page: Created "Profile".'),
    ).toBeInTheDocument();
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({
      title: 'Profile',
      skillIds: [FRONTEND.id],
      subtasks: [
        {
          title: 'API',
          subtasks: [
            { title: 'Upload' },
            { title: 'Validate', skillIds: [BACKEND.id] },
          ],
        },
      ],
    });
  });

  it('removes a subtask and renumbers the rest', async () => {
    renderPage(() => undefined);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Add subtask to task 1' }),
    );
    await user.keyboard('First');
    await user.click(
      screen.getByRole('button', { name: 'Add subtask to task 1' }),
    );
    await user.keyboard('Second');

    await user.click(screen.getByRole('button', { name: 'Remove task 1.1' }));

    expect(await title('1.1')).toHaveValue('Second');
    expect(
      screen.queryByRole('textbox', { name: 'Title for task 1.2' }),
    ).not.toBeInTheDocument();
  });

  it('focuses the first invalid subtask title', async () => {
    const { requests } = renderPage(() => undefined);
    const user = userEvent.setup();
    await user.type(await title('1'), 'Root');
    await user.click(
      screen.getByRole('button', { name: 'Add subtask to task 1' }),
    );

    await user.click(screen.getByRole('button', { name: 'Save 2 tasks' }));

    expect(await title('1.1')).toHaveFocus();
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  });

  it('shows a nested server field error next to that subtask', async () => {
    renderPage(({ method }) =>
      method === 'POST'
        ? problem(400, 'Request validation failed.', {
            code: 'VALIDATION_FAILED',
            errors: [
              { field: 'subtasks.0.title', messages: ['title is too long'] },
            ],
          })
        : undefined,
    );
    const user = userEvent.setup();
    await user.type(await title('1'), 'Root');
    await user.click(
      screen.getByRole('button', { name: 'Add subtask to task 1' }),
    );
    await user.keyboard('Child');
    await user.click(screen.getByRole('button', { name: 'Save 2 tasks' }));

    const child = await title('1.1');
    expect(await screen.findByText('title is too long')).toBeInTheDocument();
    expect(child).toHaveAttribute('aria-invalid', 'true');
    expect(await title('1')).not.toHaveAttribute('aria-invalid');
  });

  it('announces other server errors in the live region', async () => {
    renderPage(({ method }) =>
      method === 'POST'
        ? problem(429, 'ThrottlerException: Too Many Requests')
        : undefined,
    );
    const user = userEvent.setup();
    await user.type(await title('1'), 'Homepage');
    await user.click(screen.getByRole('button', { name: 'Save task' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Could not create the task: Too many requests. Please wait a moment and try again.',
    );
  });
});
