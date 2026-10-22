import { Injectable } from '@nestjs/common';
import { DbClient } from '../common/prisma/db-client';
import { PrismaService } from '../common/prisma/prisma.service';

const WITH_SKILLS_AND_TASKS = {
  skills: { include: { skill: true } },
  tasks: {
    select: { id: true, title: true, status: true },
    orderBy: { createdAt: 'asc' },
  },
} as const;

@Injectable()
export class DevelopersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.client.developer.findMany({
      include: WITH_SKILLS_AND_TASKS,
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.client.developer.findUnique({
      where: { id },
      include: WITH_SKILLS_AND_TASKS,
    });
  }

  /** Minimal shape needed by assignment rules. */
  async findForAssignment(
    id: string,
    db: DbClient = this.prisma.client,
  ): Promise<{ id: string; name: string; skillIds: string[] } | null> {
    const row = await db.developer.findUnique({
      where: { id },
      select: { id: true, name: true, skills: { select: { skillId: true } } },
    });
    return row
      ? {
          id: row.id,
          name: row.name,
          skillIds: row.skills.map((s) => s.skillId),
        }
      : null;
  }
}
