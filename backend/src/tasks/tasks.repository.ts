import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatus } from '../generated/prisma/client';
import { DbClient } from '../common/prisma/db-client';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { TaskRef } from './rules/rule';

const TASK_INCLUDE = {
  skills: { include: { skill: true } },
  assignee: { select: { id: true, name: true } },
} as const;

/**
 * Only the relative order of siblings matters when the forest is assembled:
 * subtasks follow their position; roots all have position 0, so they fall back to
 * creation time.
 */
const TREE_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { position: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];

interface RawTaskRef {
  id: string;
  title: string;
  status: string;
}

const STATUSES = new Set<string>(Object.values(TaskStatus));

function toTaskRef(row: RawTaskRef): TaskRef {
  if (!STATUSES.has(row.status)) {
    throw new Error(`Unexpected task status in database: ${row.status}`);
  }
  return { id: row.id, title: row.title, status: row.status as TaskStatus };
}

function toNestedCreate(
  dto: CreateTaskDto,
  position: number,
): Prisma.TaskCreateWithoutParentInput {
  return {
    title: dto.title,
    position,
    skills: {
      create: (dto.skillIds ?? []).map((skillId) => ({ skillId })),
    },
    subtasks: {
      create: (dto.subtasks ?? []).map((child, index) =>
        toNestedCreate(child, index),
      ),
    },
  };
}

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** One query for the whole forest; the tree is assembled in memory (no N+1). */
  findAll() {
    return this.prisma.client.task.findMany({
      include: TASK_INCLUDE,
      orderBy: TREE_ORDER,
    });
  }

  findByIds(ids: readonly string[], db: DbClient = this.prisma.client) {
    return db.task.findMany({
      where: { id: { in: [...ids] } },
      include: TASK_INCLUDE,
      orderBy: TREE_ORDER,
    });
  }

  findById(id: string, db: DbClient = this.prisma.client) {
    return db.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  }

  findRef(id: string, db: DbClient): Promise<TaskRef | null> {
    return db.task.findUnique({
      where: { id },
      select: { id: true, title: true, status: true },
    });
  }

  /** Every descendant at any depth (decision D4); SQL valid on SQLite and PostgreSQL. */
  async findDescendants(id: string, db: DbClient): Promise<TaskRef[]> {
    const rows = await db.$queryRaw<RawTaskRef[]>`
      WITH RECURSIVE descendants(id, title, status) AS (
        SELECT id, title, status FROM tasks WHERE parent_id = ${id}
        UNION ALL
        SELECT t.id, t.title, t.status
          FROM tasks t JOIN descendants d ON t.parent_id = d.id
      )
      SELECT id, title, CAST(status AS TEXT) AS status FROM descendants`;
    return rows.map(toTaskRef);
  }

  /** Ancestor chain ordered nearest first (used by the cascade rollback, D5). */
  async findAncestors(id: string, db: DbClient): Promise<TaskRef[]> {
    const rows = await db.$queryRaw<RawTaskRef[]>`
      WITH RECURSIVE ancestors(id, parent_id, title, status, depth) AS (
        SELECT p.id, p.parent_id, p.title, p.status, 1
          FROM tasks c JOIN tasks p ON p.id = c.parent_id
         WHERE c.id = ${id}
        UNION ALL
        SELECT t.id, t.parent_id, t.title, t.status, a.depth + 1
          FROM tasks t JOIN ancestors a ON t.id = a.parent_id
      )
      SELECT id, title, CAST(status AS TEXT) AS status FROM ancestors ORDER BY depth`;
    return rows.map(toTaskRef);
  }

  /** Writes the whole tree with Prisma nested creates; returns the root id. */
  async createTree(dto: CreateTaskDto, db: DbClient): Promise<string> {
    const root = await db.task.create({
      data: toNestedCreate(dto, 0),
      select: { id: true },
    });
    return root.id;
  }

  updateStatus(id: string, status: TaskStatus, db: DbClient) {
    return db.task.update({
      where: { id },
      data: { status },
      select: { id: true },
    });
  }

  /** Through Prisma Client (not raw SQL) so @updatedAt is maintained. */
  rollBackToInProgress(ids: readonly string[], db: DbClient) {
    return db.task.updateMany({
      where: { id: { in: [...ids] } },
      data: { status: TaskStatus.IN_PROGRESS },
    });
  }

  updateAssignee(id: string, assigneeId: string | null, db: DbClient) {
    return db.task.update({
      where: { id },
      data: { assigneeId },
      select: { id: true },
    });
  }
}

export type TaskRow = Awaited<ReturnType<TasksRepository['findAll']>>[number];
