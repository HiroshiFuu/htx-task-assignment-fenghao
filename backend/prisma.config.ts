import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * 根据 DATABASE_URL 自动选择方言：
 *   file:...        → 本地 SQLite（schema 由 scripts/gen-sqlite-schema.ts 生成）
 *   postgresql://.. → PostgreSQL（部署 / Docker / 生成迁移）
 *
 * Docker 构建阶段执行 prisma generate 时没有 DATABASE_URL，回退为 PostgreSQL。
 */
const url = process.env.DATABASE_URL ?? '';
const isSqlite = url.startsWith('file:');

export default defineConfig({
  schema: isSqlite ? 'prisma/schema.sqlite.prisma' : 'prisma/schema.prisma',
  migrations: {
    // 迁移只为 PostgreSQL 维护。SQLite 模式下指向一个被 gitignore 的目录，
    // 防止误执行 `prisma migrate dev` 时把 SQLite 迁移混进交付物。
    path: isSqlite ? 'prisma/.sqlite-migrations-unused' : 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: { url },
});
