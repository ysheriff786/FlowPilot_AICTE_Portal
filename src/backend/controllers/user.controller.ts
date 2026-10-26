import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { USER_ROLES } from '../lib/workflow';
import { recordAudit } from '../lib/audit';

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(12),
  role: z.enum(USER_ROLES),
  institutionId: z.string().optional().nullable(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(USER_ROLES).optional(),
  institutionId: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  institutionId: true,
  institution: { select: { id: true, name: true } },
  active: true,
  createdAt: true,
};

export const getUsers = async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    res.json(users);
  } catch {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    if (data.role === 'COLLEGE' && !data.institutionId) {
      return res.status(400).json({ message: 'College accounts must be linked to an institution' });
    }

    if (data.institutionId) {
      const institution = await prisma.institution.findUnique({ where: { id: data.institutionId } });
      if (!institution) return res.status(400).json({ message: 'Institution not found' });
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: await bcrypt.hash(data.password, 10),
        role: data.role,
        institutionId: data.role === 'COLLEGE' ? data.institutionId : null,
      },
      select: userSelect,
    });

    await recordAudit({
      actorId: req.user!.id,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    res.status(201).json(user);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || 'Invalid user data' });
    }
    res.status(500).json({ message: 'Failed to create user' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const data = updateUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'User not found' });

    const nextRole = data.role ?? existing.role;
    const nextInstitutionId =
      nextRole === 'COLLEGE' ? data.institutionId ?? existing.institutionId : null;

    if (nextRole === 'COLLEGE' && !nextInstitutionId) {
      return res.status(400).json({ message: 'College accounts must be linked to an institution' });
    }

    if (existing.id === req.user!.id && data.role && data.role !== 'ADMIN') {
      return res.status(400).json({ message: 'You cannot remove your own administrator access' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.role ? { role: data.role } : {}),
        ...(data.role || data.institutionId !== undefined ? { institutionId: nextInstitutionId } : {}),
        ...(data.active !== undefined ? { active: data.active, ...(data.active === false ? { tokenVersion: { increment: 1 } } : {}) } : {}),
      },
      select: userSelect,
    });

    await recordAudit({
      actorId: req.user!.id,
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: user.id,
      metadata: { role: user.role, name: user.name },
    });

    res.json(user);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid user data' });
    }
    res.status(500).json({ message: 'Failed to update user' });
  }
};
