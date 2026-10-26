import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  applicationDetailInclude,
  applicationScope,
  canManageApplication,
  findAccessibleApplication,
  findApplicationDetail,
} from '../lib/access';
import {
  APPLICATION_STATUSES,
  COLLEGE_SUBMITTABLE,
  OFFICER_TRANSITIONS,
  isApplicationStatus,
  statusLabel,
} from '../lib/workflow';
import { notifyInstitution, notifyUsers, recordAudit } from '../lib/audit';
import { computeCompliance } from '../lib/compliance';
import { statusToStage } from '../lib/stages';
import { resolveRoute } from '../lib/routing';

const createApplicationSchema = z.object({
  institutionId: z.string().min(1).optional(),
  academicYear: z.string().min(4),
  category: z.string().min(2),
  deadline: z.string().datetime().refine((value) => new Date(value) > new Date(), {
    message: 'Deadline must be in the future',
  }),
  assignedOfficerId: z.string().optional().nullable(),
});

const statusSchema = z
  .object({
    status: z.string(),
    comment: z.string().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'CORRECTION_REQUIRED' || data.status === 'REJECTED') {
      if (!data.comment || !data.comment.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A comment is required for this status change', path: ['comment'] });
      }
    }
  });

const generateRefId = async (academicYear: string) => {
  const base = `AICTE-${academicYear}`;
  const count = await prisma.application.count({ where: { academicYear } });
  let sequence = count + 1;

  while (sequence < count + 1000) {
    const refId = `${base}-${String(sequence).padStart(4, '0')}`;
    const exists = await prisma.application.findUnique({ where: { refId }, select: { id: true } });
    if (!exists) return refId;
    sequence += 1;
  }

  return `${base}-${Date.now()}`;
};

export const createApplication = async (req: AuthRequest, res: Response) => {
  try {
    const data = createApplicationSchema.parse(req.body);
    const user = req.user!;

    const institutionId = user.role === 'COLLEGE' ? user.institutionId : data.institutionId;
    if (!institutionId) {
      return res.status(400).json({ message: 'An institution is required' });
    }

    if (user.role === 'COLLEGE' && user.institutionId !== institutionId) {
      return res.status(403).json({ message: 'Unauthorized to create an application for this institution' });
    }

    const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution) {
      return res.status(400).json({ message: 'Institution not found' });
    }

    let assignedOfficerId: string | null = null;
    if (data.assignedOfficerId) {
      const officer = await prisma.user.findFirst({
        where: { id: data.assignedOfficerId, role: 'OFFICER' },
        select: { id: true },
      });
      if (!officer) {
        return res.status(400).json({ message: 'Assigned officer not found' });
      }
      assignedOfficerId = officer.id;
    }

    let application: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const refId = await generateRefId(data.academicYear);
      try {
        application = await prisma.application.create({
          data: {
            refId,
            institutionId,
            academicYear: data.academicYear,
            category: data.category,
            deadline: new Date(data.deadline),
            assignedOfficerId,
            status: 'DRAFT',
            stage: statusToStage('DRAFT') as any,
            stageEnteredAt: new Date(),
            route: (await resolveRoute(institution.category, institution.isNew)) as any,
          },
          include: applicationDetailInclude,
        });
        break;
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 4) continue;
        throw err;
      }
    }

    await recordAudit({
      applicationId: application.id,
      actorId: user.id,
      action: 'APPLICATION_CREATED',
      entity: 'Application',
      entityId: application.id,
      metadata: { refId: application.refId, institution: institution.name },
    });

    await notifyInstitution(
      institutionId,
      `${application.refId} was created and is ready for document upload.`,
      'APPLICATION'
    );

    if (assignedOfficerId) {
      await notifyUsers(
        [assignedOfficerId],
        `${application.refId} from ${institution.name} has been assigned to you.`,
        'APPLICATION'
      );
    }

    res.status(201).json(application);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || 'Invalid application data' });
    }
    res.status(400).json({ message: error.message || 'Failed to create application' });
  }
};

export const getApplications = async (req: AuthRequest, res: Response) => {
  try {
    const applications = await prisma.application.findMany({
      where: applicationScope(req.user!),
      include: {
        institution: true,
        assignedOfficer: { select: { id: true, name: true } },
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(applications);
  } catch (error) {
    console.error('getApplications error:', error);
    res.status(500).json({ message: 'Failed to fetch applications' });
  }
};

export const getApplication = async (req: AuthRequest, res: Response) => {
  try {
    const application = await findApplicationDetail(String(req.params.id), req.user!);
    if (!application) {
      return res.status(404).json({ message: 'Application not found or access denied' });
    }
    res.json(application);
  } catch (error) {
    console.error('getApplication error:', error);
    res.status(500).json({ message: 'Failed to fetch application' });
  }
};

export const updateApplicationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, comment } = statusSchema.parse(req.body);
    const user = req.user!;

    if (!isApplicationStatus(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed values: ${APPLICATION_STATUSES.join(', ')}` });
    }

    const application = await prisma.application.findFirst({
      where: { id, ...applicationScope(user) },
      include: { institution: true },
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found or access denied' });
    }

    if (!canManageApplication(user, application)) {
      return res.status(403).json({ message: 'You cannot manage this application' });
    }

    if (application.status === status) {
      return res.status(400).json({ message: `Application is already ${statusLabel(status)}` });
    }

    // Final states are terminal for every role, including admin.
    if (application.status === 'APPROVED' || application.status === 'REJECTED') {
      return res.status(400).json({ message: `Cannot change status of a ${statusLabel(application.status)} application` });
    }

    let overrideUsed = false;
    if (user.role === 'OFFICER') {
      const allowed = OFFICER_TRANSITIONS[application.status as keyof typeof OFFICER_TRANSITIONS] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          message: `Cannot move from ${statusLabel(application.status)} to ${statusLabel(status)}`,
        });
      }
    } else if (user.role === 'ADMIN') {
      const allowed = OFFICER_TRANSITIONS[application.status as keyof typeof OFFICER_TRANSITIONS] || [];
      if (!allowed.includes(status)) {
        overrideUsed = true;
      }
    }

    // Approval gate: cannot approve with missing required documents.
    if (status === 'APPROVED') {
      const app = await prisma.application.findUnique({
        where: { id },
        include: { documents: true },
      });
      if (app) {
        const result = await computeCompliance(app);
        if (result.missing.length > 0) {
          return res.status(400).json({ message: 'Cannot approve: missing required documents', missing: result.missing });
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.application.update({
        where: { id },
        data: {
          status,
          stage: statusToStage(status) as any,
          stageEnteredAt: new Date(),
          ...(status === 'SUBMITTED' || status === 'RESUBMITTED' ? { submissionDate: new Date() } : {}),
        },
        include: applicationDetailInclude,
      });

      await tx.review.create({
        data: {
          applicationId: id,
          officerId: user.id,
          comment: comment?.trim() || `Status updated to ${statusLabel(status)} by ${user.name}`,
          statusChange: status,
        },
      });

      return next;
    });

    await recordAudit({
      applicationId: id,
      actorId: user.id,
      action: 'STATUS_CHANGED',
      entity: 'Application',
      entityId: id,
      metadata: { from: application.status, to: status, comment: comment || null, overrideUsed },
    });

    if (['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'].includes(status)) {
      const message =
        status === 'APPROVED'
          ? `${application.refId} has been approved.`
          : status === 'REJECTED'
          ? `${application.refId} has been rejected.${comment ? ` Reason: ${comment}` : ''}`
          : `${application.refId} requires corrections.${comment ? ` Details: ${comment}` : ''}`;
      await notifyInstitution(application.institutionId, message, 'STATUS');
    }

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'A valid status is required' });
    }
    console.error('updateApplicationStatus error:', error);
    res.status(500).json({ message: 'Failed to update status' });
  }
};

export const submitApplication = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const user = req.user!;

    const application = await findAccessibleApplication(id, user);
    if (!application) {
      return res.status(404).json({ message: 'Application not found or access denied' });
    }

    if (user.role !== 'COLLEGE' || user.institutionId !== application.institutionId) {
      return res.status(403).json({ message: 'Only the owning institution can submit this application' });
    }

    if (!COLLEGE_SUBMITTABLE.includes(application.status as (typeof COLLEGE_SUBMITTABLE)[number])) {
      return res.status(400).json({
        message: `${statusLabel(application.status)} applications cannot be submitted`,
      });
    }

    // Submit gate: required documents must be present.
    const appWithDocs = await prisma.application.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (appWithDocs) {
      const uploadedTypes = new Set(appWithDocs.documents.map((d) => d.docType));
      const requirements = await prisma.documentRequirement.findMany({
        where: { category: appWithDocs.category, academicYear: appWithDocs.academicYear, isRequired: true },
        select: { docType: true },
      });
      const requiredTypes = requirements.map((r) => r.docType);
      const notUploaded = requiredTypes.filter((t) => !uploadedTypes.has(t));
      if (notUploaded.length > 0) {
        return res.status(400).json({ message: 'Cannot submit: missing required documents', missing: notUploaded });
      }
    }

    const nextStatus = application.status === 'CORRECTION_REQUIRED' ? 'RESUBMITTED' : 'SUBMITTED';

    let assignedOfficerId = application.assignedOfficerId;
    if (!assignedOfficerId) {
      const officer = await prisma.user.findFirst({
        where: { role: 'OFFICER' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      assignedOfficerId = officer?.id ?? null;
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: nextStatus,
        submissionDate: new Date(),
        assignedOfficerId,
      },
      include: applicationDetailInclude,
    });

    await recordAudit({
      applicationId: id,
      actorId: user.id,
      action: nextStatus === 'RESUBMITTED' ? 'APPLICATION_RESUBMITTED' : 'APPLICATION_SUBMITTED',
      entity: 'Application',
      entityId: id,
      metadata: { from: application.status, to: nextStatus },
    });

    if (assignedOfficerId) {
      await notifyUsers(
        [assignedOfficerId],
        `${application.refId} from ${application.institution.name} was ${nextStatus === 'RESUBMITTED' ? 'resubmitted' : 'submitted'} for review.`,
        'APPLICATION'
      );
    }

    res.json(updated);
  } catch (error) {
    console.error('submitApplication error:', error);
    res.status(500).json({ message: 'Failed to submit application' });
  }
};
