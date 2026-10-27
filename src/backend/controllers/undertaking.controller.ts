import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { applicationScope, findAccessibleApplication } from '../lib/access';
import { notifyInstitution, notifyUsers, recordAudit } from '../lib/audit';

const createSchema = z.object({
  applicationId: z.string().min(1),
  description: z.string().min(3),
  dueDate: z.string().datetime(),
});

const updateSchema = z.object({
  status: z.enum(['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'OVERDUE']).optional(),
  evidenceDocumentId: z.string().optional(),
});

export const getUndertakings = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let where: any = {};
    if (user.role === 'COLLEGE') {
      where = { application: { institutionId: user.institutionId || '__none__' } };
    } else if (user.role === 'OFFICER') {
      where = { application: { assignedOfficerId: user.id } };
    }
    const items = await prisma.undertaking.findMany({
      where,
      include: { application: { select: { id: true, refId: true, institution: { select: { name: true } } } } },
      orderBy: { dueDate: 'asc' },
    });
    res.json(items);
  } catch (error) {
    console.error('getUndertakings error:', error);
    res.status(500).json({ message: 'Failed to fetch undertakings' });
  }
};

export const createUndertaking = async (req: AuthRequest, res: Response) => {
  try {
    const data = createSchema.parse(req.body);
    const user = req.user!;
    if (user.role !== 'ADMIN' && user.role !== 'OFFICER') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const application = await findAccessibleApplication(data.applicationId, user);
    if (!application) return res.status(404).json({ message: 'Application not found or access denied' });
    if (application.status !== 'APPROVED') {
      return res.status(400).json({ message: 'Undertakings can only be created on approved applications' });
    }
    const undertaking = await prisma.undertaking.create({
      data: {
        applicationId: application.id,
        description: data.description,
        dueDate: new Date(data.dueDate),
        status: 'PENDING',
      },
    });
    await recordAudit({
      applicationId: application.id,
      actorId: user.id,
      action: 'UNDERTAKING_CREATED',
      entity: 'Undertaking',
      entityId: undertaking.id,
      metadata: { description: data.description },
    });
    res.status(201).json(undertaking);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || 'Invalid undertaking data' });
    }
    console.error('createUndertaking error:', error);
    res.status(500).json({ message: 'Failed to create undertaking' });
  }
};

export const uploadEvidence = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const file = req.file;
    const user = req.user!;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });
    const undertaking = await prisma.undertaking.findUnique({ where: { id }, include: { application: true } });
    if (!undertaking) return res.status(404).json({ message: 'Undertaking not found' });
    if (user.role === 'COLLEGE' && undertaking.application.institutionId !== user.institutionId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const document = await prisma.applicationDocument.create({
      data: {
        applicationId: undertaking.applicationId,
        docType: 'Undertaking Evidence',
        filePath: file.path.replace(/\\/g, '/'),
        status: 'PENDING',
      },
    });
    await prisma.undertaking.update({ where: { id }, data: { evidenceDocumentId: document.id, status: 'SUBMITTED' } });
    await recordAudit({ actorId: user.id, action: 'UNDERTAKING_EVIDENCE_UPLOADED', entity: 'Undertaking', entityId: id, metadata: { documentId: document.id } });
    res.status(201).json(document);
  } catch (error) {
    console.error('uploadEvidence error:', error);
    res.status(500).json({ message: 'Failed to upload evidence' });
  }
};

export const updateUndertaking = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const data = updateSchema.parse(req.body);
    const user = req.user!;
    const existing = await prisma.undertaking.findUnique({ where: { id }, include: { application: true } });
    if (!existing) return res.status(404).json({ message: 'Undertaking not found' });
    if (user.role !== 'ADMIN' && user.role !== 'OFFICER') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const undertaking = await prisma.undertaking.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.evidenceDocumentId ? { evidenceDocumentId: data.evidenceDocumentId } : {}),
      },
    });
    await recordAudit({
      applicationId: existing.applicationId,
      actorId: user.id,
      action: 'UNDERTAKING_UPDATED',
      entity: 'Undertaking',
      entityId: undertaking.id,
      metadata: { status: undertaking.status },
    });
    if (data.status === 'VERIFIED') {
      await notifyInstitution(existing.application.institutionId, `Undertaking verified for ${existing.application.refId}.`, 'UNDERTAKING');
    }
    if (data.status === 'REJECTED') {
      await notifyInstitution(existing.application.institutionId, `Undertaking rejected for ${existing.application.refId}.`, 'UNDERTAKING');
    }
    res.json(undertaking);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid undertaking data' });
    }
    console.error('updateUndertaking error:', error);
    res.status(500).json({ message: 'Failed to update undertaking' });
  }
};