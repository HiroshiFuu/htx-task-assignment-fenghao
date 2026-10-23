import 'dotenv/config';
import type { PrismaClient } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/common/prisma/prisma-client.factory';
import { flattenSeedTasks, SEED_DEVELOPERS, SEED_SKILLS } from './seed-data';

/**
 * Idempotent: upserts by fixed id and resets each seeded developer's skills and
 * each seeded task's fields and skills to the seed, so running it repeatedly never
 * duplicates rows. Tasks created through the app are left untouched.
 */
export async function seed(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const skill of Object.values(SEED_SKILLS)) {
      await tx.skill.upsert({
        where: { id: skill.id },
        create: skill,
        update: { name: skill.name },
      });
    }

    for (const developer of SEED_DEVELOPERS) {
      await tx.developer.upsert({
        where: { id: developer.id },
        create: { id: developer.id, name: developer.name },
        update: { name: developer.name },
      });

      const skillIds = developer.skills.map((skill) => skill.id);
      await tx.developerSkill.deleteMany({
        where: { developerId: developer.id, skillId: { notIn: skillIds } },
      });
      for (const skillId of skillIds) {
        await tx.developerSkill.upsert({
          where: {
            developerId_skillId: { developerId: developer.id, skillId },
          },
          create: { developerId: developer.id, skillId },
          update: {},
        });
      }
    }

    // Parents come first, so every parent_id already exists.
    for (const { task, parentId, position } of flattenSeedTasks()) {
      const fields = {
        title: task.title,
        status: task.status,
        assigneeId: task.assignee?.id ?? null,
        parentId,
        position,
      };
      await tx.task.upsert({
        where: { id: task.id },
        create: { id: task.id, ...fields },
        update: fields,
      });

      const skillIds = task.skills.map((skill) => skill.id);
      await tx.taskSkill.deleteMany({
        where: { taskId: task.id, skillId: { notIn: skillIds } },
      });
      for (const skillId of skillIds) {
        await tx.taskSkill.upsert({
          where: { taskId_skillId: { taskId: task.id, skillId } },
          create: { taskId: task.id, skillId },
          update: {},
        });
      }
    }
  });
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    await seed(prisma);
    console.log(
      `✔ Seeded ${Object.keys(SEED_SKILLS).length} skills, ${SEED_DEVELOPERS.length} developers and ${flattenSeedTasks().length} tasks`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    // Message only: raw Prisma errors can include connection details.
    console.error(
      `✖ Seed failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
