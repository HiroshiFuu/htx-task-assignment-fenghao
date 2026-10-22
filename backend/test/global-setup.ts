import 'dotenv/config';
import { localDatabaseViolation } from '../scripts/assert-local-pg';

// E2E specs write to the database (seed, later truncation), so refuse any non-local
// target however Jest is launched, including a DATABASE_URL left in the shell.
export default function globalSetup(): void {
  const violation = localDatabaseViolation(process.env.DATABASE_URL, {
    allowSqlite: true,
  });
  if (violation) {
    throw new Error(`E2E tests aborted: ${violation}`);
  }
}
