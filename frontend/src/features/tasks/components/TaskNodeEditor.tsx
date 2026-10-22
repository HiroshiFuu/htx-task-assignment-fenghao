import type { Dispatch } from 'react';
import type { Skill } from '../../../api/types';
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
          : 'space-y-4 border-l-2 border-indigo-100 pt-2 pl-3 sm:pl-5'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id={`${titleId}-heading`}
          className="text-sm font-semibold text-slate-700"
        >
          Task {label}
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
          className="block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 aria-invalid:border-red-500 aria-invalid:focus-visible:ring-red-500"
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
          <span className="font-normal text-slate-500">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-4">
          {skills.map((skill) => (
            <label
              key={skill.id}
              className="inline-flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={node.skillIds.includes(skill.id)}
                onChange={() => {
                  dispatch({ type: 'TOGGLE_SKILL', path, skillId: skill.id });
                }}
                className="size-4 rounded border-slate-300 text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
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
        className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        Add subtask to task {label}
      </button>
    </div>
  );
}
