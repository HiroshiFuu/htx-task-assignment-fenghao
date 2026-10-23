import type { TaskStatus } from '../src/generated/prisma/client';

// Fixed UUIDs keep the seed idempotent (upsert by id) and let tests reference rows directly.
export const SEED_SKILLS = {
  frontend: { id: 'b0000000-0000-4000-8000-000000000001', name: 'Frontend' },
  backend: { id: 'b0000000-0000-4000-8000-000000000002', name: 'Backend' },
} as const;

type SeedSkill = (typeof SEED_SKILLS)[keyof typeof SEED_SKILLS];

export interface SeedDeveloper {
  id: string;
  name: string;
  skills: readonly SeedSkill[];
}

const ALICE: SeedDeveloper = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Alice',
  skills: [SEED_SKILLS.frontend],
};
const BOB: SeedDeveloper = {
  id: 'a0000000-0000-4000-8000-000000000002',
  name: 'Bob',
  skills: [SEED_SKILLS.backend],
};
const CAROL: SeedDeveloper = {
  id: 'a0000000-0000-4000-8000-000000000003',
  name: 'Carol',
  skills: [SEED_SKILLS.frontend, SEED_SKILLS.backend],
};
const DAVE: SeedDeveloper = {
  id: 'a0000000-0000-4000-8000-000000000004',
  name: 'Dave',
  skills: [SEED_SKILLS.backend],
};

export const SEED_DEVELOPERS: readonly SeedDeveloper[] = [
  ALICE,
  BOB,
  CAROL,
  DAVE,
];

export interface SeedTask {
  id: string;
  title: string;
  status: TaskStatus;
  skills: readonly SeedSkill[];
  assignee: SeedDeveloper | null;
  subtasks: readonly SeedTask[];
}

const task = (
  n: number,
  title: string,
  status: TaskStatus,
  skills: readonly SeedSkill[],
  assignee: SeedDeveloper | null,
  subtasks: readonly SeedTask[] = [],
): SeedTask => ({
  id: `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  title,
  status,
  skills,
  assignee,
  subtasks,
});

const { frontend: FRONTEND, backend: BACKEND } = SEED_SKILLS;

/**
 * Sample data for the UI: a three-level tree (parent → child → nested) plus two
 * stand-alone tasks taken from the brief. The seed bypasses the API, so this data
 * must satisfy the business rules itself; test/seed.e2e-spec.ts checks that every
 * assignee has the task's skills and that no Done task has an open subtask.
 */
export const SEED_TASKS: readonly SeedTask[] = [
  task(
    1,
    'Launch the user profile feature',
    'IN_PROGRESS',
    [FRONTEND, BACKEND],
    CAROL,
    [
      task(2, 'Build the profile API', 'IN_PROGRESS', [BACKEND], BOB, [
        task(
          3,
          'Add the profile picture upload endpoint',
          'DONE',
          [BACKEND],
          DAVE,
        ),
        task(4, 'Validate image type and size', 'TODO', [BACKEND], null),
      ]),
      task(5, 'Design the profile page', 'DONE', [FRONTEND], ALICE, [
        task(6, 'Make the profile page responsive', 'DONE', [FRONTEND], ALICE),
        // Cancelled work doesn't block its Done parent (decision D15).
        task(9, 'Add an animated avatar picker', 'CANCELLED', [FRONTEND], null),
      ]),
    ],
  ),
  task(
    7,
    'As a system administrator, I want audit logs of all data access and modifications so that I can ensure compliance with data protection regulations and investigate any security incidents.',
    'TODO',
    [BACKEND],
    BOB,
  ),
  task(
    8,
    'As a visitor, I want to see a responsive homepage so that I can easily navigate on both desktop and mobile devices.',
    'TODO',
    [FRONTEND],
    null,
  ),
];

/**
 * Depth-first (parents before children), with the parent id and sibling position.
 * Roots get position 0 like tasks created through the API, so they sort by
 * creation time alongside them.
 */
export function flattenSeedTasks(
  tasks: readonly SeedTask[] = SEED_TASKS,
  parentId: string | null = null,
): Array<{ task: SeedTask; parentId: string | null; position: number }> {
  return tasks.flatMap((task, index) => [
    { task, parentId, position: parentId === null ? 0 : index },
    ...flattenSeedTasks(task.subtasks, task.id),
  ]);
}
