import { useReducer, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, errorMessage } from '../api/client';
import { LiveRegion, type Feedback } from '../components/LiveRegion';
import { primaryButtonClass, secondaryButtonClass } from '../components/styles';
import { TaskNodeEditor } from '../features/tasks/components/TaskNodeEditor';
import { useCreateTask, useSkills } from '../features/tasks/queries';
import {
  countNodes,
  draftReducer,
  initialDraftState,
  MAX_DEPTH,
  MAX_NODES,
  titleInputId,
  toCreateTaskInput,
  validateDraft,
} from '../features/tasks/task-draft';

const focusTitle = (key: string) => {
  document.getElementById(titleInputId(key))?.focus();
};

export default function TaskCreatePage() {
  const [state, dispatch] = useReducer(draftReducer, undefined, () =>
    initialDraftState(crypto.randomUUID()),
  );
  const skills = useSkills();
  const createTask = useCreateTask();
  const navigate = useNavigate();

  const clientErrors = validateDraft(state.root);
  const total = countNodes(state.root);

  // Field-level server errors are shown next to their field instead.
  const isFieldError =
    createTask.error instanceof ApiError &&
    createTask.error.fieldErrors.length > 0;
  const feedback: Feedback | null = state.treeError
    ? { kind: 'error', message: state.treeError }
    : createTask.error && !isFieldError
      ? {
          kind: 'error',
          message: `Could not create the task: ${errorMessage(createTask.error)}`,
        }
      : null;

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch({ type: 'SUBMIT_ATTEMPTED' });
    const [firstInvalid] = clientErrors.keys();
    if (firstInvalid) {
      focusTitle(firstInvalid);
      return;
    }
    createTask.mutate(toCreateTaskInput(state.root), {
      onSuccess: (task) => {
        void navigate('/', { state: { flash: `Created "${task.title}".` } });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.fieldErrors.length > 0) {
          dispatch({ type: 'SERVER_FIELD_ERRORS', errors: error.fieldErrors });
        }
      },
    });
  };

  return (
    <section aria-labelledby="create-heading" className="max-w-3xl space-y-4">
      <div className="space-y-1">
        <h1 id="create-heading" className="text-2xl font-semibold">
          New task
        </h1>
        <p className="text-sm text-slate-600">
          Add subtasks to break the work down (up to {MAX_DEPTH} levels and{' '}
          {MAX_NODES} tasks). Only developers with all of a task&rsquo;s skills
          can be assigned to it.
        </p>
      </div>

      <LiveRegion feedback={feedback} />

      <form
        noValidate
        onSubmit={handleSubmit}
        className="space-y-6 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6"
      >
        {skills.isError ? (
          <p className="text-sm text-red-700">
            Could not load skills: {errorMessage(skills.error)}
          </p>
        ) : skills.isPending ? (
          <p className="text-sm text-slate-500">Loading skills…</p>
        ) : (
          <TaskNodeEditor
            node={state.root}
            path={[]}
            state={state}
            clientErrors={clientErrors}
            skills={skills.data}
            dispatch={dispatch}
          />
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
          <button
            type="submit"
            disabled={createTask.isPending || skills.isPending}
            className={primaryButtonClass}
          >
            {createTask.isPending
              ? 'Saving…'
              : total > 1
                ? `Save ${String(total)} tasks`
                : 'Save task'}
          </button>
          <Link to="/" className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
