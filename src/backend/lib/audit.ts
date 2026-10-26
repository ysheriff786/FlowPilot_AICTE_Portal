import { prisma } from './prisma';

interface AuditInput {
  applicationId?: string | null;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export const recordAudit = async (input: AuditInput) => {
  return prisma.auditLog.create({
    data: {
      applicationId: input.applicationId ?? null,
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
};

export const notifyUsers = async (userIds: string[], message: string, type: string) => {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;
  const { dispatch } = await import('./notify/channel');
  for (const uid of uniqueIds) {
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { notificationPref: true } });
    await dispatch([uid], message, type, (u?.notificationPref as 'inapp' | 'both') || 'inapp');
  }
};

export const notifyInstitution = async (institutionId: string, message: string, type: string) => {
  const users = await prisma.user.findMany({
    where: { institutionId },
    select: { id: true },
  });
  await notifyUsers(
    users.map((user) => user.id),
    message,
    type
  );
};
