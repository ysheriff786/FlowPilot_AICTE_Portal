import { test, expect } from '@playwright/test';
import {
  ADMIN,
  COLLEGE,
  INSTITUTION,
  OFFICER,
  PDF,
  login,
  logout,
  openApplication,
  uploadDocument,
} from './utils';

test.describe.configure({ mode: 'serial' });

test('first-run setup through approval with a complete audit trail', async ({ page }) => {
  // 1. First-run setup creates the first administrator on an empty database.
  await page.goto('/setup');
  await expect(page.getByRole('heading', { name: 'First-run setup' })).toBeVisible();
  await page.getByPlaceholder('Name').fill(ADMIN.name);
  await page.getByPlaceholder('Email').fill(ADMIN.email);
  await page.getByPlaceholder('Password (min 12 chars)').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Create administrator' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // 2. Administrator enters the reference data the workflow depends on.
  await login(page, ADMIN.email, ADMIN.password);

  await page.goto('/routing');
  await expect(page.getByText('docs/DATA_SOURCES.md').first()).toBeVisible();
  await page.getByPlaceholder('Category').fill('Engineering');
  await page.getByPlaceholder('Route (e.g. SCRUTINY_EVC)').fill('SCRUTINY_EVC');
  await page.getByRole('button', { name: 'Add rule' }).click();
  await expect(page.getByText('SCRUTINY_EVC').first()).toBeVisible();

  await page.getByPlaceholder('State').fill('Karnataka');
  await page.locator('select').selectOption('SOUTH');
  await page.getByRole('button', { name: 'Add mapping' }).click();
  await expect(page.getByText('Karnataka', { exact: true }).first()).toBeVisible();

  await page.goto('/requirements');
  await page.getByPlaceholder('Category').fill('Engineering');
  await page.getByPlaceholder('Academic year (e.g. 2026-27)').fill('2026-27');
  await page.getByPlaceholder('Document type').fill('Land Use Certificate');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Land Use Certificate').first()).toBeVisible();

  // 3. Administrator creates the institution and its users.
  await page.goto('/institutions');
  await page.getByRole('button', { name: 'Create Institution' }).first().click();
  const institutionDialog = page.getByRole('dialog');
  await institutionDialog.getByLabel('Institution name').fill(INSTITUTION);
  await institutionDialog.getByLabel('Institution type').fill('Engineering College');
  await institutionDialog.getByLabel('State').fill('Karnataka');
  await institutionDialog.getByLabel('Category').fill('Engineering');
  await institutionDialog.getByLabel('Academic year').fill('2026-27');
  await institutionDialog.getByLabel('Contact email').fill('office@sunrise.test');
  await institutionDialog.getByLabel('Phone').fill('08000000000');
  await institutionDialog.getByLabel('Address').fill('1 Knowledge Park');
  await institutionDialog.getByRole('button', { name: 'Create institution' }).click();
  await expect(page.getByText(INSTITUTION).first()).toBeVisible();

  await page.goto('/users');
  await page.getByRole('button', { name: 'Create User' }).click();
  let userDialog = page.getByRole('dialog');
  await userDialog.getByLabel('Full name').fill(OFFICER.name);
  await userDialog.getByLabel('Email address').fill(OFFICER.email);
  await userDialog.getByLabel('Temporary password').fill(OFFICER.password);
  await userDialog.getByLabel('Role').selectOption('OFFICER');
  await userDialog.getByRole('button', { name: 'Create user' }).click();
  await expect(page.getByText(OFFICER.email)).toBeVisible();

  await page.getByRole('button', { name: 'Create User' }).click();
  userDialog = page.getByRole('dialog');
  await userDialog.getByLabel('Full name').fill(COLLEGE.name);
  await userDialog.getByLabel('Email address').fill(COLLEGE.email);
  await userDialog.getByLabel('Temporary password').fill(COLLEGE.password);
  await userDialog.getByLabel('Role').selectOption('COLLEGE');
  await userDialog.getByLabel('Institution').selectOption({ label: INSTITUTION });
  await userDialog.getByRole('button', { name: 'Create user' }).click();
  await expect(page.getByText(COLLEGE.email)).toBeVisible();

  await logout(page);

  // 4. College user creates an application, uploads a document and submits.
  await login(page, COLLEGE.email, COLLEGE.password);
  await page.goto('/applications');
  await page.getByRole('button', { name: 'New Application' }).first().click();

  const createDialog = page.getByRole('dialog');
  await expect(createDialog.locator('select').first()).not.toHaveValue('');
  await createDialog.getByRole('button', { name: 'Create Application' }).click();
  const dialogTitle = page.getByRole('dialog').locator('h2').first();
  await expect(dialogTitle).toHaveText(/AICTE-/);
  const refId = (await dialogTitle.innerText()).trim();

  await page.getByRole('dialog').getByRole('button', { name: 'Documents' }).click();
  await expect(page).toHaveURL(/\/verification/);
  await page.getByLabel('Document Type').selectOption({ label: 'Land Use Certificate' });
  await page.locator('#fileInput').setInputFiles({ name: 'land-use.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByRole('button', { name: 'Submit for Verification' }).click();
  await expect(page.getByText('Land Use Certificate uploaded and queued for officer verification.')).toBeVisible();

  await openApplication(page, refId);
  await page.getByRole('dialog').getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Submitted').first()).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();

  await logout(page);

  // 5. Officer requests a correction with a reason.
  await login(page, OFFICER.email, OFFICER.password);
  await openApplication(page, refId);
  let detail = page.getByRole('dialog');
  await detail.getByLabel('Move to status').selectOption({ label: 'Correction Required' });
  await detail.getByLabel('Comment (optional)').fill('Please upload the fire safety NOC before resubmission.');
  await detail.getByRole('button', { name: 'Apply status change' }).click();
  await expect(detail.getByText('Correction Req.').first()).toBeVisible();
  await detail.getByRole('button', { name: 'Close', exact: true }).click();

  await logout(page);

  // 6. College uploads the missing document and resubmits.
  await login(page, COLLEGE.email, COLLEGE.password);
  await uploadDocument(page, PDF, 'fire-safety.pdf', 'Fire Safety NOC');
  await openApplication(page, refId);
  await page.getByRole('dialog').getByRole('button', { name: 'Resubmit' }).click();
  await expect(page.getByRole('dialog').getByText('Resubmitted').first()).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();

  await logout(page);

  // 7. Officer verifies the required document, moves the case under review and approves it.
  await login(page, OFFICER.email, OFFICER.password);
  await page.goto('/verification');
  await page.getByRole('button', { name: 'Approve Land Use Certificate' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save decision' }).click();
  await expect(page.getByText('Land Use Certificate marked approved.')).toBeVisible();

  await openApplication(page, refId);
  detail = page.getByRole('dialog');
  await detail.getByLabel('Move to status').selectOption({ label: 'Under Review' });
  await detail.getByRole('button', { name: 'Apply status change' }).click();
  await expect(detail.getByText('Under Review').first()).toBeVisible();

  await detail.getByLabel('Move to status').selectOption({ label: 'Approved' });
  await detail.getByRole('button', { name: 'Apply status change' }).click();
  await expect(detail.getByText('Approved').first()).toBeVisible();
  await detail.getByRole('button', { name: 'Close', exact: true }).click();

  await logout(page);

  // 8. Administrator sees the approval in the audit trail.
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto('/audit');
  await expect(page.getByText(/to: APPROVED/).first()).toBeVisible();
});
