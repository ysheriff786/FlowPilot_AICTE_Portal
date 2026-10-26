import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../lib/config';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { USER_ROLES } from '../lib/workflow';
import { recordAudit } from '../lib/audit';
import { validatePassword } from '../lib/password';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(USER_ROLES),
  institutionId: z.string().optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const profileSchema = z.object({
  name: z.string().min(2),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

const publicUser = (user: {
  id: string;
  name: string;
  email: string;
  role: string;
  institutionId: string | null;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  institutionId: user.institutionId,
});

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const pwError = validatePassword(validatedData.password, validatedData.email);
    if (pwError) return res.status(400).json({ message: pwError });

    const userCount = await prisma.user.count();
    if (userCount > 0 && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only administrators can create new accounts' });
    }

    const existing = await prisma.user.findUnique({ where: { email: validatedData.email } });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    if (validatedData.institutionId) {
      const institution = await prisma.institution.findUnique({ where: { id: validatedData.institutionId } });
      if (!institution) {
        return res.status(400).json({ message: 'Institution not found' });
      }
    }

    if (validatedData.role === 'COLLEGE' && !validatedData.institutionId) {
      return res.status(400).json({ message: 'College accounts must be linked to an institution' });
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        role: validatedData.role,
        institutionId: validatedData.role === 'COLLEGE' ? validatedData.institutionId : null,
      },
    });

    if (req.user) {
      await recordAudit({
        actorId: req.user.id,
        action: 'USER_CREATED',
        entity: 'User',
        entityId: user.id,
        metadata: { email: user.email, role: user.role },
      });
    }

    res.status(201).json({ message: 'User created successfully', user: publicUser(user) });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || 'Invalid registration data' });
    }
    res.status(400).json({ message: error.message || 'Registration failed' });
  }
};

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, institutionId: user.institutionId, tv: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] }
    );

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      token,
      user: publicUser(user),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'A valid email and password are required' });
    }
    res.status(500).json({ message: 'Login failed' });
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { institution: { select: { id: true, name: true, type: true } } },
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      ...publicUser(user),
      institution: user.institution,
    });
  } catch {
    res.status(500).json({ message: 'Failed to load profile' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { name } = profileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name },
    });

    await recordAudit({
      actorId: req.user!.id,
      action: 'PROFILE_UPDATED',
      entity: 'User',
      entityId: user.id,
      metadata: { name },
    });

    res.json({ user: publicUser(user) });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = passwordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (user) {
      const pwError = validatePassword(newPassword, user.email);
      if (pwError) return res.status(400).json({ message: pwError });
    }
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed, tokenVersion: { increment: 1 } } });

    await recordAudit({
      actorId: user.id,
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: user.id,
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    res.status(500).json({ message: 'Failed to change password' });
  }
};
