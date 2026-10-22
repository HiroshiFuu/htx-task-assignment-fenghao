import type { Developer, TaskNode } from '../../../api/types';
import type { Feedback } from '../../../components/LiveRegion';
import { AssigneeSelect } from './AssigneeSelect';
import { SkillBadges } from './SkillBadges';
import { StatusSelect } from './StatusSelect';

// Below md each row becomes a card: cells stack and show their column name via
// data-label, so there is a single DOM (no duplicated controls) at every width.
const cellClass =
  'flex items-center justify-between gap-4 px-4 py-2 md:table-cell md:py-3 md:align-middle before:text-sm before:font-medium before:text-slate-500 before:content-[attr(data-label)] md:before:content-none';

interface TaskTableProps {
  tasks: readonly TaskNode[];
  developers: readonly Developer[];
  onFeedback: (feedback: Feedback) => void;
}

export function TaskTable({ tasks, developers, onFeedback }: TaskTableProps) {
  return (
    <table className="block w-full md:table md:overflow-hidden md:rounded-lg md:bg-white md:shadow-sm md:ring-1 md:ring-slate-200">
      <caption className="sr-only">Tasks</caption>
      <thead className="sr-only md:not-sr-only md:bg-slate-100">
        <tr className="text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
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
      <tbody className="block space-y-3 md:table-row-group md:space-y-0 md:divide-y md:divide-slate-200">
        {tasks.map((task) => (
          <tr
            key={task.id}
            className="block rounded-lg bg-white py-2 shadow-sm ring-1 ring-slate-200 md:table-row md:rounded-none md:py-0 md:shadow-none md:ring-0"
          >
            <td data-label="Title" className={cellClass}>
              <span className="text-right font-medium break-words md:text-left">
                {task.title}
              </span>
            </td>
            <td data-label="Skills" className={cellClass}>
              <SkillBadges task={task} />
            </td>
            <td data-label="Status" className={cellClass}>
              <StatusSelect task={task} onFeedback={onFeedback} />
            </td>
            <td data-label="Assignee" className={cellClass}>
              <AssigneeSelect
                task={task}
                developers={developers}
                onFeedback={onFeedback}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
