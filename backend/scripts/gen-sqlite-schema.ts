/**
 * 从 PostgreSQL 的 prisma/schema.prisma（唯一事实来源）生成本地开发用的
 * prisma/schema.sqlite.prisma。生成文件已加入 .gitignore，请勿手动编辑。
 *
 * 转换规则：
 *   1. datasource provider "postgresql" → "sqlite"
 *   2. 去掉所有原生类型注解 @db.Xxx(...)（SQLite 不支持）
 * 遇到无法安全转换的 PostgreSQL 专属特性时直接报错，而不是悄悄生成错误的 schema。
 *
 * 用法（在 backend/ 目录下）：npx tsx scripts/gen-sqlite-schema.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = resolve('prisma', 'schema.prisma');
const TARGET = resolve('prisma', 'schema.sqlite.prisma');

const HEADER = [
  '// ------------------------------------------------------------------',
  '// AUTO-GENERATED from prisma/schema.prisma by scripts/gen-sqlite-schema.ts',
  '// DO NOT EDIT. Local development only. Run `npm run db:reset` to rebuild.',
  '// ------------------------------------------------------------------',
  '',
].join('\n');

/** SQLite 无法表达、必须人工处理的 PostgreSQL 特性 */
const UNSUPPORTED: ReadonlyArray<[RegExp, string]> = [
  [
    /dbgenerated\(/,
    'dbgenerated()：请改用 Prisma 层默认值，例如 @default(uuid())',
  ],
  [/@@schema\(/, '多 schema（@@schema）'],
  [/\bextensions\s*=/, 'PostgreSQL extensions'],
  [/\bUnsupported\(/, 'Unsupported() 类型'],
];

export function toSqliteSchema(pgSchema: string): string {
  const providerPattern =
    /(datasource\s+\w+\s*\{[^}]*?provider\s*=\s*)"postgresql"/;
  if (!providerPattern.test(pgSchema)) {
    throw new Error('schema.prisma 的 datasource provider 必须是 "postgresql"');
  }

  for (const [pattern, label] of UNSUPPORTED) {
    if (pattern.test(pgSchema)) {
      throw new Error(`schema.prisma 使用了 SQLite 不支持的特性：${label}`);
    }
  }

  const converted = pgSchema
    .replace(providerPattern, '$1"sqlite"')
    .replace(/[ \t]+@db\.[A-Za-z0-9]+(\([^)]*\))?/g, '');

  if (/@db\./.test(converted)) {
    throw new Error('仍有未移除的 @db.* 原生类型注解，请检查 schema 写法');
  }
  return HEADER + converted;
}

function main(): void {
  const output = toSqliteSchema(readFileSync(SOURCE, 'utf8'));
  writeFileSync(TARGET, output, 'utf8');
  console.log(`✔ 已生成 ${TARGET}`);
}

if (require.main === module) {
  main();
}
