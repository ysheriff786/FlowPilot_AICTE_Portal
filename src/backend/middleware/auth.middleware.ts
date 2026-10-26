import { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { JWT_SECRET } from '../lib/config';
import { UserRole } from '../lib/workflow';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  institutionId: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

type TokenPayload = {
  id: string;
  role?: string;
  institutionId?: string | null;
  tv?: number;
};

const resolveUser = async (token: string): Promise<AuthUser | null> => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    if (!decoded?.id) return null;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true, institutionId: true, active: true, tokenVersion: true },
    });

    if (!user) return null;
    if (!user.active) return null;
    if (decoded.tv !== undefined && decoded.tv !== user.tokenVersion) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      institutionId: user.institutionId,
    };
  } catch {
    return null;
  }
};

const extractToken = (req: Request): string | undefined => {
  const headerToken = req.headers.authorization?.split(' ')[1];
  const cookieToken = (req as any).cookies?.token;
  return headerToken || cookieToken;
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const user = await resolveUser(token);
  if (!user) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  req.user = user;
  next();
};

export const optionalAuthenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next();
  const user = await resolveUser(token);
  if (!user) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  req.user = user;
  next();
};

export const authorize = (roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    next();
  };
};

export { cookieParser };