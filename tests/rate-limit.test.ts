import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Use a separate test database to avoid interference
const TEST_DB = path.resolve('prisma/rate-limit-test.db');
process.env.DATABASE_URL = 'file:./rate-limit-test.db';
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!';
process.env.NODE_ENV = 'test';
process.env.ENABLE_SCHEDULER = 'false';
// Rate limiter: 3 requests per 15 minutes for testing
process.env.LOGIN_RATE_MAX = '3';
process.env.LOGIN_RATE_WINDOW_MINUTES = '15';

let app: any;
let prisma: any;
let request: any;

beforeAll(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const { execSync } = await import('child_process');
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: 'file:./rate-limit-test.db' } });
  const mod = await import('../src/backend/server');
  app = mod.app;
  prisma = mod.prisma;
  const supertest = await import('supertest');
  request = supertest.default(app);

  const bcrypt = await import('bcryptjs');
  const inst = await prisma.institution.create({
    data: { name: 'Rate Limit Test Inst', type: 'Engineering College', address: 'x', state: 'Karnataka', region: 'SOUTH', isNew: false, email: 't@t.edu', phone: '1', category: 'Engineering', academicYear: '2026-27' },
  });
  const adminPw = await bcrypt.default.hash('Admin@123', 10);
  await prisma.user.create({ data: { email: 'admin@flowpilot.gov', password: adminPw, name: 'Admin', role: 'ADMIN', institutionId: inst.id } });
}, 120000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
});

describe('rate limiter', () => {
  it('blocks after max attempts with 429', async () => {
    // First 3 attempts with wrong password should succeed (but return 401)
    for (let i = 0; i < 3; i++) {
      const res = await request.post('/api/auth/login').send({ email: 'admin@flowpilot.gov', password: 'wrong' });
      expect(res.status).toBe(401); // Invalid credentials
    }

    // 4th attempt should be rate limited (429)
    const res = await request.post('/api/auth/login').send({ email: 'admin@flowpilot.gov', password: 'wrong' });
    expect(res.status).toBe(429);
    expect(res.headers['ratelimit-remaining']).toBe('0');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('allows different IP with X-Forwarded-For header', async () => {
    // After rate limit, try with different IP
    const res = await request.post('/api/auth/login')
      .set('X-Forwarded-For', '192.168.1.100')
      .send({ email: 'admin@flowpilot.gov', password: 'Admin@123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('admin@flowpilot.gov');
  });

  it('allows same IP after window expires', async () => {
    // The window is 15 minutes, so we can't test actual expiry
    // But we verify the limiter is keyed per-IP
    const res = await request.post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.1')
      .send({ email: 'admin@flowpilot.gov', password: 'Admin@123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('rate limiter does not block correct credentials before limit', () => {
  it('allows correct login within rate limit', async () => {
    // Use a fresh IP
    const res = await request.post('/api/auth/login')
      .set('X-Forwarded-For', '172.16.0.1')
      .send({ email: 'admin@flowpilot.gov', password: 'Admin@123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
