/**
 * 本地开发：重建 SQLite 数据库 → 同步 schema → 生成 Prisma Client → seed。
 *
 * 只允许作用于本地 SQLite（DATABASE_URL 以 file: 开头，且文件位于 backend/prisma/ 内），
 * 绝不会碰 PostgreSQL。PostgreSQL 请使用 `npm run db:reset:pg`。
 *
 * 为什么 SQLite 用 `db push` 而不是迁移：
 *   Prisma 的迁移文件是方言相关的，且 migration_lock.toml 锁定 provider。
 *   prisma/migrations/ 只保存 PostgreSQL 迁移（交付物）；SQLite 直接按 schema 重建即可。
 *
 * 用法（在 backend/ 目录下）：npm run db:reset
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const SQLITE_SCHEMA = 'prisma/schema.sqlite.prisma';

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function run(step: string, command: string): void {
  console.log(`\n▶ ${step}\n  $ ${command}`);
  // execSync 默认经由系统 shell 执行，Windows（cmd）与 macOS/Linux 均可用
  execSync(command, { stdio: 'inherit', env: process.env });
}

function resolveSqlitePath(url: string): string {
  if (process.env.NODE_ENV === 'production') {
    fail('NODE_ENV=production 时禁止执行 db:reset');
  }
  if (!url.startsWith('file:')) {
    fail(
      'db:reset 只用于本地 SQLite（DATABASE_URL 需以 file: 开头）。PostgreSQL 请用 npm run db:reset:pg',
    );
  }
  const dbPath = resolve(url.slice('file:'.length));
  const allowedDir = resolve('prisma') + sep;
  if (!dbPath.startsWith(allowedDir)) {
    fail(
      `出于安全考虑，只允许删除 ${allowedDir} 下的数据库文件，当前为：${dbPath}`,
    );
  }
  return dbPath;
}

function deleteDatabaseFiles(dbPath: string): void {
  console.log(`\n▶ 删除旧数据库 ${dbPath}`);
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    try {
      rmSync(dbPath + suffix, { force: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EBUSY' || code === 'EPERM') {
        fail(
          '数据库文件被占用（Windows 文件锁）。请先停止 npm run start:dev 或关闭 Prisma Studio / DB 客户端后重试',
        );
      }
      throw error;
    }
  }
}

function main(): void {
  const dbPath = resolveSqlitePath(process.env.DATABASE_URL ?? '');

  deleteDatabaseFiles(dbPath);
  run(
    '从 schema.prisma 生成 SQLite schema',
    'npx tsx scripts/gen-sqlite-schema.ts',
  );
  run(
    '按 schema 创建数据库表',
    `npx --no-install prisma db push --schema ${SQLITE_SCHEMA}`,
  );
  run(
    '生成 Prisma Client（SQLite）',
    `npx --no-install prisma generate --schema ${SQLITE_SCHEMA}`,
  );
  run('写入 seed 数据', 'npx tsx prisma/seed.ts');

  console.log('\n✔ 本地 SQLite 数据库已重建完成');
}

main();
