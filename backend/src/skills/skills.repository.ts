import { Injectable } from '@nestjs/common';
import { DbClient } from '../common/prisma/db-client';
import { PrismaService } from '../common/prisma/prisma.service';

const WITH_DEVELOPERS = {
  developers: { include: { developer: true } },
} as const;

@Injectable()
export class SkillsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.client.skill.findMany({
      include: WITH_DEVELOPERS,
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.client.skill.findUnique({
      where: { id },
      include: WITH_DEVELOPERS,
    });
  }

  async findExistingIds(
    ids: readonly string[],
    db: DbClient = this.prisma.client,
  ): Promise<string[]> {
    const rows = await db.skill.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
