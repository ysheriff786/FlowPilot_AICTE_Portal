# PS Coverage Report

This document maps UI screens to API endpoints and tests for each section (A-F).

## Legend

- **UI Screen** = Frontend component file and component name
- **API Endpoint** = HTTP method and path
- **Test** = Test file and test name (if applicable)

## Section A: Overview

| UI Screen | API Endpoint | Test |
|-----------|--------------|------|
| OverviewPage.tsx - `OverviewPage` | GET /api/analytics/pendency | pendency > returns stages |

**Status**: 100%
- Component exists at `src/frontend/pages/OverviewPage.tsx`
- Line 59 calls: `const p = await api.get('/analytics/pendency');`
- Test `pendency` in `tests/api.test.ts` asserts this endpoint returns stages array

## Section B: Inspections

| UI Screen | API Endpoint | Test |
|-----------|--------------|------|
| InspectionsPage.tsx - `InspectionsPage` | GET /api/inspections/queue | inspections queue > returns array |

**Status**: 100%
- Component exists at `src/frontend/pages/InspectionsPage.tsx`
- Line 51 calls: `const q = await api.get('/inspections/queue');`
- Test `inspections queue` in `tests/api.test.ts` asserts this endpoint returns an array

## Section C: Compliance

| UI Screen | API Endpoint | Test |
|-----------|--------------|------|
| CompliancePage.tsx - `CompliancePage` | GET /api/documents/expiring?days=30 | documents expiring > returns array |

**Status**: 100%
- Component exists at `src/frontend/pages/CompliancePage.tsx`
- Line 50-54 calls: `const exp = await api.get('/documents/expiring?days=30');`
- Test `documents expiring` in `tests/api.test.ts` asserts this endpoint returns an array

## Section D: Undertakings

| UI Screen | API Endpoint | Test |
|-----------|--------------|------|
| UndertakingsPage.tsx - `UndertakingsPage` | GET /api/undertakings | NOT TESTED |

| Create Undertaking | API Endpoint | Test |
|--------------------|--------------|------|
| UndertakingsPage.tsx - `create` function | POST /api/undertakings | NOT TESTED |

| Verify Undertaking | API Endpoint | Test |
|--------------------|--------------|------|
| UndertakingsPage.tsx - `Verify` button handler | PATCH /api/undertakings/:id | NOT TESTED |

**Status**: 0%
- Component exists at `src/frontend/pages/UndertakingsPage.tsx`
- GET endpoint exists but has no test asserting its behavior
- POST endpoint exists but has no test
- PATCH endpoint exists but has no test

## Section E: Settings

| UI Screen | API Endpoint | Test |
|-----------|--------------|------|
| SettingsPage.tsx - `Run scheduled checks now` button | POST /api/admin/run-jobs | scheduler idempotency > runs twice without duplicate reminders |

**Status**: 100%
- Component exists at `src/frontend/pages/SettingsPage.tsx`
- Line 225 calls: `await api.post('/admin/run-jobs');`
- Test `scheduler idempotency` in `tests/api.test.ts` asserts `runJobs` is idempotent

**Note**: The test does not assert the POST endpoint returns 200, it calls the scheduler directly. The endpoint itself is tested indirectly.

## Section F: Analytics

| UI Screen | API Endpoint | Test |
|-----------|--------------|------|
| AnalyticsPage.tsx - `Export report` button | GET /api/reports/consolidated?format=csv | NOT TESTED |

**Status**: 0%
- Component exists at `src/frontend/pages/AnalyticsPage.tsx`
- Lines 89-97 handle CSV export:
```typescript
const res = await api.get('/reports/consolidated?format=csv', { responseType: 'blob' });
```
- No test exists for this endpoint

## Summary Scores

| Section | Score | Reason |
|---------|-------|--------|
| A (Overview) | 100 | UI screen, API endpoint, and test all present |
| B (Inspections) | 100 | UI screen, API endpoint, and test all present |
| C (Compliance) | 100 | UI screen, API endpoint, and test all present |
| D (Undertakings) | 0 | No test exists for any undertake endpoint |
| E (Settings) | 80 | UI screen and endpoint exist; test calls scheduler directly not via HTTP |
| F (Analytics) | 0 | No test exists for CSV export endpoint |

**Total Coverage**: 33% (2/6 sections with 100% coverage, 1 with partial)

## Notes

1. The rate limiter is configured and active in tests via `LOGIN_RATE_MAX` and `LOGIN_RATE_WINDOW_MINUTES` environment variables
2. Some tests fail due to rate limiting from multiple login attempts in rapid succession
3. The `resolveRoute UNASSIGNED` test exists and passes for routing logic
4. Missing tests: undertakings CRUD and CSV export endpoint
