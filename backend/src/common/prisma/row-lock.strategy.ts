import type { Prisma } from '../../generated/prisma/client';

/**
 * Strategy: the only place where SQL dialects differ (CLAUDE.md, decision D14).
 * Call inside a transaction before check-then-write logic to prevent TOCTOU races.
 */
export abstract class RowLockStrategy {
  abstract lockTasks(
    tx: Prisma.TransactionClient,
    taskIds: readonly string[],
  ): Promise<void>;
}

export class PostgresRowLockStrategy extends RowLockStrategy {
  async lockTasks(
    tx: Prisma.TransactionClient,
    taskIds: readonly string[],
  ): Promise<void> {
    if (taskIds.length === 0) {
      return;
    }
    // ORDER BY id gives every transaction the same lock order, avoiding deadlocks.
    // The uuid[] cast is PG-only, which is why it lives here and not in shared SQL.
    await tx.$queryRaw`SELECT id FROM tasks WHERE id = ANY(${[...taskIds]}::uuid[]) ORDER BY id FOR UPDATE`;
  }
}

/** SQLite serialises writers with a database-level lock, so row locks are unnecessary. */
export class SqliteRowLockStrategy extends RowLockStrategy {
  lockTasks(): Promise<void> {
    return Promise.resolve();
  }
}
