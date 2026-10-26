# FlowPilot — AICTE Approval Dashboard

A full-stack prototype for tracking AICTE institutional approval applications, document
verification compliance, and workflow risk.

## Stack

- **Backend:** Express 5 + TypeScript + Prisma ORM (SQLite for local development)
- **Frontend:** React 19 + Vite 8 + Tailwind CSS 4 + React Router
- **Auth:** JWT + bcrypt

## Quick start

```bash
npm install
npm run db:setup   # generate Prisma client, create the DB, seed demo data
npm run dev        # API on :5000 and web app on :5173
```

Open **http://localhost:5173**.

> `db:setup` is only needed the first time (or whenever you want to reset demo data).
> The database file lives at `prisma/dev.db`.

## First-run setup

On first launch the database is empty. Open the app and create the first administrator account
through the `/setup` page. All other accounts are created by the administrator in the Users screen.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run API + Vite dev server together |
| `npm run dev:server` | Run only the Express API with auto-reload |
| `npm run dev:client` | Run only the Vite dev server |
| `npm run build` | Build the frontend into `dist/` |
| `npm run typecheck` | Type-check the whole project |
| `npm run db:setup` | Regenerate the client, push schema, reseed, and create demo PDFs |
| `npm run db:push` | Apply the Prisma schema to the database |
| `npm run db:seed` | Reset and reseed demo data |
| `npm start` | Run the API without auto-reload |

## API overview

All endpoints are under `http://localhost:5000`.

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | public | Health check |
| POST | `/api/auth/register` | first-run / Admin | Create an account (public only while the database is empty) |
| POST | `/api/auth/login` | public | Log in and receive a JWT |
| GET | `/api/auth/me` | JWT | Validate the session and load the profile |
| PATCH | `/api/auth/me` | JWT | Update your name |
| PATCH | `/api/auth/me/password` | JWT | Change your password |
| GET | `/api/applications` | JWT | List applications visible to the current role |
| GET | `/api/applications/:id` | JWT | Application detail with documents, reviews and inspections |
| POST | `/api/applications` | JWT (Admin/College) | Create an application |
| POST | `/api/applications/:id/submit` | JWT (College) | Submit or resubmit a draft |
| PATCH | `/api/applications/:id/status` | JWT (Admin/Officer) | Update status with workflow validation + review |
| GET | `/api/documents/requirements` | JWT | Required document types by category/year |
| POST | `/api/documents/upload` | JWT (Admin/College) | Upload a document (PDF/JPG/PNG, max 5 MB) |
| GET | `/api/documents/application/:applicationId` | JWT | List documents for an application |
| PATCH | `/api/documents/verify/:id` | JWT (Admin/Officer) | Approve/reject/request correction |
| GET | `/api/documents/compliance/:applicationId` | JWT | Compliance score against real requirements |
| GET | `/api/institutions` | JWT | Institutions visible to the current user |
| GET/POST/PATCH | `/api/users`, `/api/users/:id` | JWT (Admin) | Manage user accounts |
| GET | `/api/notifications` | JWT | Notifications + unread count |
| PATCH | `/api/notifications/:id/read` | JWT | Mark one notification read |
| PATCH | `/api/notifications/read-all` | JWT | Mark all notifications read |
| GET | `/api/inspections` | JWT | Inspections in the user's scope |
| POST | `/api/inspections` | JWT (Admin/Officer) | Schedule an expert committee visit |
| PATCH | `/api/inspections/:id` | JWT (Admin/Officer) | Update or complete an inspection |
| GET | `/api/analytics/summary` | JWT | Dashboard metrics scoped by role |
| GET | `/api/audit` | JWT (Admin/Officer) | Audit trail |

All API errors are returned as JSON. Access is role-scoped: administrators see everything,
officers see applications assigned to them, and college users only see their own institution.

## Production build

```bash
npm run build   # writes dist/
npm start       # API also serves dist/ and falls back to index.html for SPA routes
```

In development Vite proxies `/api` and `/uploads` to `http://localhost:5000`.

## Notes on the local setup

The original project targeted PostgreSQL, but no PostgreSQL server is available on this
machine, so the Prisma datasource uses **SQLite** (`DATABASE_URL="file:./dev.db"`). SQLite
does not support Prisma enums, so role/status columns are stored as validated strings with
the same values (`ADMIN`, `UNDER_REVIEW`, `APPROVED`, etc.).

To switch back to PostgreSQL, change `prisma/schema.prisma` to
`provider = "postgresql"`, set a PostgreSQL `DATABASE_URL` in `.env`, and run
`npm run db:setup`.

## New endpoints (Phase 2/3)

- `GET /api/documents/file/:id` (auth) — download a document with access check.
- `GET /api/documents/expiring?days=30` (auth) — expiring/expired documents.
- `GET /api/analytics/pendency` (auth) — stage ageing, region, officer workload, deadlines.
- `GET /api/inspections/queue` (auth) — applications in EVC without a scheduled inspection.
- `GET/POST/PATCH /api/undertakings` — time-bound undertakings.
- `GET /api/reports/consolidated?format=json|csv` (admin/officer) — consolidated report.
- `POST /api/admin/run-jobs` (admin) — trigger the scheduler manually.

## Scheduler

Set `ENABLE_SCHEDULER=false` to disable. `STAGE_SLA_DAYS` (default 15) controls escalation threshold.
`CORS_ORIGIN` comma-separated list (default `http://localhost:5173`).

## Tests

`npm test` (vitest). Uses `prisma/test.db` (reset per run).
