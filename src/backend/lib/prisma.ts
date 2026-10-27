import { PrismaClient } from '@prisma/client';

// Neon (and other PgBouncer-backed Postgres) requires prepared statements to be
// disabled on the pooled endpoint. The Vercel integration injects a pooled URL
// without that flag, so add it before the client reads the environment.
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  const isPooled = /-pooler\./.test(databaseUrl);
  const hasPgbouncer = /[?&]pgbouncer=/.test(databaseUrl);
  const hasConnectionLimit = /[?&]connection_limit=/.test(databaseUrl);

  if (isPooled && (!hasPgbouncer || !hasConnectionLimit)) {
    const separator = databaseUrl.includes('?') ? '&' : '?';
    const additions = [
      !hasPgbouncer ? 'pgbouncer=true' : null,
      !hasConnectionLimit ? 'connection_limit=1' : null,
    ].filter(Boolean);
    process.env.DATABASE_URL = `${databaseUrl}${separator}${additions.join('&')}`;
  }
}

// Reuse a single client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
