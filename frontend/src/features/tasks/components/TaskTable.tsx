import { useState } from 'react';
import type { Developer, TaskNode } from '../../../api/types';
import { ChevronIcon } from '../../../components/icons';
import type { Feedback } from '../../../components/LiveRegion';
import { visibleRows } from '../tree';
import { AssigneeSelect } from './AssigneeSelect';
import { SkillBadges } from './SkillBadges';
import { StatusSelect } from './StatusSelect';

// Below md each row becomes a card: cells stack and show their column name via
// data-label, so there is a single DOM (no duplicated controls) at every width.
const cellClass =
  'flex items-center justify-between gap-4 px-4 py-2 md:table-cell md:py-3 md:align-middle before:text-sm before:font-medium before:text-slate-500 before:content-[attr(data-label)] md:before:content-none';

// Static class lists (Tailwind needs literal names); depth is capped at 5 levels.
const CARD_INDENT = ['', 'ml-4', 'ml-8', 'ml-12', 'ml-16'];
const TITLE_INDENT = ['', 'md:pl-6', 'md:pl-12', 'md:pl-18', 'md:pl-24'];
const indent = (classes: readonly string[], depth: number) =>
  classes[Math.min(depth, classes.length - 1)];

interface TaskTableProps {
  tasks: readonly TaskNode[];
  developers: readonly Developer[];
  onFeedback: (feedback: Feedback) => void;
}

export function TaskTable({ tasks, developers, onFeedback }: TaskTableProps) {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggle = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  return (
    <table className="block w-full md:table md:overflow-hidden md:rounded-xl md:bg-white md:shadow-sm md:ring-1 md:ring-slate-200">
      <caption className="sr-only">Tasks</caption>
      <thead className="sr-only md:not-sr-only md:border-b md:border-slate-200 md:bg-slate-50">
        <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <th scope="col" className="px-4 py-3">
            Title
          </th>
          <th scope="col" className="px-4 py-3">
            Skills
          </th>
          <th scope="col" className="px-4 py-3">
            Status
          </th>
          <th scope="col" className="px-4 py-3">
            Assignee
          </th>
        </tr>
      </thead>
      <tbody className="block space-y-3 md:table-row-group md:space-y-0 md:divide-y md:divide-slate-100">
        {visibleRows(tasks, collapsedIds).map(
          ({ task, depth, ancestors, hasSubtasks, collapsed }) => (
            <tr
              key={task.id}
              className={`block rounded-xl bg-white py-2 shadow-sm ring-1 ring-slate-200 transition-colors md:ml-0 md:table-row md:rounded-none md:py-0 md:shadow-none md:ring-0 md:hover:bg-indigo-50/40 ${indent(CARD_INDENT, depth)} ${depth > 0 ? 'md:bg-slate-50/60' : ''}`}
            >
              <td data-label="Title" className={cellClass}>
                <span
                  className={`flex items-start gap-1 text-right md:text-left ${indent(TITLE_INDENT, depth)}`}
                >
                  {hasSubtasks ? (
                    <button
                      type="button"
                      onClick={() => {
                        toggle(task.id);
                      }}
                      aria-expanded={!collapsed}
                      aria-label={`${collapsed ? 'Expand' : 'Collapse'} subtasks of ${task.title}`}
                      className="-my-0.5 shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      <ChevronIcon
                        className={`size-4 transition-transform motion-reduce:transition-none ${collapsed ? '' : 'rotate-90'}`}
                      />
                    </button>
                  ) : (
                    depth > 0 && (
                      <span
                        aria-hidden="true"
                        className="w-5 shrink-0 text-slate-300"
                      >
                        └
                      </span>
                    )
                  )}
                  <span
                    // The status select still says "Cancelled" for screen readers.
                    className={`break-words ${depth === 0 ? 'font-medium' : ''} ${task.status === 'CANCELLED' ? 'text-slate-400 line-through' : ''}`}
                  >
                    {task.title}
                  </span>
                </span>
              </td>
              <td data-label="Skills" className={cellClass}>
                <SkillBadges task={task} />
              </td>
              <td data-label="Status" className={cellClass}>
                <StatusSelect
                  task={task}
                  ancestors={ancestors}
                  onFeedback={onFeedback}
                />
              </td>
              <td data-label="Assignee" className={cellClass}>
                <AssigneeSelect
                  task={task}
                  developers={developers}
                  onFeedback={onFeedback}
                />
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}
