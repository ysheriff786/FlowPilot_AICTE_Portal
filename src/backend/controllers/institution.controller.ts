import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { recordAudit } from '../lib/audit';

const institutionSchema = z.object({
  name: z.string().min(2),
  type: z.string().min(2),
  state: z.string().min(2),
  region: z.enum(['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL']).optional(),
  category: z.string().min(2),
  academicYear: z.string().min(4),
  isNew: z.boolean().optional(),
  address: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const getInstitutions = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const institutions = await prisma.institution.findMany({
      where: user.role === 'COLLEGE' ? { id: user.institutionId || '__none__' } : {},
      include: {
        _count: { select: { applications: true, users: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(institutions);
  } catch {
    res.status(500).json({ message: 'Failed to fetch institutions' });
  }
};

export const createInstitution = async (req: AuthRequest, res: Response) => {
  try {
    const data = institutionSchema.parse(req.body);
    const { resolveRegion } = await import('../lib/routing');
    const region = data.region || (await resolveRegion(data.state)) as any;
    const institution = await prisma.institution.create({
      data: {
        name: data.name,
        type: data.type,
        address: data.address || '',
        state: data.state,
        region,
        email: data.email || '',
        phone: data.phone || '',
        category: data.category,
        academicYear: data.academicYear,
        isNew: data.isNew ?? false,
      },
    });
    await recordAudit({ actorId: req.user!.id, action: 'INSTITUTION_CREATED', entity: 'Institution', entityId: institution.id, metadata: { name: institution.name } });
    res.status(201).json(institution);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || 'Invalid institution data' });
    console.error('createInstitution error:', error);
    res.status(500).json({ message: 'Failed to create institution' });
  }
};

export const updateInstitution = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const data = institutionSchema.partial().parse(req.body);
    const institution = await prisma.institution.update({ where: { id }, data });
    await recordAudit({ actorId: req.user!.id, action: 'INSTITUTION_UPDATED', entity: 'Institution', entityId: institution.id, metadata: { name: institution.name } });
    res.json(institution);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || 'Invalid institution data' });
    console.error('updateInstitution error:', error);
    res.status(500).json({ message: 'Failed to update institution' });
  }
};