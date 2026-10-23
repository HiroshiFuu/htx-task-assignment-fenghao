import type { SkillSource, TaskNode } from '../../../api/types';

/** "AI" only when an LLM chose the skills; keyword rules are labelled honestly. */
const INFERRED: Readonly<
  Partial<Record<SkillSource, { label: string; description: string }>>
> = {
  LLM: { label: 'AI', description: 'Skills detected by AI from the title' },
  FALLBACK: {
    label: 'Auto',
    description: 'Skills detected by keyword rules (AI unavailable)',
  },
};

export function SkillBadges({ task }: { task: TaskNode }) {
  if (task.skills.length === 0) {
    return <span className="text-sm text-slate-400">None</span>;
  }
  const inferred = INFERRED[task.skillSource];
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
      {inferred && (
        // title for mouse users; sr-only text because title is not reliably announced.
        <span
          title={inferred.description}
          className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800"
        >
          <span aria-hidden="true">{inferred.label}</span>
          <span className="sr-only">{inferred.description}</span>
        </span>
      )}
    </span>
  );
}
