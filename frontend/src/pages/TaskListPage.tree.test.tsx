import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { TaskNode, TaskStatus } from '../api/types';
import { developers, makeTask } from '../test/fixtures';
import {
  jsonResponse,
  mockFetch,
  problem,
  renderWithProviders,
  type MockRequest,
} from '../test/utils';
import TaskListPage from './TaskListPage';

/** Wireframe 3: 1 / 1.1 / 1.1.1 / 1.1.2 with chosen statuses. */
function tree(statuses: {
  root: TaskStatus;
  child: TaskStatus;
  leafA: TaskStatus;
  leafB: TaskStatus;
}): TaskNode {
  const leafA = makeTask({
    id: 'leaf-a',
    title: 'Upload',
    parentId: 'child',
    status: statuses.leafA,
  });
  const leafB = makeTask({
    id: 'leaf-b',
    title: 'Validate',
    parentId: 'child',
    status: statuses.leafB,
  });
  const child = makeTask({
    id: 'child',
    title: 'API',
    parentId: 'root',
    status: statuses.child,
    subtasks: [leafA, leafB],
  });
  return makeTask({
    id: 'root',
    title: 'Profile',
    status: statuses.root,
    subtasks: [child],
  });
}

const ALL_DONE = {
  root: 'DONE',
  child: 'DONE',
  leafA: 'DONE',
  leafB: 'DONE',
} as const;

function serve(
  tasks: () => TaskNode[],
  onPatch: (request: MockRequest) => Response | undefined = () => undefined,
) {
  return mockFetch((request) => {
    if (request.method === 'PATCH') return onPatch(request);
    if (request.path === '/api/tasks') return jsonResponse(tasks());
    if (request.path === '/api/developers') return jsonResponse(developers);
    return undefined;
  });
}

const statusOf = (title: string) =>
  screen.findByRole('combobox', { name: `Status for ${title}` });

describe('TaskListPage tree', () => {
  it('lists subtasks under their parent in order, and collapses them', async () => {
    serve(() => [
      tree({ root: 'TODO', child: 'TODO', leafA: 'TODO', leafB: 'TODO' }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<TaskListPage />);

    const table = await screen.findByRole('table', { name: 'Tasks' });
    const titles = () =>
      within(table)
        .getAllByRole('row')
        .slice(1)
        // Strip the decorative (aria-hidden) tree glyphs.
        .map((row) =>
          within(row).getAllByRole('cell')[0].textContent.replace(/[▾▸└]/g, ''),
        );
    expect(titles()).toEqual(['Profile', 'API', 'Upload', 'Validate']);

    const toggle = screen.getByRole('button', {
      name: 'Collapse subtasks of API',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(titles()).toEqual(['Profile', 'API']);
    expect(
      screen.getByRole('button', { name: 'Expand subtasks of API' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('disables Done while a subtask at any depth is open', async () => {
    serve(() => [
      tree({ root: 'TODO', child: 'DONE', leafA: 'DONE', leafB: 'TODO' }),
    ]);
    renderWithProviders(<TaskListPage />);

    const rootStatus = await statusOf('Profile');
    expect(
      within(rootStatus).getByRole('option', { name: 'Done' }),
    ).toBeDisabled();
    expect(rootStatus).toHaveAccessibleDescription(
      'Done is unavailable until all subtasks are done or cancelled.',
    );
    expect(
      within(await statusOf('Upload')).getByRole('option', { name: 'Done' }),
    ).toBeEnabled();
  });

  it('enables Done on a parent whose subtasks are Done or Cancelled, and strikes through Cancelled', async () => {
    serve(() => [
      tree({ root: 'TODO', child: 'TODO', leafA: 'DONE', leafB: 'CANCELLED' }),
    ]);
    renderWithProviders(<TaskListPage />);

    const childStatus = await statusOf('API');
    expect(
      within(childStatus).getByRole('option', { name: 'Done' }),
    ).toBeEnabled();
    expect(
      within(childStatus).getByRole('option', { name: 'Cancelled' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Validate')).toHaveClass('line-through');
    expect(screen.getByText('Upload')).not.toHaveClass('line-through');
  });

  it('asks before reopening a Cancelled subtask of a Done parent', async () => {
    const { requests } = serve(() => [
      tree({ root: 'TODO', child: 'DONE', leafA: 'DONE', leafB: 'CANCELLED' }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<TaskListPage />);

    await user.selectOptions(await statusOf('Validate'), 'IN_PROGRESS');

    const dialog = await screen.findByRole('dialog', {
      name: 'Reopen parent tasks?',
    });
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['API']);
    expect(requests.filter((r) => r.method === 'PATCH')).toHaveLength(0);
  });

  it('moves a Done subtask to Cancelled without asking (it stays closed)', async () => {
    const { requests } = serve(
      () => [tree(ALL_DONE)],
      () => jsonResponse({ task: makeTask(), cascadedTaskIds: [] }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TaskListPage />);

    await user.selectOptions(await statusOf('Upload'), 'CANCELLED');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(requests.filter((r) => r.method === 'PATCH')).toEqual([
        {
          method: 'PATCH',
          path: '/api/tasks/leaf-a/status',
          body: { status: 'CANCELLED' },
        },
      ]);
    });
  });

  it('asks before reopening a subtask of Done parents, and Cancel changes nothing', async () => {
    const { requests } = serve(() => [tree(ALL_DONE)]);
    const user = userEvent.setup();
    renderWithProviders(<TaskListPage />);

    const leaf = await statusOf('Upload');
    await user.selectOptions(leaf, 'TODO');

    const dialog = await screen.findByRole('dialog', {
      name: 'Reopen parent tasks?',
    });
    expect(dialog).toHaveTextContent(
      'Changing “Upload” to To-do will move these 2 completed parent tasks back to In Progress:',
    );
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['API', 'Profile']);
    // Safe default.
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toHaveFocus();
    // Not optimistic: nothing changes while the dialog is open.
    expect(leaf).toHaveValue('DONE');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(leaf).toHaveValue('DONE');
    // Focus returns to where the user started.
    expect(leaf).toHaveFocus();
    expect(requests.filter((r) => r.method === 'PATCH')).toHaveLength(0);
  });

  it('confirming sends confirmCascade and refreshes the whole tree', async () => {
    let current = tree(ALL_DONE);
    const { requests } = serve(
      () => [current],
      () => {
        current = tree({
          root: 'IN_PROGRESS',
          child: 'IN_PROGRESS',
          leafA: 'TODO',
          leafB: 'DONE',
        });
        return jsonResponse({
          task: current.subtasks[0].subtasks[0],
          cascadedTaskIds: ['child', 'root'],
        });
      },
    );
    const user = userEvent.setup();
    renderWithProviders(<TaskListPage />);

    await user.selectOptions(await statusOf('Upload'), 'TODO');
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Confirm and roll back',
      }),
    );

    expect(
      await screen.findByText('"Upload" is now To-do; updated 3 tasks.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(requests.filter((r) => r.method === 'PATCH')).toEqual([
      {
        method: 'PATCH',
        path: '/api/tasks/leaf-a/status',
        body: { status: 'TODO', confirmCascade: true },
      },
    ]);
    await waitFor(async () => {
      expect(await statusOf('Profile')).toHaveValue('IN_PROGRESS');
    });
    expect(await statusOf('API')).toHaveValue('IN_PROGRESS');
    expect(await statusOf('Upload')).toHaveValue('TODO');
  });

  it('opens the dialog from a 409 when the cached tree was stale', async () => {
    // Cache says the parent is not Done, so no dialog is predicted…
    serve(
      () => [
        tree({
          root: 'IN_PROGRESS',
          child: 'IN_PROGRESS',
          leafA: 'DONE',
          leafB: 'DONE',
        }),
      ],
      // …but meanwhile someone completed the parents.
      () =>
        problem(
          409,
          'Reopening "Upload" will move 2 completed parent task(s) back to In Progress.',
          {
            code: 'CASCADE_CONFIRMATION_REQUIRED',
            affectedTasks: [
              { id: 'child', title: 'API', status: 'DONE' },
              { id: 'root', title: 'Profile', status: 'DONE' },
            ],
          },
        ),
    );
    const user = userEvent.setup();
    renderWithProviders(<TaskListPage />);

    const leaf = await statusOf('Upload');
    await user.selectOptions(leaf, 'TODO');

    const dialog = await screen.findByRole('dialog', {
      name: 'Reopen parent tasks?',
    });
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['API', 'Profile']);
    // The optimistic change was rolled back.
    expect(leaf).toHaveValue('DONE');
  });
});
