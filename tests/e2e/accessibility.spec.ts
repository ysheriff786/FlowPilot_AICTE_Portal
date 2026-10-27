import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ADMIN, login } from './utils';

const PAGES = [
  { path: '/overview', heading: 'Institutional Overview' },
  { path: '/applications', heading: 'Applications' },
  { path: '/verification', heading: 'Document Verification Studio' },
  { path: '/compliance', heading: 'Compliance Monitor' },
  { path: '/inspections', heading: 'Expert Committee Inspections' },
  { path: '/notifications', heading: 'Notifications' },
  { path: '/analytics', heading: 'Analytics & Intelligence' },
  { path: '/audit', heading: 'Audit Trail' },
  { path: '/users', heading: 'Users' },
  { path: '/institutions', heading: 'Institutions' },
  { path: '/routing', heading: 'Routing rules' },
  { path: '/requirements', heading: 'Document requirements' },
  { path: '/settings', heading: 'Settings' },
  { path: '/undertakings', heading: 'Time-bound Undertakings' },
];

async function auditPage(page: Page) {
  await page.waitForLoadState('networkidle');

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical'
  );

  const summary = blocking.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help} → ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join(', ')}`
  );

  return { blocking, summary };
}

test.describe('public landing', () => {
  test('no serious or critical accessibility violations on /', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: /AICTE approvals/i })
    ).toBeVisible();
    await expect(page.locator('header a[href="/login"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/login"], footer a[href="/login"]')).toHaveCount(0);

    const { blocking, summary } = await auditPage(page);
    expect(blocking, `/ accessibility violations:\n${summary.join('\n')}`).toEqual([]);
  });
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  for (const entry of PAGES) {
    test(`no serious or critical accessibility violations on ${entry.path}`, async ({ page }) => {
      await page.goto(entry.path);
      await expect(page.getByRole('heading', { level: 1, name: entry.heading }).first()).toBeVisible();

      const { blocking, summary } = await auditPage(page);
      expect(blocking, `${entry.path} accessibility violations:\n${summary.join('\n')}`).toEqual([]);
    });
  }
});
