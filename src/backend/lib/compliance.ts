import { prisma } from './prisma';

export interface ComplianceResult {
  score: number;
  requiredCount: number;
  approvedCount: number;
  missing: string[];
  compliant: boolean;
}

interface AppLike {
  id: string;
  category: string;
  academicYear: string;
  documents: { docType: string; status: string }[];
}

export const computeCompliance = async (application: AppLike): Promise<ComplianceResult> => {
  const requirements = await prisma.documentRequirement.findMany({
    where: { category: application.category, academicYear: application.academicYear, isRequired: true },
    select: { docType: true },
  });
  return computeComplianceFromRequirements(application, requirements.map((r) => r.docType));
};

export const computeComplianceFromRequirements = (
  application: AppLike,
  requiredTypes: string[]
): ComplianceResult => {
  const approvedTypes = new Set(
    application.documents.filter((d) => d.status === 'APPROVED').map((d) => d.docType)
  );
  const requiredCount = requiredTypes.length;
  const approvedCount = requiredTypes.filter((t) => approvedTypes.has(t)).length;
  const missing = requiredTypes.filter((t) => !approvedTypes.has(t));
  const score = requiredCount === 0 ? 0 : Math.round((approvedCount / requiredCount) * 100);
  return { score, requiredCount, approvedCount, missing, compliant: requiredCount > 0 && missing.length === 0 };
};

export const computeComplianceBatch = async (applications: AppLike[]): Promise<Map<string, ComplianceResult>> => {
  const keys = new Set(applications.map((a) => `${a.category}::${a.academicYear}`));
  const reqMap = new Map<string, string[]>();
  await Promise.all(
    [...keys].map(async (key) => {
      const [category, academicYear] = key.split('::');
      const requirements = await prisma.documentRequirement.findMany({
        where: { category, academicYear, isRequired: true },
        select: { docType: true },
      });
      reqMap.set(key, requirements.map((r) => r.docType));
    })
  );
  const result = new Map<string, ComplianceResult>();
  for (const app of applications) {
    const requiredTypes = reqMap.get(`${app.category}::${app.academicYear}`) || [];
    result.set(app.id, computeComplianceFromRequirements(app, requiredTypes));
  }
  return result;
};