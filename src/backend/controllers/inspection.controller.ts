import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { applicationScope, canManageApplication, findAccessibleApplication } from '../lib/access';
import { notifyInstitution, notifyUsers, recordAudit } from '../lib/audit';

const inspectionStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;

const scheduleSchema = z.object({
  applicationId: z.string().min(1),
  type: z.enum(['EVC', 'SPOT']).optional(),
  inspectionDate: z.string().datetime(),
  location: z.string().min(3),
  notes: z.string().max(1000).optional(),
});

const updateSchema = z.object({
  inspectionDate: z.string().datetime().optional(),
  location: z.string().min(3).optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(inspectionStatuses).optional(),
});

const inspectionInclude = {
  application: {
    select: {
      id: true,
      refId: true,
      status: true,
      assignedOfficerId: true,
      institution: { select: { id: true, name: true } },
    },
  },
};

export const getInspectionQueue = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const scoped = applicationScope(user);
    const applications = await prisma.application.findMany({
      where: { ...scoped, stage: 'EVC' },
      include: {
        institution: { select: { id: true, name: true, region: true } },
        inspections: true,
      },
    });
    const queued = applications
      .filter((app) => !app.inspections.some((i) => i.status === 'SCHEDULED'))
      .map((app) => ({
        id: app.id,
        refId: app.refId,
        institution: app.institution.name,
        region: app.institution.region,
        stageEnteredAt: app.stageEnteredAt,
      }));
    res.json(queued);
  } catch (error) {
    console.error('getInspectionQueue error:', error);
    res.status(500).json({ message: 'Failed to fetch inspection queue' });
  }
};

export const getInspections = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const applications = await prisma.application.findMany({
      where: applicationScope(user),
      select: { id: true },
    });
    const applicationIds = applications.map((application) => application.id);

    const inspections = await prisma.inspection.findMany({
      where: { applicationId: { in: applicationIds } },
      include: inspectionInclude,
      orderBy: { inspectionDate: 'asc' },
    });

    res.json(inspections);
  } catch {
    res.status(500).json({ message: 'Failed to fetch inspections' });
  }
};

export const scheduleInspection = async (req: AuthRequest, res: Response) => {
  try {
    const data = scheduleSchema.parse(req.body);
    const user = req.user!;

    const application = await findAccessibleApplication(data.applicationId, user);
    if (!application) {
      return res.status(404).json({ message: 'Application not found or access denied' });
    }

    if (!canManageApplication(user, application)) {
      return res.status(403).json({ message: 'You cannot schedule inspections for this application' });
    }

    const type = data.type || 'EVC';
    const inspectionDate = new Date(data.inspectionDate);
    if (type === 'EVC' && application.stage === 'EVC') {
      const limit = new Date(application.stageEnteredAt);
      limit.setDate(limit.getDate() + 30);
      if (inspectionDate.getTime() > limit.getTime()) {
        return res.status(400).json({ message: 'EVC inspection must be scheduled within 30 days of queue entry' });
      }
    }

    const inspection = await prisma.inspection.create({
      data: {
        applicationId: application.id,
        type,
        inspectionDate,
        dueDate: type === 'EVC' ? inspectionDate : null,
        location: data.location,
        notes: data.notes?.trim() || null,
        status: 'SCHEDULED',
      },
      include: inspectionInclude,
    });

    if (['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'].includes(application.status)) {
      await prisma.application.update({
        where: { id: application.id },
        data: { status: 'INSPECTION_PENDING' },
      });
    }

    await recordAudit({
      applicationId: application.id,
      actorId: user.id,
      action: 'INSPECTION_SCHEDULED',
      entity: 'Inspection',
      entityId: inspection.id,
      metadata: { date: data.inspectionDate, location: data.location },
    });

    await notifyInstitution(
      application.institutionId,
      `An inspection has been scheduled for ${application.refId} on ${new Date(data.inspectionDate).toLocaleDateString()} at ${data.location}.`,
      'INSPECTION'
    );

    if (application.assignedOfficerId && application.assignedOfficerId !== user.id) {
      await notifyUsers(
        [application.assignedOfficerId],
        `An inspection was scheduled for ${application.refId}.`,
        'INSPECTION'
      );
    }

    res.status(201).json(inspection);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || 'Invalid inspection data' });
    }
    res.status(500).json({ message: 'Failed to schedule inspection' });
  }
};

export const updateInspection = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const data = updateSchema.parse(req.body);
    const user = req.user!;

    const existing = await prisma.inspection.findUnique({
      where: { id },
      include: inspectionInclude,
    });

    if (!existing) return res.status(404).json({ message: 'Inspection not found' });

    if (!canManageApplication(user, existing.application)) {
      return res.status(403).json({ message: 'You cannot update this inspection' });
    }

    if (data.status && data.status !== existing.status) {
      if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
        return res.status(400).json({ message: `Cannot change a ${existing.status.toLowerCase()} inspection` });
      }
      if (existing.status === 'SCHEDULED' && data.status !== 'COMPLETED' && data.status !== 'CANCELLED') {
        return res.status(400).json({ message: 'Inspection can only be completed or cancelled' });
      }
    }

    const inspection = await prisma.inspection.update({
      where: { id },
      data: {
        ...(data.inspectionDate ? { inspectionDate: new Date(data.inspectionDate) } : {}),
        ...(data.location ? { location: data.location } : {}),
        ...(data.notes !== undefined ? { notes: data.notes.trim() || null } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
      include: inspectionInclude,
    });

    await recordAudit({
      applicationId: existing.applicationId,
      actorId: user.id,
      action: 'INSPECTION_UPDATED',
      entity: 'Inspection',
      entityId: inspection.id,
      metadata: { status: inspection.status },
    });

    if (data.status) {
      await notifyInstitution(
        existing.application.institution.id,
        `The inspection for ${existing.application.refId} is now ${data.status.toLowerCase()}.`,
        'INSPECTION'
      );

      if (data.status === 'COMPLETED' && existing.type === 'EVC') {
        const app = await prisma.application.findUnique({ where: { id: existing.applicationId } });
        if (app && app.status === 'INSPECTION_PENDING') {
          await prisma.application.update({
            where: { id: existing.applicationId },
            data: { status: 'UNDER_REVIEW', stage: 'SCRUTINY', stageEnteredAt: new Date() },
          });
          if (app.assignedOfficerId) {
            await notifyUsers([app.assignedOfficerId], `EVC completed for ${app.refId}; application returned to scrutiny.`, 'INSPECTION');
          }
        }
      }
    }

    res.json(inspection);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid inspection data' });
    }
    res.status(500).json({ message: 'Failed to update inspection' });
  }
};
