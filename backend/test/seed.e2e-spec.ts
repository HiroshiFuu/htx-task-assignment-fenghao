import type { PrismaClient } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/common/prisma/prisma-client.factory';
import { AllDescendantsDoneRule } from '../src/tasks/rules/all-descendants-done.rule';
import { SkillMatchRule } from '../src/tasks/rules/skill-match.rule';
import { seed } from '../prisma/seed';
import {
  flattenSeedTasks,
  SEED_DEVELOPERS,
  SEED_SKILLS,
  SEED_TASKS,
  type SeedTask,
} from '../prisma/seed-data';

const descendantsOf = (task: SeedTask): SeedTask[] =>
  task.subtasks.flatMap((child) => [child, ...descendantsOf(child)]);

/** The seed bypasses the API, so its data is checked against the API's own rules. */
describe('seed data respects the business rules', () => {
  const seeded = flattenSeedTasks();

  it('has a parent → child → nested task tree', () => {
    const depthOf = (task: SeedTask): number =>
      1 + Math.max(0, ...task.subtasks.map(depthOf));
    expect(Math.max(...SEED_TASKS.map(depthOf))).toBe(3);
  });

  it.each(seeded.filter(({ task }) => task.assignee))(
    'assignee of "$task.title" has every required skill (D3)',
    ({ task }) => {
      const developer = task.assignee as NonNullable<SeedTask['assignee']>;
      const result = new SkillMatchRule().evaluate({
        task: { id: task.id, skills: task.skills },
        developer: {
          id: developer.id,
          name: developer.name,
          skillIds: developer.skills.map((s) => s.id),
        },
      });
      expect(result.kind).toBe('allow');
    },
  );

  it.each(seeded.filter(({ task }) => task.status === 'DONE'))(
    'Done task "$task.title" has no open subtask (D4)',
    ({ task }) => {
      const result = new AllDescendantsDoneRule().evaluate({
        task: { id: task.id, title: task.title, status: task.status },
        descendants: descendantsOf(task),
        ancestors: [],
        targetStatus: 'DONE',
        confirmCascade: false,
      });
      expect(result.kind).toBe('allow');
    },
  );
});

describe('seed (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createPrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function developerSkillMap(): Promise<Record<string, string[]>> {
    const developers = await prisma.developer.findMany({
      where: { id: { in: SEED_DEVELOPERS.map((d) => d.id) } },
      include: { skills: { include: { skill: true } } },
    });
    return Object.fromEntries(
      developers.map((d) => [
        d.name,
        d.skills.map((ds) => ds.skill.name).sort(),
      ]),
    );
  }

  it('creates the four developers with their skills', async () => {
    await seed(prisma);

    expect(await developerSkillMap()).toEqual({
      Alice: ['Frontend'],
      Bob: ['Backend'],
      Carol: ['Backend', 'Frontend'],
      Dave: ['Backend'],
    });
  });

  it('is idempotent when run repeatedly', async () => {
    await seed(prisma);
    await seed(prisma);

    const seededSkillIds = Object.values(SEED_SKILLS).map((s) => s.id);
    const seededDeveloperIds = SEED_DEVELOPERS.map((d) => d.id);

    await expect(
      prisma.skill.count({ where: { id: { in: seededSkillIds } } }),
    ).resolves.toBe(2);
    await expect(
      prisma.developer.count({ where: { id: { in: seededDeveloperIds } } }),
    ).resolves.toBe(4);
    await expect(
      prisma.developerSkill.count({
        where: { developerId: { in: seededDeveloperIds } },
      }),
    ).resolves.toBe(5);
  });

  it('restores a developer skill set that drifted from the seed', async () => {
    const alice = SEED_DEVELOPERS[0];
    await prisma.developerSkill.upsert({
      where: {
        developerId_skillId: {
          developerId: alice.id,
          skillId: SEED_SKILLS.backend.id,
        },
      },
      create: { developerId: alice.id, skillId: SEED_SKILLS.backend.id },
      update: {},
    });

    await seed(prisma);

    expect((await developerSkillMap()).Alice).toEqual(['Frontend']);
  });

  const seededTaskIds = flattenSeedTasks().map(({ task }) => task.id);

  async function seededTaskRows() {
    return prisma.task.findMany({
      where: { id: { in: seededTaskIds } },
      include: { skills: true },
    });
  }

  it('creates the sample task tree with parents, positions and skills', async () => {
    await seed(prisma);
    await seed(prisma);

    const rows = await seededTaskRows();
    expect(rows).toHaveLength(seededTaskIds.length);
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const { task, parentId, position } of flattenSeedTasks()) {
      const row = byId.get(task.id);
      expect(row).toMatchObject({
        title: task.title,
        status: task.status,
        parentId,
        position,
        assigneeId: task.assignee?.id ?? null,
      });
      expect(row?.skills.map((s) => s.skillId).sort()).toEqual(
        task.skills.map((s) => s.id).sort(),
      );
    }
  });

  it('restores seeded tasks that drifted, and leaves other tasks alone', async () => {
    const [{ task: root }, { task: child }] = flattenSeedTasks();
    await prisma.task.update({
      where: { id: child.id },
      data: { status: 'DONE', assigneeId: null },
    });
    await prisma.taskSkill.deleteMany({ where: { taskId: root.id } });
    const own = await prisma.task.create({ data: { title: 'Not seeded' } });

    await seed(prisma);

    const restored = await seededTaskRows();
    expect(restored.find((r) => r.id === child.id)).toMatchObject({
      status: child.status,
      assigneeId: child.assignee?.id ?? null,
    });
    expect(restored.find((r) => r.id === root.id)?.skills).toHaveLength(
      root.skills.length,
    );
    await expect(
      prisma.task.findUnique({ where: { id: own.id } }),
    ).resolves.toMatchObject({ title: 'Not seeded' });
    await prisma.task.delete({ where: { id: own.id } });
  });
});
