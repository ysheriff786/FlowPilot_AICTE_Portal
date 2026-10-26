import nodemailer from 'nodemailer';
import { prisma } from '../prisma';

export interface NotificationChannel {
  send(userId: string, message: string, type: string): Promise<void>;
}

export class InAppChannel implements NotificationChannel {
  async send(userId: string, message: string, type: string): Promise<void> {
    await prisma.notification.create({ data: { userId, message, type } });
  }
}

export class SmtpEmailChannel implements NotificationChannel {
  private transporter: ReturnType<typeof nodemailer.createTransport>;
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  async send(userId: string, message: string, type: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    if (process.env.SMTP_HOST) {
      await this.transporter.sendMail({ from: process.env.SMTP_FROM || 'noreply@flowpilot', to: user.email, subject: `[FlowPilot] ${type}`, text: message });
    } else {
      console.log(`[email stub] to=${user.email} subject=${type} body=${message}`);
    }
  }
}

const inApp = new InAppChannel();
const email = process.env.SMTP_HOST ? new SmtpEmailChannel() : null;

export const dispatch = async (userIds: string[], message: string, type: string, channelPref?: 'inapp' | 'both') => {
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const uid of unique) {
    await inApp.send(uid, message, type);
    const pref = channelPref || 'inapp';
    if (pref === 'both' && email) {
      await email.send(uid, message, type);
    } else if (pref === 'both' && !email) {
      // log stub
      const u = await prisma.user.findUnique({ where: { id: uid } });
      if (u) console.log(`[email stub] to=${u.email} subject=${type} body=${message}`);
    }
  }
};