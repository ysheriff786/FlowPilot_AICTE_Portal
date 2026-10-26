import { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { recordAudit } from '../lib/audit';

const setupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(12),
});

export const getSetupStatus = async (_req: AuthRequest, res: Response) => {
  const count = await prisma.user.count();
  res.json({ needsSetup: count === 0 });
};

export const runSetup = async (req: AuthRequest, res: Response) => {
  const count = await prisma.user.count();
  if (count > 0) return res.status(404).json({ message: 'Not found' });
  try {
    const data = setupSchema.parse(req.body);
    const password = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password, role: 'ADMIN' },
    });
    await recordAudit({
      actorId: user.id,
      action: 'SETUP_COMPLETED',
      entity: 'User',
      entityId: user.id,
      metadata: { email: data.email },
    });
    res.status(201).json({ message: 'Setup complete' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || 'Invalid setup data' });
    }
    console.error('runSetup error:', error);
    res.status(400).json({ message: error.message || 'Setup failed' });
  }
};