import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { notifyUsers, notifyInstitution, recordAudit } from '../lib/audit';
import { STAGE_SLA_DAYS } from '../lib/config';

const sendOnce = async (key: string, fn: () => Promise<void>) => {
  const existing = await prisma.reminderLog.findUnique({ where: { key } });
  if (existing) return false;
  try {
    await prisma.reminderLog.create({ data: { key } });
  } catch {
    return false; // race
  }
  await fn();
  return true;
};

export interface SchedulerRunCounts {
  applicationsChecked: number;
  inspectionsChecked: number;
  documentsChecked: number;
  undertakingsChecked: number;
  remindersCreated: number;
  undertakingsMarkedOverdue: number;
  documentsMarkedExpired: number;
}

export const runJobs = async (): Promise<SchedulerRunCounts> => {
  const now = new Date();
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  const adminIds = admins.map((a) => a.id);
  const counts: SchedulerRunCounts = {
    applicationsChecked: 0,
    inspectionsChecked: 0,
    documentsChecked: 0,
    undertakingsChecked: 0,
    remindersCreated: 0,
    undertakingsMarkedOverdue: 0,
    documentsMarkedExpired: 0,
  };

  // 1. Deadline reminders (7 days, 1 day) for active applications
  const activeApps = await prisma.application.findMany({
    where: { status: { notIn: ['APPROVED', 'REJECTED'] } },
    include: { institution: true },
  });
  counts.applicationsChecked = activeApps.length;
  for (const app of activeApps) {
    const days = Math.ceil((new Date(app.deadline).getTime() - now.getTime()) / 86400000);
    for (const window of [7, 1]) {
      if (days === window) {
        const key = `deadline:${app.id}:${window}d`;
        const created = await sendOnce(key, async () => {
          if (app.assignedOfficerId) {
            await notifyUsers([app.assignedOfficerId], `${app.refId} is due in ${window} day(s).`, 'DEADLINE');
          }
          await notifyInstitution(app.institutionId, `${app.refId} deadline in ${window} day(s).`, 'DEADLINE');
        });
        if (created) counts.remindersCreated += 1;
      }
    }
    if (days < 0) {
      // overdue escalation
      const key = `deadline-overdue:${app.id}`;
      const created = await sendOnce(key, async () => {
        await notifyUsers(adminIds, `${app.refId} is overdue.`, 'ESCALATION');
        await recordAudit({ applicationId: app.id, actorId: adminIds[0] || app.assignedOfficerId || '', action: 'ESCALATED', entity: 'Application', entityId: app.id, metadata: { reason: 'deadline overdue' } });
      });
      if (created) counts.remindersCreated += 1;
    }
  }

  // 2. EVC reminders (due within 3 days) and escalation (overdue)
  const evcInspections = await prisma.inspection.findMany({
    where: { type: 'EVC', status: 'SCHEDULED' },
    include: { application: { include: { institution: true } } },
  });
  counts.inspectionsChecked = evcInspections.length;
  for (const insp of evcInspections) {
    const due = insp.dueDate || insp.inspectionDate;
    const days = Math.ceil((new Date(due).getTime() - now.getTime()) / 86400000);
    if (days <= 3 && days >= 0) {
      const key = `evc-reminder:${insp.id}:3d`;
      const created = await sendOnce(key, async () => {
        if (insp.application.assignedOfficerId) {
          await notifyUsers([insp.application.assignedOfficerId], `EVC for ${insp.application.refId} due in ${days} day(s).`, 'EVC');
        }
      });
      if (created) counts.remindersCreated += 1;
    }
    if (days < 0) {
      const key = `evc-overdue:${insp.id}`;
      const created = await sendOnce(key, async () => {
        await notifyUsers(adminIds, `EVC for ${insp.application.refId} is overdue.`, 'ESCALATION');
        await recordAudit({ applicationId: insp.applicationId, actorId: adminIds[0] || '', action: 'ESCALATED', entity: 'Inspection', entityId: insp.id, metadata: { reason: 'evc overdue' } });
      });
      if (created) counts.remindersCreated += 1;
    }
  }

  // 3. Document expiry alerts (30 days, 7 days) + overdue escalated
  const docs = await prisma.applicationDocument.findMany({
    where: { expiryDate: { not: null } },
    include: { application: { include: { institution: true } } },
  });
  counts.documentsChecked = docs.length;
  for (const doc of docs) {
    if (!doc.expiryDate) continue;
    const days = Math.ceil((new Date(doc.expiryDate).getTime() - now.getTime()) / 86400000);
    for (const window of [30, 7]) {
      if (days === window) {
        const key = `doc-expiry:${doc.id}:${window}d`;
        const created = await sendOnce(key, async () => {
          await notifyInstitution(doc.application.institutionId, `${doc.docType} for ${doc.application.refId} expires in ${window} day(s).`, 'DOCUMENT');
        });
        if (created) counts.remindersCreated += 1;
      }
    }
    if (days < 0 && doc.status === 'APPROVED') {
      const key = `doc-expired:${doc.id}`;
      const created = await sendOnce(key, async () => {
        await prisma.applicationDocument.update({ where: { id: doc.id }, data: { status: 'EXPIRED' } });
        await notifyUsers(adminIds, `${doc.docType} for ${doc.application.refId} has expired.`, 'ESCALATION');
        await recordAudit({ applicationId: doc.applicationId, actorId: adminIds[0] || '', action: 'ESCALATED', entity: 'ApplicationDocument', entityId: doc.id, metadata: { reason: 'document expired' } });
      });
      if (created) {
        counts.remindersCreated += 1;
        counts.documentsMarkedExpired += 1;
      }
    }
  }

  // 4. Undertaking overdue alerts
  const undertakings = await prisma.undertaking.findMany({
    where: { status: { in: ['PENDING', 'SUBMITTED'] } },
    include: { application: { include: { institution: true } } },
  });
  counts.undertakingsChecked = undertakings.length;
  for (const u of undertakings) {
    if (new Date(u.dueDate).getTime() < now.getTime()) {
      const key = `undertaking-overdue:${u.id}`;
      const created = await sendOnce(key, async () => {
        await prisma.undertaking.update({ where: { id: u.id }, data: { status: 'OVERDUE' } });
        await notifyInstitution(u.application.institutionId, `Undertaking overdue for ${u.application.refId}.`, 'UNDERTAKING');
        await notifyUsers(adminIds, `Undertaking overdue for ${u.application.refId}.`, 'ESCALATION');
        await recordAudit({ applicationId: u.applicationId, actorId: adminIds[0] || '', action: 'ESCALATED', entity: 'Undertaking', entityId: u.id, metadata: { reason: 'undertaking overdue' } });
      });
      if (created) {
        counts.remindersCreated += 1;
        counts.undertakingsMarkedOverdue += 1;
      }
    }
  }

  // 5. Escalation of applications stuck in a stage beyond SLA
  for (const app of activeApps) {
    const age = (now.getTime() - new Date(app.stageEnteredAt).getTime()) / 86400000;
    if (age > STAGE_SLA_DAYS) {
      const key = `stage-sla:${app.id}:${app.stage}`;
      const created = await sendOnce(key, async () => {
        await notifyUsers(adminIds, `${app.refId} stuck in ${app.stage} for ${Math.round(age)} days.`, 'ESCALATION');
        await recordAudit({ applicationId: app.id, actorId: adminIds[0] || '', action: 'ESCALATED', entity: 'Application', entityId: app.id, metadata: { reason: 'stage sla exceeded', stage: app.stage } });
      });
      if (created) counts.remindersCreated += 1;
    }
  }

  return counts;
};

let started = false;
export const startScheduler = () => {
  if (started) return;
  started = true;
  cron.schedule('0 * * * *', () => {
    runJobs().catch((e) => console.error('scheduler error:', e));
  });
};

export const stopScheduler = () => {
  started = false;
};