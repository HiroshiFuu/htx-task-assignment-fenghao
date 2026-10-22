import { PrismaClient } from '../../generated/prisma/client';

/**
 * Factory：按 DATABASE_URL 选择 Prisma 7 driver adapter。
 * SQLite adapter 只在本地开发需要（devDependency），因此按需加载，
 * 生产镜像不包含 better-sqlite3 原生模块。
 * 供 PrismaService 与 prisma/seed.ts 共用。
 */
export function createPrismaClient(
  url: string | undefined = process.env.DATABASE_URL,
): PrismaClient {
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  if (url.startsWith('file:')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export type DatabaseDialect = 'sqlite' | 'postgresql';

export function detectDialect(
  url: string | undefined = process.env.DATABASE_URL,
): DatabaseDialect {
  return url?.startsWith('file:') ? 'sqlite' : 'postgresql';
}
