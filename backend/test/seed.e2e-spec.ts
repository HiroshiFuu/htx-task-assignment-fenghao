import type { PrismaClient } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/common/prisma/prisma-client.factory';
import { seed } from '../prisma/seed';
import { SEED_DEVELOPERS, SEED_SKILLS } from '../prisma/seed-data';

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
});
