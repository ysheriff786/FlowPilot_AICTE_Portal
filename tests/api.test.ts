import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.resolve('prisma/test.db');
const TEST_UPLOADS = path.resolve('uploads/test');

process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!';
process.env.NODE_ENV = 'test';
process.env.ENABLE_SCHEDULER = 'false';
process.env.UPLOAD_DIR = 'uploads/test';
// Low limit so the rate-limit test can hit it quickly. Every other login uses
// a unique X-Forwarded-For value, so tests do not share a limiter bucket.
process.env.LOGIN_RATE_MAX = '3';
process.env.LOGIN_RATE_WINDOW_MINUTES = '15';

let app: any;
let prisma: any;
let request: any;
let officerId = '';
let adminId = '';
let collegeId = '';
let institutionId = '';
let refCounter = 0;

let ipCounter = 0;
const uniqueIp = () => `10.20.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

async function login(email: string, password: string, ip = uniqueIp()) {
  const res = await request
    .post('/api/auth/login')
    .set('X-Forwarded-For', ip)
    .send({ email, password });
  return res.body.token;
}

const nextRefId = (prefix = 'TEST') => `${prefix}-${Date.now()}-${refCounter++}`;

async function createApplicationRow(overrides: Record<string, unknown> = {}) {
  return prisma.application.create({
    data: {
      refId: nextRefId(),
      institutionId,
      academicYear: '2026-27',
      category: 'Architecture',
      status: 'SUBMITTED',
      stage: 'SCRUTINY',
      deadline: new Date(Date.now() + 7 * 86400000),
      ...overrides,
    },
  });
}

beforeAll(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  fs.rmSync(TEST_UPLOADS, { recursive: true, force: true });

  const { execSync } = await import('child_process');
  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });

  const mod = await import('../src/backend/server');
  app = mod.app;
  prisma = mod.prisma;
  const supertest = await import('supertest');
  request = supertest.default(app);

  const bcrypt = await import('bcryptjs');
  const hash = (value: string) => bcrypt.default.hash(value, 10);

  const institution = await prisma.institution.create({
    data: {
      name: 'Test Institute of Technology',
      type: 'Engineering College',
      address: '1 Test Road',
      state: 'Karnataka',
      region: 'SOUTH',
      isNew: false,
      email: 'office@test.local',
      phone: '0000000000',
      category: 'Engineering',
      academicYear: '2026-27',
    },
  });
  institutionId = institution.id;

  await prisma.documentRequirement.createMany({
    data: [
      { category: 'Engineering', academicYear: '2026-27', docType: 'Land Use Certificate', isRequired: true },
      { category: 'Engineering', academicYear: '2026-27', docType: 'Fire Safety NOC', isRequired: true },
    ],
  });

  const admin = await prisma.user.create({
    data: { email: 'admin@test.local', password: await hash('AdminPass123!'), name: 'Admin', role: 'ADMIN' },
  });
  const officer = await prisma.user.create({
    data: { email: 'officer@test.local', password: await hash('OfficerPass123!'), name: 'Officer', role: 'OFFICER' },
  });
  const college = await prisma.user.create({
    data: {
      email: 'college@test.local',
      password: await hash('CollegePass123!'),
      name: 'College User',
      role: 'COLLEGE',
      institutionId,
    },
  });

  adminId = admin.id;
  officerId = officer.id;
  collegeId = college.id;
}, 120000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  fs.rmSync(TEST_UPLOADS, { recursive: true, force: true });
});

describe('login rate limiting', () => {
  it('allows 3 attempts and returns 429 on the fourth from the same IP', async () => {
    const ip = '203.0.113.50';
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const res = await request
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'admin@test.local', password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    const blocked = await request
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'admin@test.local', password: 'wrong-password' });
    expect(blocked.status).toBe(429);

    // The limiter keys on client IP, so a different IP is not blocked.
    const otherIp = await request
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.51')
      .send({ email: 'admin@test.local', password: 'AdminPass123!' });
    expect(otherIp.status).toBe(200);
  });
});

describe('routing and stage transitions', () => {
  it('assigns UNASSIGNED without a rule, uses the configured rule, and updates stage per status change', async () => {
    await prisma.routingRule.deleteMany({ where: { category: 'Engineering', isNew: false } });

    const collegeToken = await login('college@test.local', 'CollegePass123!');
    const unassigned = await request
      .post('/api/applications')
      .set('Authorization', `Bearer ${collegeToken}`)
      .send({
        academicYear: '2026-27',
        category: 'Engineering',
        deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
      });
    expect(unassigned.status).toBe(201);
    expect(unassigned.body.route).toBe('UNASSIGNED');

    const adminToken = await login('admin@test.local', 'AdminPass123!');
    const rule = await request
      .post('/api/routing/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'Engineering', isNew: false, route: 'SCRUTINY_EVC' });
    expect(rule.status).toBe(201);

    const routed = await request
      .post('/api/applications')
      .set('Authorization', `Bearer ${collegeToken}`)
      .send({
        academicYear: '2026-27',
        category: 'Engineering',
        deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
      });
    expect(routed.status).toBe(201);
    expect(routed.body.route).toBe('SCRUTINY_EVC');

    const officerToken = await login('officer@test.local', 'OfficerPass123!');
    const app = await createApplicationRow({ status: 'SUBMITTED', stage: 'SCRUTINY', assignedOfficerId: officerId });

    const review = await request
      .patch(`/api/applications/${app.id}/status`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ status: 'UNDER_REVIEW' });
    expect(review.status).toBe(200);
    expect(review.body.stage).toBe('SCRUTINY');

    const evc = await request
      .patch(`/api/applications/${app.id}/status`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ status: 'INSPECTION_PENDING' });
    expect(evc.status).toBe(200);
    expect(evc.body.stage).toBe('EVC');

    const approved = await request
      .patch(`/api/applications/${app.id}/status`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ status: 'APPROVED' });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.stage).toBe('DONE');
  });
});

describe('pendency is scoped to the caller', () => {
  it('shows an officer only their assigned applications and an admin all applications', async () => {
    const bcrypt = await import('bcryptjs');
    const scopedOfficer = await prisma.user.create({
      data: {
        email: `scoped-officer-${Date.now()}@test.local`,
        password: await bcrypt.default.hash('ScopedPass123!', 10),
        name: 'Scoped Officer',
        role: 'OFFICER',
      },
    });

    await createApplicationRow({ assignedOfficerId: scopedOfficer.id, stage: 'SCRUTINY', status: 'SUBMITTED' });
    await createApplicationRow({ assignedOfficerId: null, stage: 'SCRUTINY', status: 'SUBMITTED' });

    const officerToken = await login(scopedOfficer.email, 'ScopedPass123!');
    const officerView = await request
      .get('/api/analytics/pendency')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(officerView.status).toBe(200);
    const officerTotal = officerView.body.stages.reduce((sum: number, stage: any) => sum + stage.count, 0);
    expect(officerTotal).toBe(1);
    expect(officerView.body.officerPendency).toEqual([]);

    const adminToken = await login('admin@test.local', 'AdminPass123!');
    const adminView = await request
      .get('/api/analytics/pendency')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminView.status).toBe(200);
    const adminTotal = adminView.body.stages.reduce((sum: number, stage: any) => sum + stage.count, 0);
    expect(adminTotal).toBeGreaterThan(officerTotal);
    expect(Array.isArray(adminView.body.officerPendency)).toBe(true);
  });

  it('returns the overview totals that the Overview screen renders', async () => {
    const adminToken = await login('admin@test.local', 'AdminPass123!');
    const res = await request
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totals.applications).toBeGreaterThan(0);
    expect(res.body.applicationsByStatus.some((entry: any) => entry.count > 0)).toBe(true);
    expect(res.body.documentsByStatus).toHaveLength(5);
    expect(typeof res.body.compliance.averageScore).toBe('number');
    expect(Array.isArray(res.body.upcomingDeadlines)).toBe(true);
  });
});

describe('EVC inspection queue', () => {
  it('includes EVC applications without a scheduled inspection and excludes those with one', async () => {
    const awaiting = await createApplicationRow({ stage: 'EVC', status: 'INSPECTION_PENDING' });
    const scheduled = await createApplicationRow({ stage: 'EVC', status: 'INSPECTION_PENDING' });
    await prisma.inspection.create({
      data: {
        applicationId: scheduled.id,
        type: 'EVC',
        inspectionDate: new Date(Date.now() + 2 * 86400000),
        location: 'Campus',
        status: 'SCHEDULED',
      },
    });

    const adminToken = await login('admin@test.local', 'AdminPass123!');
    const queue = await request
      .get('/api/inspections/queue')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(queue.status).toBe(200);
    const ids = queue.body.map((entry: any) => entry.id);
    expect(ids).toContain(awaiting.id);
    expect(ids).not.toContain(scheduled.id);

    // Scheduling from the Inspections screen must create a SCHEDULED record and
    // completing it must be reflected through PATCH /inspections/:id.
    const schedule = await request
      .post('/api/inspections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        applicationId: awaiting.id,
        type: 'EVC',
        inspectionDate: new Date(Date.now() + 2 * 86400000).toISOString(),
        location: 'Main campus, Bengaluru',
      });
    expect(schedule.status).toBe(201);
    expect(schedule.body.status).toBe('SCHEDULED');

    const completed = await request
      .patch(`/api/inspections/${schedule.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'COMPLETED' });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('COMPLETED');
  });
});

describe('undertakings lifecycle', () => {
  it('creates, uploads evidence, verifies, and lets the scheduler mark overdue', async () => {
    const adminToken = await login('admin@test.local', 'AdminPass123!');
    const collegeToken = await login('college@test.local', 'CollegePass123!');

    const approvedApp = await createApplicationRow({ status: 'APPROVED', stage: 'DONE' });

    const created = await request
      .post('/api/undertakings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        applicationId: approvedApp.id,
        description: 'Submit the fire safety renewal certificate',
        dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('PENDING');

    const listed = await request
      .get('/api/undertakings')
      .set('Authorization', `Bearer ${collegeToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.some((entry: any) => entry.id === created.body.id)).toBe(true);

    const evidence = await request
      .post(`/api/undertakings/${created.body.id}/evidence`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('%PDF-1.4 undertaking evidence'), 'evidence.pdf');
    expect(evidence.status).toBe(201);

    const submitted = await prisma.undertaking.findUnique({ where: { id: created.body.id } });
    expect(submitted.status).toBe('SUBMITTED');
    expect(submitted.evidenceDocumentId).toBe(evidence.body.id);

    const verified = await request
      .patch(`/api/undertakings/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'VERIFIED' });
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe('VERIFIED');

    const collegeDenied = await request
      .patch(`/api/undertakings/${created.body.id}`)
      .set('Authorization', `Bearer ${collegeToken}`)
      .send({ status: 'VERIFIED' });
    expect(collegeDenied.status).toBe(403);

    // The Undertakings screen exposes a Reject action; it must round-trip.
    const rejectable = await request
      .post('/api/undertakings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        applicationId: approvedApp.id,
        description: 'Undertaking rejected from the UI',
        dueDate: new Date(Date.now() + 6 * 86400000).toISOString(),
      });
    const rejected = await request
      .patch(`/api/undertakings/${rejectable.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('REJECTED');

    const overdue = await request
      .post('/api/undertakings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        applicationId: approvedApp.id,
        description: 'Overdue undertaking fixture',
        dueDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      });
    expect(overdue.status).toBe(201);

    const notificationsBefore = await prisma.notification.count({
      where: { userId: collegeId, type: 'UNDERTAKING' },
    });

    const { runJobs } = await import('../src/backend/jobs/scheduler');
    await runJobs();

    const afterRun = await prisma.undertaking.findUnique({ where: { id: overdue.body.id } });
    expect(afterRun.status).toBe('OVERDUE');

    const notificationsAfter = await prisma.notification.count({
      where: { userId: collegeId, type: 'UNDERTAKING' },
    });
    expect(notificationsAfter).toBeGreaterThan(notificationsBefore);
  });
});

describe('expiring documents', () => {
  it('returns a document expiring in 10 days and not one expiring in 90 days', async () => {
    const app = await createApplicationRow({ status: 'APPROVED', stage: 'DONE' });
    const soon = await prisma.applicationDocument.create({
      data: {
        applicationId: app.id,
        docType: 'Fire Safety NOC',
        status: 'APPROVED',
        filePath: 'uploads/test/soon.pdf',
        expiryDate: new Date(Date.now() + 10 * 86400000),
      },
    });
    const later = await prisma.applicationDocument.create({
      data: {
        applicationId: app.id,
        docType: 'Land Use Certificate',
        status: 'APPROVED',
        filePath: 'uploads/test/later.pdf',
        expiryDate: new Date(Date.now() + 90 * 86400000),
      },
    });

    const adminToken = await login('admin@test.local', 'AdminPass123!');
    const res = await request
      .get('/api/documents/expiring?days=30')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((entry: any) => entry.id);
    expect(ids).toContain(soon.id);
    expect(ids).not.toContain(later.id);
  });
});

describe('consolidated report and manual jobs', () => {
  it('returns CSV with a header and at least one data row', async () => {
    await createApplicationRow({ status: 'SUBMITTED', stage: 'SCRUTINY' });
    const adminToken = await login('admin@test.local', 'AdminPass123!');
    const res = await request
      .get('/api/reports/consolidated?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.split('\n').filter(Boolean);
    expect(lines[0]).toBe('Section,Key,Value');
    expect(lines.length).toBeGreaterThan(1);
    expect(res.text).toContain('pendencyByStage');
  });

  it('rejects officers and allows admins to run scheduled checks', async () => {
    const officerToken = await login('officer@test.local', 'OfficerPass123!');
    const denied = await request
      .post('/api/admin/run-jobs')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(denied.status).toBe(403);

    const adminToken = await login('admin@test.local', 'AdminPass123!');
    const allowed = await request
      .post('/api/admin/run-jobs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.counts).toBeDefined();
    expect(typeof allowed.body.counts.applicationsChecked).toBe('number');
  });
});

describe('workflow and compliance gates', () => {
  it('reports a zero compliance score while required documents are missing', async () => {
    const token = await login('college@test.local', 'CollegePass123!');
    const create = await request
      .post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        academicYear: '2026-27',
        category: 'Engineering',
        deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
      });
    expect(create.status).toBe(201);

    const compliance = await request
      .get(`/api/documents/compliance/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(compliance.body.score).toBe(0);
    expect(compliance.body.missingRequired).toContain('Land Use Certificate');
  });

  it('blocks submission when required documents are missing', async () => {
    const token = await login('college@test.local', 'CollegePass123!');
    const create = await request
      .post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        academicYear: '2026-27',
        category: 'Engineering',
        deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
      });

    const submit = await request
      .post(`/api/applications/${create.body.id}/submit`)
      .set('Authorization', `Bearer ${token}`);
    expect(submit.status).toBe(400);
    expect(submit.body.missing).toBeDefined();
  });

  it('requires a comment when requesting a correction', async () => {
    const token = await login('officer@test.local', 'OfficerPass123!');
    const res = await request
      .patch('/api/applications/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CORRECTION_REQUIRED' });
    expect([400, 404]).toContain(res.status);
  });

  it('does not expose another institution application to a college user', async () => {
    const token = await login('college@test.local', 'CollegePass123!');
    const res = await request
      .get('/api/applications/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('rejects a fake PDF using magic-byte validation', async () => {
    const token = await login('college@test.local', 'CollegePass123!');
    const create = await request
      .post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        academicYear: '2026-27',
        category: 'Engineering',
        deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
      });

    const res = await request
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('applicationId', create.body.id)
      .field('docType', 'Land Use Certificate')
      .attach('file', Buffer.from('not a pdf'), 'fake.pdf');
    expect(res.status).toBe(400);
  });

  it('blocks approval until every required document is approved', async () => {
    const collegeToken = await login('college@test.local', 'CollegePass123!');
    const create = await request
      .post('/api/applications')
      .set('Authorization', `Bearer ${collegeToken}`)
      .send({
        academicYear: '2026-27',
        category: 'Engineering',
        deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
      });
    const appId = create.body.id;

    const pdf = Buffer.from('%PDF-1.4 test');
    for (const docType of ['Land Use Certificate', 'Fire Safety NOC']) {
      const upload = await request
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${collegeToken}`)
        .field('applicationId', appId)
        .field('docType', docType)
        .attach('file', pdf, `${docType}.pdf`);
      expect(upload.status).toBe(201);
    }

    const submit = await request
      .post(`/api/applications/${appId}/submit`)
      .set('Authorization', `Bearer ${collegeToken}`);
    expect(submit.status).toBe(200);

    const officerToken = await login('officer@test.local', 'OfficerPass123!');
    await request
      .patch(`/api/applications/${appId}/status`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ status: 'UNDER_REVIEW' });

    const approve = await request
      .patch(`/api/applications/${appId}/status`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ status: 'APPROVED' });
    expect(approve.status).toBe(400);
    expect(approve.body.missing).toBeDefined();
  });

  it('runs the scheduler twice without creating duplicate reminders', async () => {
    const { runJobs } = await import('../src/backend/jobs/scheduler');
    await runJobs();
    const first = await prisma.reminderLog.count();
    await runJobs();
    const second = await prisma.reminderLog.count();
    expect(second).toBe(first);
  });
});
