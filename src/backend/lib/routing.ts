import { prisma } from './prisma';
import { notifyUsers } from './audit';

export const resolveRoute = async (category: string, isNew: boolean): Promise<string> => {
  const rule = await prisma.routingRule.findFirst({ where: { category, isNew } });
  if (rule) return rule.route;
  // notify admins
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  await notifyUsers(admins.map((a) => a.id), `No routing rule for category ${category} (isNew=${isNew}). Application created as UNASSIGNED.`, 'ROUTING');
  return 'UNASSIGNED';
};

export const resolveRegion = async (state: string): Promise<string> => {
  const mapping = await prisma.stateRegion.findFirst({ where: { state } });
  return mapping ? mapping.region : 'CENTRAL';
};