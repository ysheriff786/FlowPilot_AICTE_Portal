import { Prisma, Application } from '@prisma/client';
import { prisma } from './prisma';
import { AuthUser } from '../middleware/auth.middleware';

/**
 * Restricts application queries to the records a user is allowed to see:
 * admins see everything, officers see applications assigned to them, and
 * college users see applications belonging to their own institution.
 */
export const applicationScope = (user: AuthUser): Prisma.ApplicationWhereInput => {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'OFFICER') return { assignedOfficerId: user.id };
  return { institutionId: user.institutionId || '__none__' };
};

export const canAccessApplication = (user: AuthUser, application: Pick<Application, 'institutionId' | 'assignedOfficerId'>) => {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'OFFICER') return application.assignedOfficerId === user.id;
  return application.institutionId === user.institutionId;
};

export const canManageApplication = (user: AuthUser, application: Pick<Application, 'assignedOfficerId'>) => {
  if (user.role === 'ADMIN') return true;
  return user.role === 'OFFICER' && application.assignedOfficerId === user.id;
};

export const findAccessibleApplication = async (id: string, user: AuthUser) => {
  return prisma.application.findFirst({
    where: { id, ...applicationScope(user) },
    include: { institution: true },
  });
};

export const applicationDetailInclude = {
  institution: true,
  assignedOfficer: { select: { id: true, name: true, email: true } },
  documents: { orderBy: { uploadDate: 'desc' as const } },
  reviews: {
    orderBy: { createdAt: 'desc' as const },
    include: { officer: { select: { id: true, name: true } } },
  },
  inspections: { orderBy: { inspectionDate: 'asc' as const } },
  _count: { select: { documents: true } },
};

export const findApplicationDetail = async (id: string, user: AuthUser) => {
  return prisma.application.findFirst({
    where: { id, ...applicationScope(user) },
    include: applicationDetailInclude,
  });
};
