import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
    ]);

    res.json({ notifications, unreadCount });
  } catch {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification || notification.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Failed to update notification' });
  }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ updated: result.count });
  } catch {
    res.status(500).json({ message: 'Failed to update notifications' });
  }
};
