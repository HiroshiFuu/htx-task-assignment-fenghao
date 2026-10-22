import type { Developer, Skill, TaskNode } from '../api/types';

export const FRONTEND = { id: 'skill-frontend', name: 'Frontend' };
export const BACKEND = { id: 'skill-backend', name: 'Backend' };

export const skills: Skill[] = [
  { ...BACKEND, developers: [] },
  { ...FRONTEND, developers: [] },
];

const developer = (
  id: string,
  name: string,
  developerSkills: Developer['skills'],
): Developer => ({ id, name, skills: developerSkills, tasks: [] });

export const ALICE = developer('dev-alice', 'Alice', [FRONTEND]);
export const BOB = developer('dev-bob', 'Bob', [BACKEND]);
export const CAROL = developer('dev-carol', 'Carol', [BACKEND, FRONTEND]);
export const DAVE = developer('dev-dave', 'Dave', [BACKEND]);
export const developers: Developer[] = [ALICE, BOB, CAROL, DAVE];

export function makeTask(overrides: Partial<TaskNode> = {}): TaskNode {
  return {
    id: 'task-1',
    title: 'Build the landing page',
    status: 'TODO',
    skills: [FRONTEND],
    skillSource: 'USER',
    assignee: null,
    parentId: null,
    subtasks: [],
    createdAt: '2026-10-22T00:00:00.000Z',
    updatedAt: '2026-10-22T00:00:00.000Z',
    ...overrides,
  };
}
