import { useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../api/client';
import { PlusIcon } from '../components/icons';
import type { Feedback } from '../components/LiveRegion';
import { primaryButtonClass, secondaryButtonClass } from '../components/styles';
import { Toaster } from '../components/Toaster';
import { useToasts } from '../components/use-toasts';
import { StatusSummary } from '../features/tasks/components/StatusSummary';
import { TaskTable } from '../features/tasks/components/TaskTable';
import { useDevelopers, useTasks } from '../features/tasks/queries';

/** The create page passes a confirmation message through router state. */
function flashFrom(state: unknown): Feedback | null {
  if (typeof state === 'object' && state !== null && 'flash' in state) {
    const { flash } = state;
    if (typeof flash === 'string') {
      return { kind: 'success', message: flash };
    }
  }
  return null;
}

export default function TaskListPage() {
  const location = useLocation();
  const tasks = useTasks();
  const developers = useDevelopers();
  const navigate = useNavigate();
  const { toasts, push, dismiss } = useToasts(flashFrom(location.state));

  // Show the flash once: drop it from history so reload/back doesn't repeat it.
  useEffect(() => {
    if (location.state !== null) {
      void navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const renderContent = (): ReactNode => {
    const taskList = tasks.data;
    const developerList = developers.data;
    // A failed background refetch keeps showing the cached list; only a first
    // load without data shows the error state.
    if (!taskList || !developerList) {
      const loadError = tasks.error ?? developers.error;
      if (!loadError) {
        return <p className="text-slate-500">Loading tasks…</p>;
      }
      return (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p>Could not load tasks: {errorMessage(loadError)}</p>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              void tasks.refetch();
              void developers.refetch();
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    if (taskList.length === 0) {
      return (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-medium text-slate-700">No tasks yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Break the work into tasks and subtasks, then assign developers.
          </p>
          <Link
            to="/tasks/new"
            className={`${primaryButtonClass} mt-4 gap-1.5`}
          >
            <PlusIcon />
            Create the first task
          </Link>
        </div>
      );
    }
    return (
      <>
        <StatusSummary tasks={taskList} />
        <TaskTable
          tasks={taskList}
          developers={developerList}
          onFeedback={push}
        />
      </>
    );
  };

  return (
    <section aria-labelledby="tasks-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            id="tasks-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Tasks
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Change a status or assignee right in the list.
          </p>
        </div>
        <Link to="/tasks/new" className={`${primaryButtonClass} gap-1.5`}>
          <PlusIcon />
          New task
        </Link>
      </div>

      {renderContent()}

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}
