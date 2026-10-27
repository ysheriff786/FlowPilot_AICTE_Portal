# PS Coverage Report

This report verifies each PS section (A–F) against the code and the automated tests that
were actually run. It replaces the earlier draft, which listed endpoints without asserting
their behaviour and marked sections untested.

Verification method: read the screen and controller, run `npm test` (16 tests) and
`npx playwright test` (1 workflow + 15 accessibility checks: the public landing plus 14
dashboard pages). Scores only exceed 75 when a
section has a working UI screen, an automated behaviour test, and a Playwright path.

## A–F summary

| Section | Score | UI screen | Primary endpoint | Behaviour test | Playwright path |
| --- | --- | --- | --- | --- | --- |
| A — Overview | 100 | `/overview` — `OverviewPage.tsx` | `GET /api/analytics/summary`, `GET /api/analytics/pendency` | `returns the overview totals that the Overview screen renders`; `shows an officer only their assigned applications and an admin all applications` | Login lands on `/overview` and asserts the “Institutional Overview” heading; `/overview` audited by axe |
| B — Inspections | 90 | `/inspections` — `InspectionsPage.tsx` | `GET /api/inspections/queue`, `POST /api/inspections`, `PATCH /api/inspections/:id` | `includes EVC applications without a scheduled inspection and excludes those with one` (also schedules and completes a visit) | `/inspections` rendered and audited by axe; the schedule/complete buttons are not clicked in E2E |
| C — Compliance | 90 | `/compliance` — `CompliancePage.tsx` | `GET /api/documents/expiring?days=30`, `GET /api/documents/compliance/:applicationId` | `returns a document expiring in 10 days and not one expiring in 90 days`; `reports a zero compliance score while required documents are missing` | `/compliance` rendered and audited by axe; export/verify actions are exercised on other screens |
| D — Undertakings | 85 | `/undertakings` — `UndertakingsPage.tsx` | `GET/POST /api/undertakings`, `POST /api/undertakings/:id/evidence`, `PATCH /api/undertakings/:id` | `creates, uploads evidence, verifies, and lets the scheduler mark overdue` (also asserts the Reject transition and college-forbidden path) | `/undertakings` audited by axe, but the E2E database has no undertaking rows, so create/verify/reject are not clicked |
| E — Settings | 90 | `/settings` — `SettingsPage.tsx` | `POST /api/admin/run-jobs` | `rejects officers and allows admins to run scheduled checks`; `runs the scheduler twice without creating duplicate reminders` | `/settings` rendered and audited by axe; the “Run scheduled checks now” button is not clicked in E2E |
| F — Analytics | 90 | `/analytics` — `AnalyticsPage.tsx` | `GET /api/reports/consolidated?format=csv`, `GET /api/analytics/summary` | `returns CSV with a header and at least one data row`; `returns the overview totals that the Overview screen renders` | `/analytics` rendered and audited by axe; the CSV export button is not clicked in E2E |

Average score: **90.8 / 100**. No section is below 75. The 10–15 point deductions are for
screens whose writes are API-tested but not driven through the browser.

## Claim-by-claim verification

1. **Overview** — `OverviewPage.tsx` loads `/analytics/summary` at line 56 and
   `/analytics/pendency` at line 59. Both endpoints exist in
   `src/backend/routes/analytics.routes.ts`. The overview test asserts totals, status counts,
   document statuses, the compliance score, and upcoming deadlines; the scoping test asserts
   that an officer’s stage totals only include their applications while the admin sees more.
2. **Inspections** — `InspectionsPage.tsx` loads `/inspections` (line 48) and
   `/inspections/queue` (line 51), and updates a visit through `PATCH /inspections/:id`
   (line 77). The test proves that EVC applications without a scheduled visit are queued,
   scheduled applications are excluded, a visit can be created as `SCHEDULED`, and completed
   through `PATCH`.
3. **Compliance** — `CompliancePage.tsx` loads applications (line 41), the compliance score
   (line 46/72), and `/documents/expiring?days=30` (line 50). The tests assert the 30-day
   window includes a document expiring in 10 days and excludes one expiring in 90 days, and
   that a missing requirement produces a zero score and a missing-document list.
4. **Undertakings** — `UndertakingsPage.tsx` lists (line 21), creates (line 35), uploads
   evidence (line 84), verifies (line 88), and rejects (line 89). During verification the
   Reject action was found to send `REJECTED`, which the API rejected with 400; the schema
   now accepts `REJECTED`, notifies the institution, and the lifecycle test asserts the
   round-trip. The same test covers evidence upload, verification, college denial, overdue
   escalation, and the audit trail.
5. **Settings** — `SettingsPage.tsx` posts to `/admin/run-jobs` (line 225) and now renders the
   counts returned by the scheduler. The tests assert officers receive 403, admins receive
   200 with numeric counts, and a second scheduler run creates no duplicate reminders.
6. **Analytics** — `AnalyticsPage.tsx` loads the summary (line 48) and pendency (line 51)
   and exports `/reports/consolidated?format=csv` (line 91). The test asserts HTTP 200,
   `text/csv`, the `Section,Key,Value` header, at least one data row, and the pendency key.

## Playwright coverage

`tests/e2e/workflow.spec.ts` — one serial end-to-end test:

- first-run `/setup` creates the only administrator;
- admin enters a routing rule, a state-to-region mapping, and a document requirement;
- admin creates an institution, an officer, and a college user;
- college creates an application, uploads a document, and submits;
- officer requests a correction with a comment;
- college uploads the missing document and resubmits;
- officer approves the document, moves the case to Under Review, then Approved;
- admin sees the `to: APPROVED` audit entry.

`tests/e2e/accessibility.spec.ts` — axe checks for serious/critical violations on 15
pages: the anonymous public landing (`/`), plus 14 authenticated dashboard pages:

`/overview`, `/applications`, `/verification`, `/compliance`, `/inspections`, `/notifications`,
`/analytics`, `/audit`, `/users`, `/institutions`, `/routing`, `/requirements`, `/settings`,
`/undertakings`.

Fix applied during the audit: active filter counts overrode the button colour with
`text-blue-100` (4.29:1), and several filters/forms lacked accessible names. The active count
is now white, and filter selects/date/description inputs have labels or `aria-label`s.

## Test inventory

`tests/api.test.ts` (16 tests):

1. login rate limiting — 429 on the fourth attempt and a different IP unaffected
2. routing and stage transitions — `UNASSIGNED` fallback, configured route, stage changes
3. pendency scoping — officer vs admin totals
4. overview totals — summary shape and non-empty status counts
5. EVC queue — inclusion/exclusion, scheduling, completion
6. undertakings — create, list, evidence, verify, reject, college denial, overdue
7. expiring documents — 10-day included, 90-day excluded
8. consolidated CSV — content type, header, rows
9. admin jobs — officer 403, admin 200 with counts
10. compliance score — zero with missing requirements
11. submission gate — blocked with missing documents
12. correction comment gate
13. institution scoping — foreign application returns 404
14. upload validation — fake PDF rejected by magic bytes
15. approval gate — blocked until every required document is approved
16. scheduler idempotency — no duplicate reminders on a second run

## Not verified

- The Docker image build and container run. The Docker CLI and Compose are installed, but the
  Docker Desktop daemon could not be started without administrator rights (see
  `docs/LIMITATIONS.md`). The Dockerfile and compose file were updated for the PostgreSQL
  schema and runtime dependencies but were not executed.
- A live PostgreSQL migration. Local PostgreSQL is unavailable; the SQLite suite is the
  executed database path.
- Manual screen-reader testing. Automated axe checks cover serious/critical issues only.
