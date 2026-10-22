import { AssignmentContext, AssignmentRule } from './assignment-rule';
import { ALLOW, RuleResult } from './rule';

/** Decision D3: the developer's skills must be a superset of the task's skills. */
export class SkillMatchRule implements AssignmentRule {
  evaluate({ task, developer }: AssignmentContext): RuleResult {
    const owned = new Set(developer.skillIds);
    const missingSkills = task.skills.filter((skill) => !owned.has(skill.id));
    if (missingSkills.length === 0) {
      return ALLOW;
    }
    const names = missingSkills.map((skill) => skill.name).join(', ');
    return {
      kind: 'reject',
      code: 'SKILL_MISMATCH',
      detail: `${developer.name} lacks the required skill(s): ${names}.`,
      extensions: { missingSkills },
    };
  }
}
