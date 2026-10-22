import { useId, useReducer, useRef, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, errorMessage } from '../api/client';
import { LiveRegion } from '../components/LiveRegion';
import { primaryButtonClass, secondaryButtonClass } from '../components/styles';
import { useCreateTask, useSkills } from '../features/tasks/queries';
import {
  initialTaskFormState,
  taskFormReducer,
  TITLE_MAX_LENGTH,
  toCreateTaskInput,
  validateTaskForm,
} from '../features/tasks/task-form';

export default function TaskCreatePage() {
  const [state, dispatch] = useReducer(taskFormReducer, initialTaskFormState);
  const skills = useSkills();
  const createTask = useCreateTask();
  const navigate = useNavigate();
  const titleRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const titleErrorId = useId();
  const skillsHintId = useId();
  const skillsErrorId = useId();

  const clientErrors = validateTaskForm(state);
  const titleError =
    state.serverErrors.title ??
    (state.submitAttempted ? clientErrors.title : undefined);
  const skillsError = state.serverErrors.skillIds;

  // Field-level server errors are shown next to their field instead.
  const submitError =
    createTask.error &&
    !(
      createTask.error instanceof ApiError &&
      createTask.error.fieldErrors.length > 0
    )
      ? {
          kind: 'error' as const,
          message: `Could not create the task: ${errorMessage(createTask.error)}`,
        }
      : null;

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch({ type: 'SUBMIT_ATTEMPTED' });
    if (clientErrors.title) {
      titleRef.current?.focus();
      return;
    }
    createTask.mutate(toCreateTaskInput(state), {
      onSuccess: (task) => {
        void navigate('/', { state: { flash: `Created "${task.title}".` } });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.fieldErrors.length > 0) {
          dispatch({ type: 'SERVER_FIELD_ERRORS', errors: error.fieldErrors });
          titleRef.current?.focus();
        }
      },
    });
  };

  return (
    <section aria-labelledby="create-heading" className="max-w-2xl space-y-4">
      <h1 id="create-heading" className="text-2xl font-semibold">
        New task
      </h1>

      <LiveRegion feedback={submitError} />

      <form
        noValidate
        onSubmit={handleSubmit}
        className="space-y-6 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6"
      >
        <div className="space-y-1">
          <label htmlFor={titleId} className="block text-sm font-medium">
            Title <span aria-hidden="true">*</span>
          </label>
          <input
            ref={titleRef}
            id={titleId}
            name="title"
            type="text"
            value={state.title}
            maxLength={TITLE_MAX_LENGTH}
            aria-required="true"
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? titleErrorId : undefined}
            onChange={(event) => {
              dispatch({ type: 'SET_TITLE', title: event.target.value });
            }}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 aria-invalid:border-red-500 aria-invalid:focus-visible:ring-red-500"
          />
          {titleError && (
            <p id={titleErrorId} className="text-sm text-red-700">
              {titleError}
            </p>
          )}
        </div>

        <fieldset
          aria-describedby={
            skillsError ? `${skillsHintId} ${skillsErrorId}` : skillsHintId
          }
          className="space-y-2"
        >
          <legend className="text-sm font-medium">Required skills</legend>
          <p id={skillsHintId} className="text-sm text-slate-500">
            Optional. Only developers with all selected skills can be assigned.
          </p>
          {skills.isPending ? (
            <p className="text-sm text-slate-500">Loading skills…</p>
          ) : skills.isError ? (
            <p className="text-sm text-red-700">
              Could not load skills: {errorMessage(skills.error)}
            </p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {skills.data.map((skill) => (
                <label
                  key={skill.id}
                  className="inline-flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={state.skillIds.includes(skill.id)}
                    onChange={() => {
                      dispatch({ type: 'TOGGLE_SKILL', skillId: skill.id });
                    }}
                    className="size-4 rounded border-slate-300 text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                  {skill.name}
                </label>
              ))}
            </div>
          )}
          {skillsError && (
            <p id={skillsErrorId} className="text-sm text-red-700">
              {skillsError}
            </p>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={createTask.isPending}
            className={primaryButtonClass}
          >
            {createTask.isPending ? 'Saving…' : 'Save task'}
          </button>
          <Link to="/" className={secondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
