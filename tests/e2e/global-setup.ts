import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Resets the dedicated E2E database and upload folder before every run so the
 * first-run setup flow always starts from an empty database.
 */
export default async function globalSetup() {
  const uploads = path.resolve('uploads/e2e');
  fs.rmSync(uploads, { recursive: true, force: true });

  // The web servers are already running at this point, so the SQLite file may
  // be open. `--force-reset` recreates the schema without unlinking the file.
  execSync('npx prisma db push --skip-generate --force-reset', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./e2e.db' },
  });
}
