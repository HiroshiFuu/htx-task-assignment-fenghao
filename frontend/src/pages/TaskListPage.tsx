import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../api/client';
import { LiveRegion, type Feedback } from '../components/LiveRegion';
import { primaryButtonClass, secondaryButtonClass } from '../components/styles';
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
  const [feedback, setFeedback] = useState<Feedback | null>(() =>
    flashFrom(location.state),
  );

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
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-slate-600">No tasks yet.</p>
          <Link
            to="/tasks/new"
            className="mt-2 inline-block font-medium text-indigo-700 underline"
          >
            Create the first task
          </Link>
        </div>
      );
    }
    return (
      <TaskTable
        tasks={taskList}
        developers={developerList}
        onFeedback={setFeedback}
      />
    );
  };

  return (
    <section aria-labelledby="tasks-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="tasks-heading" className="text-2xl font-semibold">
          Tasks
        </h1>
        <Link to="/tasks/new" className={primaryButtonClass}>
          New task
        </Link>
      </div>

      <LiveRegion feedback={feedback} />

      {renderContent()}
    </section>
  );
}
