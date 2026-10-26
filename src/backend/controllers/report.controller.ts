import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { applicationScope } from '../lib/access';

export const getConsolidatedReport = async (req: AuthRequest, res: Response) => {
  try {
    const format = (req.query.format as string) || 'json';
    const user = req.user!;
    const applications = await prisma.application.findMany({
      where: applicationScope(user),
      include: { institution: true, documents: true, inspections: true },
    });

    // pendency by stage
    const stageCounts: Record<string, number> = {};
    for (const a of applications) {
      if (['APPROVED', 'REJECTED'].includes(a.status)) continue;
      stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1;
    }
    const pendencyByStage = Object.entries(stageCounts).map(([stage, count]) => ({ stage, count }));

    // by region
    const regionCounts: Record<string, number> = {};
    for (const a of applications) {
      if (['APPROVED', 'REJECTED'].includes(a.status)) continue;
      const r = a.institution.region;
      regionCounts[r] = (regionCounts[r] || 0) + 1;
    }
    const pendencyByRegion = Object.entries(regionCounts).map(([region, count]) => ({ region, count }));

    // compliance by institution
    const instMap = new Map<string, { name: string; scores: number[] }>();
    for (const a of applications) {
      const approved = a.documents.filter((d) => d.status === 'APPROVED').length;
      const total = Math.max(1, a.documents.length);
      const score = Math.round((approved / total) * 100);
      const entry = instMap.get(a.institutionId) || { name: a.institution.name, scores: [] };
      entry.scores.push(score);
      instMap.set(a.institutionId, entry);
    }
    const complianceByInstitution = [...instMap.values()].map((v) => ({
      institution: v.name,
      avgScore: Math.round(v.scores.reduce((s, x) => s + x, 0) / v.scores.length),
    }));

    const overdueCases = applications
      .filter((a) => !['APPROVED', 'REJECTED'].includes(a.status) && new Date(a.deadline).getTime() < Date.now())
      .map((a) => ({ refId: a.refId, institution: a.institution.name, deadline: a.deadline, stage: a.stage }));

    const evcStatus = applications
      .filter((a) => a.stage === 'EVC')
      .map((a) => ({ refId: a.refId, institution: a.institution.name, stageEnteredAt: a.stageEnteredAt }));

    const undertakings = await prisma.undertaking.findMany({ include: { application: { include: { institution: true } } } });
    const undertakingCompliance = undertakings.map((u) => ({
      id: u.id,
      application: u.application.refId,
      institution: u.application.institution.name,
      status: u.status,
      dueDate: u.dueDate,
    }));

    const expiringDocs = await prisma.applicationDocument.findMany({
      where: { expiryDate: { not: null } },
      include: { application: { include: { institution: true } } },
    });
    const documentValidity = expiringDocs.map((d) => ({
      id: d.id,
      docType: d.docType,
      status: d.status,
      expiryDate: d.expiryDate,
      application: d.application.refId,
      institution: d.application.institution.name,
    }));

    const report = {
      generatedAt: new Date().toISOString(),
      pendencyByStage,
      pendencyByRegion,
      complianceByInstitution,
      overdueCases,
      evcStatus,
      undertakingCompliance,
      documentValidity,
    };

    if (format === 'csv') {
      const lines: string[] = [];
      lines.push('Section,Key,Value');
      for (const r of pendencyByStage) lines.push(`pendencyByStage,${r.stage},${r.count}`);
      for (const r of pendencyByRegion) lines.push(`pendencyByRegion,${r.region},${r.count}`);
      for (const r of complianceByInstitution) lines.push(`complianceByInstitution,${r.institution},${r.avgScore}`);
      for (const r of overdueCases) lines.push(`overdue,${r.refId},${r.deadline}`);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="consolidated-report.csv"');
      return res.send(lines.join('\n'));
    }

    res.json(report);
  } catch (error) {
    console.error('getConsolidatedReport error:', error);
    res.status(500).json({ message: 'Failed to build report' });
  }
};