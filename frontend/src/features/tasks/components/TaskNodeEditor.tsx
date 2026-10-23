import type { Dispatch } from 'react';
import type { Skill } from '../../../api/types';
import { PlusIcon } from '../../../components/icons';
import { secondaryButtonClass } from '../../../components/styles';
import {
  canAddSubtask,
  nodeLabel,
  TITLE_MAX_LENGTH,
  titleInputId,
  type DraftAction,
  type DraftNode,
  type DraftState,
  type NodePath,
} from '../task-draft';

interface TaskNodeEditorProps {
  node: DraftNode;
  path: NodePath;
  state: DraftState;
  clientErrors: ReadonlyMap<string, string>;
  skills: readonly Skill[];
  dispatch: Dispatch<DraftAction>;
}

/**
 * Composite: edits one task and renders itself for each subtask, so the form has
 * the same shape as the tree it submits.
 */
export function TaskNodeEditor({
  node,
  path,
  state,
  clientErrors,
  skills,
  dispatch,
}: TaskNodeEditorProps) {
  const label = nodeLabel(path);
  const isRoot = path.length === 0;
  const titleId = titleInputId(node.key);
  const titleErrorId = `${titleId}-error`;
  const skillsErrorId = `${titleId}-skills-error`;
  const serverError = state.serverErrors[node.key];
  const titleError =
    serverError?.title ??
    (state.submitAttempted ? clientErrors.get(node.key) : undefined);
  const addable = canAddSubtask(state.root, path);

  return (
    <div
      role="group"
      aria-labelledby={`${titleId}-heading`}
      className={
        isRoot
          ? 'space-y-4'
          : 'space-y-4 rounded-lg border border-slate-200 border-l-4 border-l-indigo-300 bg-slate-50/70 p-3 sm:p-4'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id={`${titleId}-heading`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"
        >
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-700 tabular-nums">
            <span className="sr-only">Task </span>
            {label}
          </span>
          <span aria-hidden="true">{isRoot ? 'Task' : 'Subtask'}</span>
        </h2>
        {!isRoot && (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'REMOVE_NODE', path });
            }}
            className="rounded px-2 py-1 text-sm text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
          >
            Remove task {label}
          </button>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor={titleId} className="block text-sm font-medium">
          Title for task {label} <span aria-hidden="true">*</span>
        </label>
        <input
          id={titleId}
          type="text"
          value={node.title}
          maxLength={TITLE_MAX_LENGTH}
          // Only for a subtask the user just added, so keyboard users land in it.
          autoFocus={state.focusKey === node.key}
          aria-required="true"
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? titleErrorId : undefined}
          onChange={(event) => {
            dispatch({ type: 'UPDATE_TITLE', path, title: event.target.value });
          }}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 aria-invalid:border-red-500 aria-invalid:focus-visible:ring-red-500"
        />
        {titleError && (
          <p id={titleErrorId} className="text-sm text-red-700">
            {titleError}
          </p>
        )}
      </div>

      <fieldset
        aria-describedby={serverError?.skillIds ? skillsErrorId : undefined}
        className="space-y-2"
      >
        <legend className="text-sm font-medium">
          Required skills for task {label}{' '}
          <span className="font-normal text-slate-500">
            (optional: leave empty and they are detected automatically from the
            title)
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <label
              key={skill.id}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 transition-colors select-none hover:border-indigo-300 has-checked:border-indigo-400 has-checked:bg-indigo-50 has-checked:text-indigo-800 has-focus-visible:ring-2 has-focus-visible:ring-indigo-500"
            >
              <input
                type="checkbox"
                checked={node.skillIds.includes(skill.id)}
                onChange={() => {
                  dispatch({ type: 'TOGGLE_SKILL', path, skillId: skill.id });
                }}
                className="size-4 rounded border-slate-300 accent-indigo-600 focus-visible:outline-none"
              />
              {skill.name}
            </label>
          ))}
        </div>
        {serverError?.skillIds && (
          <p id={skillsErrorId} className="text-sm text-red-700">
            {serverError.skillIds}
          </p>
        )}
      </fieldset>

      {node.subtasks.length > 0 && (
        <ol aria-label={`Subtasks of task ${label}`} className="space-y-4">
          {node.subtasks.map((child, index) => (
            <li key={child.key}>
              <TaskNodeEditor
                node={child}
                path={[...path, index]}
                state={state}
                clientErrors={clientErrors}
                skills={skills}
                dispatch={dispatch}
              />
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        disabled={!addable}
        onClick={() => {
          dispatch({ type: 'ADD_SUBTASK', path, key: crypto.randomUUID() });
        }}
        className={`${secondaryButtonClass} gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <PlusIcon />
        Add subtask to task {label}
      </button>
    </div>
  );
}
