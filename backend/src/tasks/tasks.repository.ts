import { Injectable } from '@nestjs/common';
import type { TaskStatus } from '../generated/prisma/client';
import { DbClient } from '../common/prisma/db-client';
import { PrismaService } from '../common/prisma/prisma.service';

const TASK_INCLUDE = {
  skills: { include: { skill: true } },
  assignee: { select: { id: true, name: true } },
} as const;

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.client.task.findMany({
      include: TASK_INCLUDE,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  findById(id: string, db: DbClient = this.prisma.client) {
    return db.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  }

  create(
    data: { title: string; skillIds: readonly string[] },
    db: DbClient = this.prisma.client,
  ) {
    return db.task.create({
      data: {
        title: data.title,
        skills: { create: data.skillIds.map((skillId) => ({ skillId })) },
      },
      include: TASK_INCLUDE,
    });
  }

  updateStatus(id: string, status: TaskStatus, db: DbClient) {
    return db.task.update({
      where: { id },
      data: { status },
      include: TASK_INCLUDE,
    });
  }

  updateAssignee(id: string, assigneeId: string | null, db: DbClient) {
    return db.task.update({
      where: { id },
      data: { assigneeId },
      include: TASK_INCLUDE,
    });
  }
}

export type TaskRow = NonNullable<
  Awaited<ReturnType<TasksRepository['findById']>>
>;
