import { Page, expect } from '@playwright/test';

export const ADMIN = {
  name: 'AICTE Administrator',
  email: 'admin@e2e.test',
  password: 'E2eAdminPass123!',
};

export const OFFICER = {
  name: 'EVC Officer',
  email: 'officer@e2e.test',
  password: 'E2eOfficerPass123!',
};

export const COLLEGE = {
  name: 'Sunrise College User',
  email: 'college@e2e.test',
  password: 'E2eCollegePass123!',
};

export const INSTITUTION = 'Sunrise Institute of Technology';

export const PDF = Buffer.from('%PDF-1.4\nFlowPilot end-to-end test document\n%%EOF');

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Institutional Overview' })).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function openApplication(page: Page, refId: string) {
  await page.goto('/applications');
  await expect(page.getByText(refId).first()).toBeVisible();
  await page.getByText(refId).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

export async function uploadDocument(page: Page, file: Buffer, name: string, docType: string) {
  await page.goto('/verification');
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await page.getByLabel('Document Type').selectOption({ label: docType });
  await page.locator('#fileInput').setInputFiles({ name, mimeType: 'application/pdf', buffer: file });
  await page.getByRole('button', { name: 'Submit for Verification' }).click();
  await expect(page.getByText(`${docType} uploaded and queued for officer verification.`)).toBeVisible();
}
