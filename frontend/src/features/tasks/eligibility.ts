import type { Developer, SkillSummary } from '../../api/types';

/**
 * Decision D3: a developer qualifies when their skills cover every skill the task
 * requires. This only filters the UI; the backend enforces the same rule.
 */
export function isEligible(
  developer: Pick<Developer, 'skills'>,
  taskSkills: readonly SkillSummary[],
): boolean {
  const owned = new Set(developer.skills.map((skill) => skill.id));
  return taskSkills.every((skill) => owned.has(skill.id));
}

export function eligibleDevelopers<D extends Pick<Developer, 'skills'>>(
  developers: readonly D[],
  taskSkills: readonly SkillSummary[],
): D[] {
  return developers.filter((developer) => isEligible(developer, taskSkills));
}
