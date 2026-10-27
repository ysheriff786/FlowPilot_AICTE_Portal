# Limitations

## Product scope

- No integration with AICTE’s own systems; all reference data is entered by administrators.
- No automated regulatory decisions; the system supports, not replaces, officers.
- No identity provider; accounts are created by administrators after the first-run setup.
- No formal security audit has been performed.
- Undertakings are created by typing an application UUID. The screen lists undertakings, but
  it does not yet offer an application picker.

## Deployment

- The Docker path is **unverified**. Docker CLI 29.9.1 and Compose 5.6.0 are installed, but
  the Docker Desktop daemon could not be started without administrator rights
  (`com.docker.service` is stopped and access was denied). `docker compose config` passes;
  the image build and container run were not executed.
- No local PostgreSQL server is available, so the PostgreSQL schema has not been exercised
  against a live database. Local development and the test suites use SQLite.
- The container creates/synchronises the PostgreSQL schema with `prisma db push` at startup
  rather than `prisma migrate deploy`. The committed migration in `prisma/migrations` is
  SQLite-specific and must not be applied to PostgreSQL.
- Docker Compose exposes PostgreSQL on port 5432 and requires `JWT_SECRET` to be set.

## Dependencies

`npm audit` reports 3 high-severity advisories:

```text
deepmerge-ts  <8.0.0
Severity: high
DeepmergeTS has stack exhaustion when merging recursive object graphs
GHSA-ggr8-5vv4-36mx
fix available via `npm audit fix --force`
Will install prisma@7.10.1, which is a breaking change
  node_modules/deepmerge-ts
    @prisma/config
      prisma
```

- The vulnerable package is pulled in by the **Prisma CLI** (`@prisma/config` →
  `deepmerge-ts`). It is not part of the Express request path.
- The only automated fix upgrades Prisma 6 → 7, a breaking major upgrade that also changes
  the generated client and migration workflow. It was not applied because it is outside this
  change set and could not be verified against a live PostgreSQL database.
- Recommended follow-up: plan a Prisma 7 upgrade, run `prisma generate`/`db push` against a
  disposable PostgreSQL database, and re-run `npm audit`, `npm test`, and `npm run test:e2e`.
- No other high or critical advisories were reported.

## Accessibility

- Automated axe checks cover serious and critical issues on 14 main pages. Moderate/minor
  issues and manual screen-reader/keyboard-only testing are not covered.
- The E2E accessibility run audits a database populated only by the workflow test, so states
  such as an undertaking row, an error banner, or a populated inspection list are not audited.

## Data and testing

- The API test suite runs against `prisma/test.db` and recreates it on every run. The Playwright
  suite runs against `prisma/e2e.db` with uploads in `uploads/e2e`; both are reset per run and
  are ignored by git.
- Rate limiting is keyed on client IP. Behind a proxy, `trust proxy` is set to 1, so the
  left-most forwarded address is used; deployments with multiple proxy hops must adjust this.
- Email delivery is only active when `SMTP_HOST` is configured; otherwise messages are logged.
