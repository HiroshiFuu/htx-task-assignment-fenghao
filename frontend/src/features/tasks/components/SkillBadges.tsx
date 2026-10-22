import type { TaskNode } from '../../../api/types';

export function SkillBadges({ task }: { task: TaskNode }) {
  if (task.skills.length === 0) {
    return <span className="text-sm text-slate-400">None</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1 md:justify-start">
      <ul className="flex flex-wrap gap-1" aria-label="Skills">
        {task.skills.map((skill) => (
          <li
            key={skill.id}
            className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 ring-inset"
          >
            {skill.name}
          </li>
        ))}
      </ul>
      {task.skillSource !== 'USER' && (
        <abbr
          title="Skills detected automatically"
          className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 no-underline"
        >
          AI
        </abbr>
      )}
    </span>
  );
}
