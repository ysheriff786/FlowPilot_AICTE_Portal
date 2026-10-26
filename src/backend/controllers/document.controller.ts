import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import { findAccessibleApplication, applicationScope } from '../lib/access';
import { DOCUMENT_STATUSES, isDocumentStatus, statusLabel } from '../lib/workflow';
import { notifyInstitution, notifyUsers, recordAudit } from '../lib/audit';
import { computeCompliance } from '../lib/compliance';
import { verifyMagicBytes, deleteFileSafe } from '../utils/upload';
import { UPLOAD_DIR } from '../lib/config';

const uploadDocSchema = z.object({
  applicationId: z.string().min(1),
  docType: z.string().min(2),
  expiryDate: z.string().datetime().optional(),
});

const verifyDocSchema = z.object({
  status: z.string(),
  officerComment: z.string().max(1000).optional(),
});

export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { applicationId, docType, expiryDate } = uploadDocSchema.parse(req.body);
    const file = req.file;
    const user = req.user!;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const application = await findAccessibleApplication(applicationId, user);
    if (!application) {
      deleteFileSafe(file.path);
      return res.status(404).json({ message: 'Application not found or access denied' });
    }

    if (user.role === 'COLLEGE' && application.institutionId !== user.institutionId) {
      deleteFileSafe(file.path);
      return res.status(403).json({ message: 'Unauthorized to upload documents for this application' });
    }

    if (application.status === 'APPROVED' || application.status === 'REJECTED') {
      deleteFileSafe(file.path);
      return res.status(400).json({ message: 'Cannot upload documents to a finalized application' });
    }

    if (!verifyMagicBytes(file.path, file.mimetype)) {
      deleteFileSafe(file.path);
      return res.status(400).json({ message: 'File content does not match its declared type' });
    }

    const document = await prisma.applicationDocument.create({
      data: {
        applicationId,
        docType,
        filePath: file.path.replace(/\\/g, '/'),
        status: 'PENDING',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
    });

    await recordAudit({
      applicationId,
      actorId: user.id,
      action: 'DOCUMENT_UPLOADED',
      entity: 'ApplicationDocument',
      entityId: document.id,
      metadata: { docType, filename: file.filename },
    });

    if (application.assignedOfficerId) {
      await notifyUsers(
        [application.assignedOfficerId],
        `A new ${docType} was uploaded for ${application.refId}.`,
        'DOCUMENT'
      );
    }

    res.status(201).json(document);
  } catch (error: any) {
    if (req.file?.path) deleteFileSafe(req.file.path);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'applicationId and docType are required' });
    }
    res.status(400).json({ message: error.message || 'Upload failed' });
  }
};

export const getDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = String(req.params.applicationId);
    const application = await findAccessibleApplication(applicationId, req.user!);
    if (!application) {
      return res.status(404).json({ message: 'Application not found or access denied' });
    }

    const documents = await prisma.applicationDocument.findMany({
      where: { applicationId },
      orderBy: { uploadDate: 'desc' },
    });

    res.json(documents);
  } catch {
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
};

export const verifyDocument = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, officerComment } = verifyDocSchema.parse(req.body);
    const user = req.user!;

    if (!isDocumentStatus(status)) {
      return res.status(400).json({ message: `Invalid document status. Allowed values: ${DOCUMENT_STATUSES.join(', ')}` });
    }

    const existing = await prisma.applicationDocument.findUnique({
      where: { id },
      include: { application: { include: { institution: true } } },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (user.role === 'OFFICER' && existing.application.assignedOfficerId !== user.id) {
      return res.status(403).json({ message: 'This application is not assigned to you' });
    }

    const document = await prisma.applicationDocument.update({
      where: { id },
      data: {
        status,
        officerComment: officerComment?.trim() || null,
      },
    });

    await recordAudit({
      applicationId: existing.applicationId,
      actorId: user.id,
      action: 'DOCUMENT_VERIFIED',
      entity: 'ApplicationDocument',
      entityId: document.id,
      metadata: { docType: document.docType, status },
    });

    if (status === 'APPROVED' || status === 'REJECTED' || status === 'CORRECTION_REQUIRED') {
      await notifyInstitution(
        existing.application.institutionId,
        `${document.docType} for ${existing.application.refId} was marked ${statusLabel(status)}.`,
        'DOCUMENT'
      );
    }

    res.json(document);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid verification data' });
    }
    res.status(500).json({ message: 'Verification failed' });
  }
};

export const getComplianceScore = async (req: AuthRequest, res: Response) => {
  try {
    const applicationId = String(req.params.applicationId);

    const application = await findAccessibleApplication(applicationId, req.user!);
    if (!application) {
      return res.status(404).json({ message: 'Application not found or access denied' });
    }

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { documents: true },
    });

    if (!app) return res.status(404).json({ message: 'Application not found' });

    const result = await computeCompliance(app);

    const pendingDocs = app.documents.filter((document) => document.status === 'PENDING');
    const correctionDocs = app.documents.filter((document) => document.status === 'CORRECTION_REQUIRED');
    const rejectedDocs = app.documents.filter((document) => document.status === 'REJECTED');

    res.json({
      applicationId,
      score: result.score,
      approvedCount: result.approvedCount,
      pendingCount: pendingDocs.length,
      correctionCount: correctionDocs.length,
      rejectedCount: rejectedDocs.length,
      totalRequired: result.requiredCount,
      missingRequired: result.missing,
      status: result.compliant ? 'Compliant' : 'Non-Compliant',
    });
  } catch {
    res.status(500).json({ message: 'Score calculation failed' });
  }
};

export const getDocumentFile = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const document = await prisma.applicationDocument.findUnique({
      where: { id },
      include: { application: true },
    });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    const application = await findAccessibleApplication(document.applicationId, req.user!);
    if (!application) {
      return res.status(404).json({ message: 'Document not found or access denied' });
    }
    const filePath = path.resolve(document.filePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }
    return res.download(filePath);
  } catch (error) {
    console.error('getDocumentFile error:', error);
    res.status(500).json({ message: 'Failed to fetch document file' });
  }
};

export const getExpiringDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const days = Number(req.query.days || 30);
    const user = req.user!;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const now = new Date();

    const scope = applicationScope(user);
    const documents = await prisma.applicationDocument.findMany({
      where: {
        application: scope,
        expiryDate: { not: null, lte: cutoff },
      },
      include: { application: { select: { id: true, refId: true, institution: { select: { name: true } } } } },
      orderBy: { expiryDate: 'asc' },
    });

    res.json(
      documents.map((d) => ({
        id: d.id,
        docType: d.docType,
        status: d.status,
        expiryDate: d.expiryDate,
        expired: d.expiryDate ? new Date(d.expiryDate).getTime() < now.getTime() : false,
        applicationId: d.applicationId,
        refId: d.application.refId,
        institution: d.application.institution.name,
      }))
    );
  } catch (error) {
    console.error('getExpiringDocuments error:', error);
    res.status(500).json({ message: 'Failed to fetch expiring documents' });
  }
};

export const createDocumentRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({ category: z.string().min(2), academicYear: z.string().min(4), docType: z.string().min(2), isRequired: z.boolean().optional() });
    const data = schema.parse(req.body);
    const reqDoc = await prisma.documentRequirement.create({ data: { category: data.category, academicYear: data.academicYear, docType: data.docType, isRequired: data.isRequired ?? true } });
    await recordAudit({ actorId: req.user!.id, action: 'DOCUMENT_REQUIREMENT_CREATED', entity: 'DocumentRequirement', entityId: reqDoc.id, metadata: { category: data.category, docType: data.docType } });
    res.status(201).json(reqDoc);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || 'Invalid data' });
    console.error('createDocumentRequirement error:', error);
    res.status(500).json({ message: 'Failed to create requirement' });
  }
};

export const getDocumentRequirements = async (req: AuthRequest, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const academicYear =
      typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined;

    const requirements = await prisma.documentRequirement.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(academicYear ? { academicYear } : {}),
      },
      orderBy: { docType: 'asc' },
    });

    res.json(requirements);
  } catch {
    res.status(500).json({ message: 'Failed to fetch document requirements' });
  }
};
