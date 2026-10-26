import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { applicationScope } from '../lib/access';

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const action = typeof req.query.action === 'string' ? req.query.action : undefined;
    const entity = typeof req.query.entity === 'string' ? req.query.entity : undefined;
    const applicationId =
      typeof req.query.applicationId === 'string' ? req.query.applicationId : undefined;
    const actorId = typeof req.query.actorId === 'string' ? req.query.actorId : undefined;
    const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined;

    let visibility: Prisma.AuditLogWhereInput = {};
    if (user.role === 'OFFICER') {
      const applications = await prisma.application.findMany({
        where: applicationScope(user),
        select: { id: true },
      });
      visibility = {
        OR: [
          { applicationId: { in: applications.map((application) => application.id) } },
          { actorId: user.id },
        ],
      };
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        AND: [
          visibility,
          ...(action ? [{ action }] : []),
          ...(entity ? [{ entity }] : []),
          ...(applicationId ? [{ applicationId }] : []),
          ...(actorId ? [{ actorId }] : []),
          ...(from ? [{ timestamp: { gte: from } }] : []),
          ...(to ? [{ timestamp: { lte: to } }] : []),
        ],
      },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
        application: { select: { id: true, refId: true, institution: { select: { name: true } } } },
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });

    res.json(logs);
  } catch {
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};
