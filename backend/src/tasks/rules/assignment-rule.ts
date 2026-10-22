import { Rule } from './rule';

export interface SkillRef {
  id: string;
  name: string;
}

export interface AssignmentContext {
  task: { id: string; skills: readonly SkillRef[] };
  developer: { id: string; name: string; skillIds: readonly string[] };
}

export type AssignmentRule = Rule<AssignmentContext>;

/** DI token for the ordered assignment rule chain. */
export const ASSIGNMENT_RULES = Symbol('ASSIGNMENT_RULES');
