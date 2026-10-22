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

export const SEED_DEVELOPERS: readonly SeedDeveloper[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'Alice',
    skills: [SEED_SKILLS.frontend],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    name: 'Bob',
    skills: [SEED_SKILLS.backend],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    name: 'Carol',
    skills: [SEED_SKILLS.frontend, SEED_SKILLS.backend],
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    name: 'Dave',
    skills: [SEED_SKILLS.backend],
  },
];
