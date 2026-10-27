# FlowPilot — AICTE Approval Dashboard

A full-stack prototype for tracking AICTE institutional approval applications, document
verification compliance, and workflow risk.

## Stack

- **Backend:** Express 5 + TypeScript + Prisma ORM (SQLite for local development, PostgreSQL for deployment)
- **Frontend:** React 19 + Vite 8 + Tailwind CSS 4 + React Router
- **Auth:** JWT + bcrypt, with the token also set as an `httpOnly` cookie

## Quick start

```bash
npm install
npm run db:setup   # generate the Prisma client and create the SQLite schema
npm run dev        # API on :5000 and web app on :5173
```

Open **http://localhost:5173**. The database starts empty and contains no sample records.

> `db:setup` is only needed on a new machine or after deleting `prisma/dev.db`.

## First-run setup

The first visit to the app redirects to `/setup`. Create the first administrator there.
Every other account (officers and college users) is created by an administrator in the
**Users** screen. There is no public registration and no seeded account.

## Configuration

Copy `.env.example` to `.env` and adjust as needed. The API validates `DATABASE_URL` and
`JWT_SECRET` at startup and refuses to run without them.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | `file:./dev.db` for SQLite, or a PostgreSQL URL |
| `JWT_SECRET` | required | Signing key, minimum 32 characters |
| `JWT_EXPIRES_IN` | `24h` | Token lifetime |
| `PORT` | `5000` | API port |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `UPLOAD_DIR` | `uploads` | Document storage directory |
| `ENABLE_SCHEDULER` | `true` | Background deadline/expiry checks |
| `STAGE_SLA_DAYS` | `15` | Days before a stalled stage escalates |
| `LOGIN_RATE_MAX` | `10` | Failed login attempts allowed per IP |
| `LOGIN_RATE_WINDOW_MINUTES` | `15` | Rate-limit window |
| `SMTP_HOST` and related | unset | Email delivery; without it, notifications are logged |

## Reference data

There are no hard-coded categories, states, routes, or document lists. Administrators enter:

- **Routing rules** — category + new/existing → route (`/routing`)
- **State-to-region mappings** — state → region (`/routing`)
- **Document requirements** — category + academic year → required document types (`/requirements`)
- **Institutions** — name, type, state, category, academic year (`/institutions`)

If no routing rule or state mapping exists, the API falls back to `UNASSIGNED` or `CENTRAL`
and notifies administrators instead of guessing. Sources and expected values are described in
[docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run API + Vite dev server together |
| `npm run dev:server` | Run only the Express API with auto-reload |
| `npm run dev:client` | Run only the Vite dev server |
| `npm run build` | Build the frontend into `dist/` |
| `npm run typecheck` | Type-check the whole project |
| `npm run db:setup` | Generate the client and create/push the SQLite schema |
| `npm run db:push` | Apply `prisma/schema.prisma` to the database |
| `npm run db:use:sqlite` | Switch `prisma/schema.prisma` to the SQLite schema |
| `npm run db:use:postgres` | Switch `prisma/schema.prisma` to the PostgreSQL schema |
| `npm test` | Run the API/integration suite |
| `npm run test:e2e` | Run the Playwright workflow and accessibility suites |
| `npm run test:e2e:workflow` | Run only the end-to-end workflow |
| `npm run test:e2e:a11y` | Run only the axe accessibility checks |
| `npm start` | Run the API without auto-reload |

## API overview

All endpoints are under `http://localhost:5000`.

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | public | Health check (includes a database ping) |
| POST | `/api/setup` | public while empty | Create the first administrator |
| POST | `/api/auth/login` | public | Log in (rate-limited per IP) and receive a JWT |
| GET | `/api/auth/me` | JWT | Validate the session and load the profile |
| PATCH | `/api/auth/me` | JWT | Update your name |
| PATCH | `/api/auth/me/password` | JWT | Change your password |
| POST | `/api/auth/register` | Admin (or first user) | Create an account |
| GET | `/api/applications` | JWT | List applications visible to the current role |
| GET | `/api/applications/:id` | JWT | Application detail with documents, reviews and inspections |
| POST | `/api/applications` | Admin/College | Create an application |
| POST | `/api/applications/:id/submit` | College | Submit or resubmit |
| PATCH | `/api/applications/:id/status` | Admin/Officer | Validate and apply a workflow transition |
| GET | `/api/documents/requirements` | JWT | Required document types (reads admin-entered data) |
| POST | `/api/documents/requirements` | Admin | Add a document requirement |
| POST | `/api/documents/upload` | Admin/College | Upload a document (PDF/JPG/PNG, max 5 MB) |
| PATCH | `/api/documents/verify/:id` | Admin/Officer | Approve, reject, or request correction |
| GET | `/api/documents/compliance/:applicationId` | JWT | Compliance score against requirements |
| GET | `/api/documents/expiring?days=30` | JWT | Expiring and expired documents |
| GET | `/api/documents/file/:id` | JWT | Download a document with an access check |
| GET | `/api/institutions` | JWT | Institutions visible to the current user |
| POST/PATCH | `/api/institutions`, `/api/institutions/:id` | Admin | Create and edit institutions |
| GET/POST/PATCH | `/api/users`, `/api/users/:id` | Admin | Manage user accounts |
| GET | `/api/notifications` | JWT | Notifications and unread count |
| PATCH | `/api/notifications/:id/read` | JWT | Mark one notification read |
| PATCH | `/api/notifications/read-all` | JWT | Mark all notifications read |
| GET | `/api/inspections` | JWT | Inspections in the user's scope |
| GET | `/api/inspections/queue` | JWT | EVC-stage applications without a scheduled visit |
| POST | `/api/inspections` | Admin/Officer | Schedule an expert committee visit |
| PATCH | `/api/inspections/:id` | Admin/Officer | Update, complete, or cancel an inspection |
| GET/POST/PATCH | `/api/undertakings`, `/api/undertakings/:id` | JWT / Admin-Officer | Time-bound undertakings |
| POST | `/api/undertakings/:id/evidence` | JWT | Upload evidence for an undertaking |
| GET | `/api/analytics/summary` | JWT | Dashboard metrics scoped by role |
| GET | `/api/analytics/pendency` | JWT | Stage ageing, region, officer workload, deadlines |
| GET | `/api/reports/consolidated?format=json\|csv` | Admin/Officer | Consolidated report |
| GET | `/api/audit` | Admin/Officer | Append-only audit trail |
| GET | `/api/routing/rules` | Admin | Routing rules |
| POST | `/api/routing/rules` | Admin | Create a routing rule |
| GET | `/api/routing/state-regions` | Admin | State-to-region mappings |
| POST | `/api/routing/state-regions` | Admin | Create a state mapping |
| POST | `/api/admin/run-jobs` | Admin | Run scheduler checks now and return counts |

All API errors are returned as JSON. Access is role-scoped: administrators see everything,
officers see applications assigned to them, and college users only see their own institution.
Every write records an audit entry.

## Tests

```bash
npm test
npx playwright install chromium   # once per machine
npm run test:e2e
```

- `npm test` runs the API/integration suite against `prisma/test.db` (recreated per run).
  The login limiter stays enabled; the suite sets `LOGIN_RATE_MAX=3` and uses a distinct
  `X-Forwarded-For` per ordinary login so only the rate-limit test shares a bucket.
- `npm run test:e2e` runs `tests/e2e/workflow.spec.ts` (first-run setup → users → application →
  document verification → correction → resubmission → approval → audit trail) and
  `tests/e2e/accessibility.spec.ts` (axe serious/critical checks on 14 main pages).
  The E2E database is `prisma/e2e.db` with uploads in `uploads/e2e`, reset at the start of
  every run. The accessibility project depends on the workflow project, so it audits a
  populated application.
- Coverage by requirement is mapped in [docs/PS-COVERAGE.md](docs/PS-COVERAGE.md).

## Production build

```bash
npm run build   # writes dist/
npm start       # API also serves dist/ and falls back to index.html for SPA routes
```

In development Vite proxies `/api` and `/uploads` to `http://localhost:5000`.

## Docker (PostgreSQL)

`docker-compose.yml` runs PostgreSQL 16 and the app image. The container pushes the
PostgreSQL schema on start, then serves the API and the built frontend on port 5000.

```powershell
$env:JWT_SECRET = "a-random-value-of-at-least-32-characters"
docker compose up --build
```

`JWT_SECRET` is required by the compose file and has no default. Open
**http://localhost:5000/setup** to create the first administrator.

> This environment has the Docker CLI (29.9.1) and Compose (5.6.0), but the Docker Desktop
> daemon could not be started without administrator rights. The image build and container
> run are therefore **unverified**; see [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

For local PostgreSQL without Docker, run `npm run db:use:postgres`, point `DATABASE_URL` at
the database, then `npm run db:setup`. Switched back with `npm run db:use:sqlite`.

## Scheduler

`ENABLE_SCHEDULER=false` disables background checks. The scheduler sends deadline reminders,
flags overdue applications/inspections/undertakings, and expires documents; it is
idempotent through the `ReminderLog` table. Administrators can trigger a run from
**Settings**, which displays the counts returned by the API.

## Security notes

- Passwords are hashed with bcrypt; login is rate-limited per IP.
- Helmet sets a restrictive content-security policy; CORS is allow-listed.
- Uploaded files are checked by extension and magic bytes, and stored under `UPLOAD_DIR`.
- JWTs are accepted from the `Authorization` header and also set as an `httpOnly` cookie.
- Audit logs are append-only; secrets and tokens are redacted from request logs.

Known gaps and unverified deployment items are tracked in [docs/LIMITATIONS.md](docs/LIMITATIONS.md).
