import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { applicationScope } from '../lib/access';
import { APPLICATION_STATUSES, DOCUMENT_STATUSES, statusLabel } from '../lib/workflow';

const TERMINAL_STATUSES = ['APPROVED', 'REJECTED'];

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export const getAnalyticsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const applications = await prisma.application.findMany({
      where: applicationScope(user),
      include: {
        institution: { select: { id: true, name: true } },
        documents: true,
        inspections: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    const applicationsByStatus = APPLICATION_STATUSES.map((status) => ({
      status,
      label: statusLabel(status),
      count: applications.filter((application) => application.status === status).length,
    }));

    const categoryCounts = new Map<string, number>();
    for (const application of applications) {
      categoryCounts.set(application.category, (categoryCounts.get(application.category) || 0) + 1);
    }
    const applicationsByCategory = [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const documents = applications.flatMap((application) => application.documents);
    const documentsByStatus = DOCUMENT_STATUSES.map((status) => ({
      status,
      label: statusLabel(status),
      count: documents.filter((document) => document.status === status).length,
    }));

    const scores = applications.map((application) => {
      const approved = application.documents.filter((document) => document.status === 'APPROVED').length;
      return Math.min(100, Math.round((approved / 10) * 100));
    });

    const inspections = applications.flatMap((application) => application.inspections);
    const upcomingInspections = inspections
      .filter(
        (inspection) =>
          inspection.status === 'SCHEDULED' && new Date(inspection.inspectionDate).getTime() >= now.getTime()
      )
      .sort(
        (a, b) => new Date(a.inspectionDate).getTime() - new Date(b.inspectionDate).getTime()
      );

    const activeApplications = applications.filter(
      (application) => !TERMINAL_STATUSES.includes(application.status)
    );

    const upcomingDeadlines = activeApplications
      .filter((application) => new Date(application.deadline).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 6)
      .map((application) => ({
        id: application.id,
        refId: application.refId,
        institution: application.institution.name,
        deadline: application.deadline,
        status: application.status,
      }));

    const months: string[] = [];
    for (let index = 5; index >= 0; index -= 1) {
      months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - index, 1)));
    }
    const monthlySubmissions = months.map((month) => ({
      month,
      label: monthLabel(month),
      count: applications.filter((application) => {
        const date = application.submissionDate || application.createdAt;
        return monthKey(new Date(date)) === month;
      }).length,
    }));

    const recentApplications = applications.slice(0, 5).map((application) => ({
      id: application.id,
      refId: application.refId,
      institution: application.institution.name,
      category: application.category,
      status: application.status,
      deadline: application.deadline,
    }));

    const overdueCount = activeApplications.filter(
      (application) => new Date(application.deadline).getTime() < now.getTime()
    ).length;

    const pendingScrutiny = applications.filter((application) =>
      ['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'].includes(application.status)
    ).length;
    const critical = applications.filter(
      (application) => application.status === 'CORRECTION_REQUIRED'
    ).length;

    res.json({
      totals: {
        applications: applications.length,
        institutions: new Set(applications.map((application) => application.institutionId)).size,
        documents: documents.length,
        users: user.role === 'ADMIN' ? await prisma.user.count() : undefined,
        overdue: overdueCount,
        pendingScrutiny,
        critical,
        scheduledInspections: upcomingInspections.length,
      },
      applicationsByStatus,
      applicationsByCategory,
      documentsByStatus,
      compliance: {
        averageScore: scores.length
          ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
          : 0,
        approved: documents.filter((document) => document.status === 'APPROVED').length,
        pending: documents.filter((document) => document.status === 'PENDING').length,
        correction: documents.filter((document) => document.status === 'CORRECTION_REQUIRED').length,
        rejected: documents.filter((document) => document.status === 'REJECTED').length,
      },
      inspections: {
        total: inspections.length,
        scheduled: inspections.filter((inspection) => inspection.status === 'SCHEDULED').length,
        completed: inspections.filter((inspection) => inspection.status === 'COMPLETED').length,
        cancelled: inspections.filter((inspection) => inspection.status === 'CANCELLED').length,
        upcoming: upcomingInspections.slice(0, 5).map((inspection) => ({
          id: inspection.id,
          refId: applications.find((application) => application.id === inspection.applicationId)?.refId,
          inspectionDate: inspection.inspectionDate,
          location: inspection.location,
          status: inspection.status,
        })),
      },
      recentApplications,
      upcomingDeadlines,
      monthlySubmissions,
    });
  } catch (error) {
    console.error('getAnalyticsSummary error:', error);
    res.status(500).json({ message: 'Failed to build analytics summary' });
  }
};

export const getPendency = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const applications = await prisma.application.findMany({
      where: applicationScope(user),
      include: {
        institution: { select: { id: true, name: true, region: true } },
        assignedOfficer: { select: { id: true, name: true } },
      },
    });
    const now = new Date();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    // per stage
    const stages = ['SCRUTINY', 'EVC', 'SAC_SHC', 'DONE'];
    const stageStats = stages.map((stage) => {
      const apps = applications.filter((a) => a.stage === stage && !['APPROVED', 'REJECTED'].includes(a.status) === (stage !== 'DONE'));
      const active = applications.filter((a) => a.stage === stage);
      const ages = active.map((a) => (now.getTime() - new Date(a.stageEnteredAt).getTime()) / 86400000);
      return {
        stage,
        count: active.length,
        avgAgeDays: ages.length ? Math.round((ages.reduce((s, v) => s + v, 0) / ages.length) * 10) / 10 : 0,
        maxAgeDays: ages.length ? Math.round(Math.max(...ages) * 10) / 10 : 0,
      };
    });

    // per officer (admin only)
    const officerPendency: any[] = [];
    if (user.role === 'ADMIN') {
      const officers = await prisma.user.findMany({ where: { role: 'OFFICER' }, select: { id: true, name: true } });
      for (const o of officers) {
        const apps = applications.filter((a) => a.assignedOfficerId === o.id && !['APPROVED', 'REJECTED'].includes(a.status));
        officerPendency.push({ officerId: o.id, name: o.name, pending: apps.length });
      }
    }

    // by region
    const regionCounts: Record<string, number> = {};
    for (const a of applications) {
      if (['APPROVED', 'REJECTED'].includes(a.status)) continue;
      const r = a.institution.region;
      regionCounts[r] = (regionCounts[r] || 0) + 1;
    }
    const byRegion = Object.entries(regionCounts).map(([region, count]) => ({ region, count }));

    // approaching deadline (within 7 days) and overdue
    const active = applications.filter((a) => !['APPROVED', 'REJECTED'].includes(a.status));
    const approachingDeadline = active
      .filter((a) => {
        const d = new Date(a.deadline).getTime() - now.getTime();
        return d >= 0 && d <= sevenDays;
      })
      .map((a) => ({ id: a.id, refId: a.refId, deadline: a.deadline, stage: a.stage }));
    const overdue = active
      .filter((a) => new Date(a.deadline).getTime() < now.getTime())
      .map((a) => ({ id: a.id, refId: a.refId, deadline: a.deadline, stage: a.stage }));

    // bottleneck stage
    const bottleneck = [...stageStats].sort((a, b) => b.avgAgeDays - a.avgAgeDays)[0];

    res.json({
      stages: stageStats,
      officerPendency,
      byRegion,
      approachingDeadline,
      overdue,
      bottleneckStage: bottleneck?.stage,
    });
  } catch (error) {
    console.error('getPendency error:', error);
    res.status(500).json({ message: 'Failed to build pendency' });
  }
};
