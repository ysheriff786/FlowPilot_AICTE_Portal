import { beforeAll, afterAll, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.resolve('prisma/test.db');
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!';
process.env.NODE_ENV = 'test';
process.env.ENABLE_SCHEDULER = 'false';
// Rate limiter config - high for tests to avoid interference
process.env.LOGIN_RATE_MAX = '100';
process.env.LOGIN_RATE_WINDOW_MINUTES = '60';

let app: any;
let prisma: any;
let request: any;

beforeAll(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const { execSync } = await import('child_process');
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: 'file:./test.db' } });
  const mod = await import('../src/backend/server');
  app = mod.app;
  prisma = mod.prisma;
  const supertest = await import('supertest');
  request = supertest.default(app);

  const bcrypt = await import('bcryptjs');

  // Create institutions
  const southInst = await prisma.institution.create({
    data: { name: 'South Inst', type: 'Engineering College', address: 'x', state: 'Karnataka', region: 'SOUTH', isNew: false, email: 'south@inst.edu', phone: '1', category: 'Engineering', academicYear: '2026-27' },
  });
  const northInst = await prisma.institution.create({
    data: { name: 'North Inst', type: 'Engineering College', address: 'y', state: 'Maharashtra', region: 'NORTH', isNew: true, email: 'north@inst.edu', phone: '2', category: 'Engineering', academicYear: '2026-27' },
  });

  // Create routing rule: Engineering new -> SAC_SHC, Engineering existing -> EVC
  await prisma.routingRule.create({
    data: {
      category: 'Engineering',
      isNew: true,
      route: 'SAC_SHC',
    },
  });
  await prisma.routingRule.create({
    data: {
      category: 'Engineering',
      isNew: false,
      route: 'EVC',
    },
  });

  // Create document requirements
  for (const d of ['Land Use Certificate', 'Fire Safety NOC']) {
    await prisma.documentRequirement.create({ data: { category: 'Engineering', academicYear: '2026-27', docType: d, isRequired: true } });
  }

  // Create users
  const adminPw = await bcrypt.default.hash('Admin@123', 10);
  const officerPw = await bcrypt.default.hash('Officer@123', 10);
  const collegePw = await bcrypt.default.hash('College@123', 10);

  const admin = await prisma.user.create({
    data: { email: 'admin@flowpilot.gov', password: adminPw, name: 'Admin', role: 'ADMIN' },
  });
  const officer = await prisma.user.create({
    data: { email: 'officer@flowpilot.gov', password: officerPw, name: 'Officer', role: 'OFFICER' },
  });
  await prisma.user.create({
    data: { email: 'college@sunrise.edu', password: collegePw, name: 'College', role: 'COLLEGE', institutionId: southInst.id },
  });
  await prisma.user.create({
    data: { email: 'college@north.edu', password: collegePw, name: 'North College', role: 'COLLEGE', institutionId: northInst.id },
  });

  (global as any).__officerId = officer.id;
  (global as any).__adminId = admin.id;
  (global as any).__southInstId = southInst.id;
  (global as any).__northInstId = northInst.id;
}, 120000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

async function login(email: string, password: string) {
  const res = await request.post('/api/auth/login').send({ email, password });
  return res.body.token;
}

// ============================================================================
// SECTION A: Routing Rules and Stage Management
// ============================================================================
describe('section A: routing rules', () => {
  it('application with no routing rule gets UNASSIGNED', async () => {
    const { resolveRoute } = await import('../src/backend/lib/routing');
    const r = await resolveRoute('ZZZ', true);
    expect(r).toBe('UNASSIGNED');
  });

  it('application with routing rule gets configured route', async () => {
    const { resolveRoute } = await import('../src/backend/lib/routing');
    // Engineering new -> SAC_SHC (from rule)
    const r1 = await resolveRoute('Engineering', true);
    expect(r1).toBe('SAC_SHC');
    // Engineering existing -> EVC (from rule)
    const r2 = await resolveRoute('Engineering', false);
    expect(r2).toBe('EVC');
  });

  it('stage updates on status change', async () => {
    const collegeToken = await login('college@sunrise.edu', 'College@123');
    const instId = (global as any).__southInstId;

    // Create application - stage is SCRUTINY for DRAFT
    const create = await request.post('/api/applications').set('Authorization', `Bearer ${collegeToken}`).send({
      institutionId: instId,
      academicYear: '2026-27',
      category: 'Engineering',
      isNew: true,
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    });

    expect(create.status).toBe(201);
    const appId = create.body.id;
    expect(create.body.stage).toBe('SCRUTINY'); // Draft -> SCRUTINY stage

    // Upload required document and submit
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Land Use Certificate').attach('file', Buffer.from('%PDF-1.4'), 'a.pdf');
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Fire Safety NOC').attach('file', Buffer.from('%PDF-1.4'), 'b.pdf');

    const sub = await request.post(`/api/applications/${appId}/submit`).set('Authorization', `Bearer ${collegeToken}`);
    expect(sub.status).toBe(200);
    expect(sub.body.stage).toBe('SCRUTINY');
    expect(sub.body.status).toBe('SUBMITTED');

    // Admin changes status to UNDER_REVIEW -> stage stays SCRUTINY
    const adminToken = await login('admin@flowpilot.gov', 'Admin@123');
    const upd1 = await request.patch(`/api/applications/${appId}/status`).set('Authorization', `Bearer ${adminToken}`).send({
      status: 'UNDER_REVIEW',
      comment: 'Under review',
    });
    expect(upd1.body.stage).toBe('SCRUTINY');

    // Admin changes status to INSPECTION_PENDING -> stage becomes EVC
    const upd2 = await request.patch(`/api/applications/${appId}/status`).set('Authorization', `Bearer ${adminToken}`).send({
      status: 'INSPECTION_PENDING',
      comment: 'Moving to inspection',
    });
    expect(upd2.body.stage).toBe('EVC');

    // Admin changes status to APPROVED -> stage becomes DONE
    const upd3 = await request.patch(`/api/applications/${appId}/status`).set('Authorization', `Bearer ${adminToken}`).send({
      status: 'APPROVED',
      comment: 'Approved',
    });
    expect(upd3.body.stage).toBe('DONE');
  });
});

// ============================================================================
// SECTION B: Pendency Analytics (GET /api/analytics/pendency)
// ============================================================================
describe('section B: pendency analytics', () => {
  it('admin sees all applications', async () => {
    const token = await login('admin@flowpilot.gov', 'Admin@123');
    const res = await request.get('/api/analytics/pendency').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stages)).toBe(true);
    // Admin should see pendency for all institutions
    expect(res.body.byRegion).toBeDefined();
  });

  it('officer sees only assigned applications', async () => {
    const adminToken = await login('admin@flowpilot.gov', 'Admin@123');
    const collegeToken = await login('college@sunrise.edu', 'College@123');
    const officerToken = await login('officer@flowpilot.gov', 'Officer@123');
    const instId = (global as any).__southInstId;

    // Create an application
    const create = await request.post('/api/applications').set('Authorization', `Bearer ${collegeToken}`).send({
      institutionId: instId,
      academicYear: '2026-27',
      category: 'Engineering',
      isNew: true,
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    });
    const appId = create.body.id;

    // Upload required docs and submit
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Land Use Certificate').attach('file', Buffer.from('%PDF-1.4'), 'a.pdf');
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Fire Safety NOC').attach('file', Buffer.from('%PDF-1.4'), 'b.pdf');
    await request.post(`/api/applications/${appId}/submit`).set('Authorization', `Bearer ${collegeToken}`);

    // Assign officer to this application
    await request.patch(`/api/applications/${appId}`).set('Authorization', `Bearer ${adminToken}`).send({
      assignedOfficerId: (global as any).__officerId,
    });

    // Officer should see the assigned application
    const officerApps = await request.get('/api/applications').set('Authorization', `Bearer ${officerToken}`);
    expect(officerApps.status).toBe(200);
    expect(officerApps.body.some((a: any) => a.id === appId)).toBe(true);

    // College from another institution should NOT see it
    const northCollegeToken = await login('college@north.edu', 'College@123');
    const northApps = await request.get('/api/applications').set('Authorization', `Bearer ${northCollegeToken}`);
    expect(northApps.status).toBe(200);
    expect(northApps.body.some((a: any) => a.id === appId)).toBe(false);
  });
});

// ============================================================================
// SECTION C: Inspection Queue (GET /api/inspections/queue)
// ============================================================================
describe('section C: inspection queue', () => {
  it('returns applications in EVC without scheduled inspection', async () => {
    const adminToken = await login('admin@flowpilot.gov', 'Admin@123');
    const collegeToken = await login('college@sunrise.edu', 'College@123');
    const instId = (global as any).__southInstId;

    // Create an application
    const create = await request.post('/api/applications').set('Authorization', `Bearer ${collegeToken}`).send({
      institutionId: instId,
      academicYear: '2026-27',
      category: 'Engineering',
      isNew: false, // triggers EVC route
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    });

    const appId = create.body.id;

    // Upload docs and submit
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Land Use Certificate').attach('file', Buffer.from('%PDF-1.4'), 'a.pdf');
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Fire Safety NOC').attach('file', Buffer.from('%PDF-1.4'), 'b.pdf');
    await request.post(`/api/applications/${appId}/submit`).set('Authorization', `Bearer ${collegeToken}`);

    // Move to INSPECTION_PENDING (EVC stage)
    await request.patch(`/api/applications/${appId}/status`).set('Authorization', `Bearer ${adminToken}`).send({
      status: 'INSPECTION_PENDING',
      comment: 'To inspection',
    });

    // Check queue - should include this application
    const res = await request.get('/api/inspections/queue').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((q: any) => q.id === appId)).toBe(true);
  });

  it('excludes applications that already have scheduled inspection', async () => {
    const adminToken = await login('admin@flowpilot.gov', 'Admin@123');
    const collegeToken = await login('college@sunrise.edu', 'College@123');
    const instId = (global as any).__southInstId;

    const create = await request.post('/api/applications').set('Authorization', `Bearer ${collegeToken}`).send({
      institutionId: instId,
      academicYear: '2026-27',
      category: 'Engineering',
      isNew: false,
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    });

    const appId = create.body.id;

    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Land Use Certificate').attach('file', Buffer.from('%PDF-1.4'), 'a.pdf');
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Fire Safety NOC').attach('file', Buffer.from('%PDF-1.4'), 'b.pdf');
    await request.post(`/api/applications/${appId}/submit`).set('Authorization', `Bearer ${collegeToken}`);
    await request.patch(`/api/applications/${appId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'INSPECTION_PENDING', comment: 'To inspection' });

    // Schedule an inspection
    const inspectionDate = new Date(Date.now() + 86400000 * 7).toISOString();
    await request.post('/api/inspections').set('Authorization', `Bearer ${adminToken}`).send({
      applicationId: appId,
      inspectionDate,
      location: 'Campus',
      type: 'EVC',
    });

    // Should NOT be in the queue
    const res = await request.get('/api/inspections/queue').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((q: any) => q.id === appId)).toBe(false);
  });
});

// ============================================================================
// SECTION D: Undertakings
// ============================================================================
describe('section D: undertakings', () => {
  it('creates an undertaking on approved application', async () => {
    const adminToken = await login('admin@flowpilot.gov', 'Admin@123');
    const collegeToken = await login('college@sunrise.edu', 'College@123');
    const instId = (global as any).__southInstId;

    // Create and approve an application
    const create = await request.post('/api/applications').set('Authorization', `Bearer ${collegeToken}`).send({
      institutionId: instId,
      academicYear: '2026-27',
      category: 'Engineering',
      isNew: true,
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    });
    const appId = create.body.id;

    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Land Use Certificate').attach('file', Buffer.from('%PDF-1.4'), 'a.pdf');
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Fire Safety NOC').attach('file', Buffer.from('%PDF-1.4'), 'b.pdf');
    await request.post(`/api/applications/${appId}/submit`).set('Authorization', `Bearer ${collegeToken}`);
    await request.patch(`/api/applications/${appId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'APPROVED', comment: 'Approved with conditions' });

    // Create an undertaking
    const dueDate = new Date(Date.now() + 86400000 * 15).toISOString();
    const undertakings = await request.post('/api/undertakings').set('Authorization', `Bearer ${adminToken}`).send({
      applicationId: appId,
      description: 'Submit additional documents',
      dueDate,
    });

    expect(undertakings.status).toBe(201);
    expect(undertakings.body.description).toBe('Submit additional documents');
    expect(undertakings.body.status).toBe('PENDING');
  });

  it('undertaking becomes OVERDUE after scheduler runs', async () => {
    const adminToken = await login('admin@flowpilot.gov', 'Admin@123');
    const collegeToken = await login('college@sunrise.edu', 'College@123');
    const instId = (global as any).__southInstId;

    const create = await request.post('/api/applications').set('Authorization', `Bearer ${collegeToken}`).send({
      institutionId: instId,
      academicYear: '2026-27',
      category: 'Engineering',
      isNew: true,
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    });
    const appId = create.body.id;

    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Land Use Certificate').attach('file', Buffer.from('%PDF-1.4'), 'a.pdf');
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Fire Safety NOC').attach('file', Buffer.from('%PDF-1.4'), 'b.pdf');
    await request.post(`/api/applications/${appId}/submit`).set('Authorization', `Bearer ${collegeToken}`);
    await request.patch(`/api/applications/${appId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'APPROVED', comment: 'Approved' });

    // Create an undertaking with PAST due date
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const undertakings = await request.post('/api/undertakings').set('Authorization', `Bearer ${adminToken}`).send({
      applicationId: appId,
      description: 'Past due undertaking',
      dueDate: pastDate,
    });

    expect(undertakings.status).toBe(201);

    // Run scheduler
    const { runJobs } = await import('../src/backend/jobs/scheduler');
    await runJobs();

    // Check that undertaking is now OVERDUE
    const get = await request.get('/api/undertakings').set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(200);
    const undertaking = get.body.find((u: any) => u.id === undertakings.body.id);
    expect(undertaking.status).toBe('OVERDUE');
  });

  it('college user cannot verify an undertaking', async () => {
    const adminToken = await login('admin@flowpilot.gov', 'Admin@123');
    const collegeToken = await login('college@sunrise.edu', 'College@123');
    const instId = (global as any).__southInstId;

    const create = await request.post('/api/applications').set('Authorization', `Bearer ${collegeToken}`).send({
      institutionId: instId,
      academicYear: '2026-27',
      category: 'Engineering',
      isNew: true,
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    });
    const appId = create.body.id;

    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Land Use Certificate').attach('file', Buffer.from('%PDF-1.4'), 'a.pdf');
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${collegeToken}`).field('applicationId', appId).field('docType', 'Fire Safety NOC').attach('file', Buffer.from('%PDF-1.4'), 'b.pdf');
    await request.post(`/api/applications/${appId}/submit`).set('Authorization', `Bearer ${collegeToken}`);
    await request.patch(`/api/applications/${appId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'APPROVED', comment: 'Approved' });

    // Create an undertaking
    const dueDate = new Date(Date.now() + 86400000 * 15).toISOString();
    const undertakings = await request.post('/api/undertakings').set('Authorization', `Bearer ${adminToken}`).send({
      applicationId: appId,
      description: 'Verify this',
      dueDate,
    });

    // College user tries to verify - should get 403
    const verify = await request.patch(`/api/undertakings/${undertakings.body.id}`).set('Authorization', `Bearer ${collegeToken}`).send({
      status: 'VERIFIED',
    });
    expect(verify.status).toBe(403);
  });
});

// ============================================================================
// SECTION E: Expiring Documents (GET /api/documents/expiring?days=30)
// ============================================================================
describe('section E: expiring documents', () => {
  it('returns documents expiring within specified days', async () => {
    const adminToken = await login('admin@flowpilot.gov', 'Admin@123');
    const collegeToken = await login('college@sunrise.edu', 'College@123');
    const instId = (global as any).__southInstId;

    const create = await request.post('/api/applications').set('Authorization', `Bearer ${collegeToken}`).send({
      institutionId: instId,
      academicYear: '2026-27',
      category: 'Engineering',
      isNew: true,
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    });
    const appId = create.body.id;

    // Upload a document with expiry in 10 days
    const expiryDate = new Date(Date.now() + 86400000 * 10).toISOString();
    const pdfBuffer = Buffer.from('%PDF-1.4');
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${adminToken}`).field('applicationId', appId).field('docType', 'Fire Safety NOC').attach('file', pdfBuffer, 'a.pdf');

    const docs = await request.get(`/api/documents/application/${appId}`).set('Authorization', `Bearer ${adminToken}`);
    const docId = docs.body[0].id;

    await request.patch(`/api/documents/verify/${docId}`).set('Authorization', `Bearer ${adminToken}`).send({
      status: 'APPROVED',
      officerComment: 'Approved',
    });

    // Update expiry date
    await prisma.applicationDocument.update({
      where: { id: docId },
      data: { expiryDate: new Date(expiryDate) },
    });

    // Get expiring documents within 30 days
    const res = await request.get('/api/documents/expiring?days=30').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((d: any) => d.id === docId)).toBe(true);
  });

  it('excludes documents expiring after specified days', async () => {
    const adminToken = await login('admin@flowpilot.gov', 'Admin@123');
    const collegeToken = await login('college@sunrise.edu', 'College@123');
    const instId = (global as any).__southInstId;

    const create = await request.post('/api/applications').set('Authorization', `Bearer ${collegeToken}`).send({
      institutionId: instId,
      academicYear: '2026-27',
      category: 'Engineering',
      isNew: true,
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    });
    const appId = create.body.id;

    // Upload a document with expiry in 90 days
    const expiryDate = new Date(Date.now() + 86400000 * 90).toISOString();
    const pdfBuffer = Buffer.from('%PDF-1.4');
    await request.post('/api/documents/upload').set('Authorization', `Bearer ${adminToken}`).field('applicationId', appId).field('docType', 'Land Use Certificate').attach('file', pdfBuffer, 'b.pdf');

    const docs = await request.get(`/api/documents/application/${appId}`).set('Authorization', `Bearer ${adminToken}`);
    const docId = docs.body[0].id;

    await request.patch(`/api/documents/verify/${docId}`).set('Authorization', `Bearer ${adminToken}`).send({
      status: 'APPROVED',
      officerComment: 'Approved',
    });

    await prisma.applicationDocument.update({
      where: { id: docId },
      data: { expiryDate: new Date(expiryDate) },
    });

    // Get expiring documents within 30 days - should NOT include 90-day document
    const res = await request.get('/api/documents/expiring?days=30').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((d: any) => d.id === docId)).toBe(false);
  });
});

// ============================================================================
// SECTION F: Consolidated Report and Admin Jobs
// ============================================================================
describe('section F: consolidated report and admin jobs', () => {
  it('GET /api/reports/consolidated?format=csv returns CSV with header and data rows', async () => {
    const adminToken = await login('admin@flowpilot.gov', 'Admin@123');

    const res = await request.get('/api/reports/consolidated?format=csv').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('Section,Key,Value');
    // Should have at least one data row
    expect(res.text.split('\n').length).toBeGreaterThan(1);
  });

  it('POST /api/admin/run-jobs returns 403 for officers', async () => {
    const officerToken = await login('officer@flowpilot.gov', 'Officer@123');

    const res = await request.post('/api/admin/run-jobs').set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(403);
  });

  it('POST /api/admin/run-jobs returns 200 for admins', async () => {
    const adminToken = await login('admin@flowpilot.gov', 'Admin@123');

    const res = await request.post('/api/admin/run-jobs').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Jobs executed');
  });
});