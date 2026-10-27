import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from './lib/prisma';
import { CORS_ORIGIN, UPLOAD_DIR } from './lib/config';
import authRoutes from './routes/auth.routes';
import applicationRoutes from './routes/application.routes';
import documentRoutes from './routes/document.routes';
import institutionRoutes from './routes/institution.routes';
import userRoutes from './routes/user.routes';
import notificationRoutes from './routes/notification.routes';
import inspectionRoutes from './routes/inspection.routes';
import analyticsRoutes from './routes/analytics.routes';
import undertakingRoutes from './routes/undertaking.routes';
import auditRoutes from './routes/audit.routes';
import adminRoutes from './routes/admin.routes';
import reportRoutes from './routes/report.routes';
import setupRoutes from './routes/setup.routes';
import routingRoutes from './routes/routing.routes';
import cookieParser from 'cookie-parser';

const app = express();
app.set('trust proxy', 1);

// The upload directory is created lazily. Serverless platforms mount the
// filesystem read-only, so a failure here must not stop the API from booting.
const uploadDir = UPLOAD_DIR;
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (error) {
  console.warn(`Upload directory "${uploadDir}" is not writable:`, (error as Error).message);
}

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:", "blob:"], connectSrc: ["'self'"] } } }));
app.use(pinoHttp({ redact: ['req.headers.authorization', 'req.headers.cookie'] }));
app.use(cors({ origin: CORS_ORIGIN.split(',').map((o) => o.trim()), credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/undertakings', undertakingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/reports', reportRoutes);

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

// Return JSON (not HTML) for unknown API routes.
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Serve the built frontend when it exists (self-hosted/Docker mode).
const clientDir = path.resolve('dist');
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

// Central error handler: every failure leaves the API as JSON, never HTML.
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: error.issues[0]?.message || 'Invalid request data',
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. The maximum size is 5MB.'
        : `Upload failed: ${error.message}`;
    return res.status(400).json({ message });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A record with these details already exists' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Record not found' });
    }
    return res.status(400).json({ message: 'Database request failed' });
  }

  if (error instanceof Error && /Invalid file type/i.test(error.message)) {
    return res.status(400).json({ message: error.message });
  }

  console.error('Unhandled API error:', error);
  res.status(500).json({ message: 'Internal server error' });
});

export { app, prisma };
export default app;
