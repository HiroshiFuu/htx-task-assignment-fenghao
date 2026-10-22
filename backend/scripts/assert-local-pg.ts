/**
 * Guard for destructive PostgreSQL scripts (migrate dev / migrate reset / PG e2e).
 * Refuses unless DATABASE_URL points at the local docker compose database, so a
 * stray staging/production URL in the shell can never be reset or truncated.
 *
 * Usage: dotenv -o -e .env.pg -- tsx scripts/assert-local-pg.ts
 */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
// libpq / pg-connection-string let these query params override the URL's host.
const HOST_OVERRIDE_PARAMS = ['host', 'hostaddr'];

/** Returns why the URL is not a safe local database, or null if it is. */
export function localDatabaseViolation(
  rawUrl: string | undefined,
  { allowSqlite }: { allowSqlite: boolean },
): string | null {
  if ((process.env.NODE_ENV ?? '').toLowerCase().startsWith('prod')) {
    return 'Refusing to run with NODE_ENV=production';
  }
  if (allowSqlite && rawUrl?.startsWith('file:')) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(rawUrl ?? '');
  } catch {
    return 'DATABASE_URL is missing or not a valid URL';
  }

  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    return `Expected a postgresql:// DATABASE_URL, got ${url.protocol}`;
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    return `Refusing to touch non-local PostgreSQL host "${url.hostname}"`;
  }
  const override = HOST_OVERRIDE_PARAMS.find((p) => url.searchParams.has(p));
  if (override) {
    return `Refusing DATABASE_URL with a "${override}" query parameter (it overrides the host)`;
  }
  return null;
}

function main(): void {
  const violation = localDatabaseViolation(process.env.DATABASE_URL, {
    allowSqlite: false,
  });
  if (violation) {
    console.error(`✖ ${violation}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
