export type AppStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CORRECTION_REQUIRED'
  | 'RESUBMITTED'
  | 'INSPECTION_PENDING'
  | 'APPROVED'
  | 'REJECTED';

export type DocStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED';

export interface Institution {
  id: string;
  name: string;
  type: string;
  address: string;
  state: string;
  email: string;
  phone: string;
  category: string;
  academicYear: string;
  region?: string;
  isNew?: boolean;
  createdAt?: string;
  _count?: { applications: number; users: number };
}

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  docType: string;
  status: DocStatus;
  filePath: string;
  uploadDate: string;
  expiryDate?: string | null;
  version: number;
  officerComment?: string | null;
}

export interface Review {
  id: string;
  comment: string;
  statusChange?: string | null;
  createdAt: string;
  officer: { id: string; name: string };
}

export interface Inspection {
  id: string;
  applicationId: string;
  inspectionDate: string;
  location: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes?: string | null;
  createdAt: string;
  application?: {
    id: string;
    refId: string;
    status: string;
    institution: { id: string; name: string };
  };
}

export interface ApplicationSummary {
  id: string;
  refId: string;
  institutionId: string;
  academicYear: string;
  category: string;
  status: AppStatus;
  submissionDate?: string | null;
  deadline: string;
  assignedOfficerId?: string | null;
  assignedOfficer?: { id: string; name: string } | null;
  institution: { id: string; name: string; type: string };
  _count?: { documents: number };
  createdAt: string;
}

export interface ApplicationDetail extends ApplicationSummary {
  documents: ApplicationDocument[];
  reviews: Review[];
  inspections: Inspection[];
}

export interface NotificationItem {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: string | null;
  timestamp: string;
  actor: { id: string; name: string; email: string; role: string };
  application?: { id: string; refId: string; institution: { name: string } } | null;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OFFICER' | 'COLLEGE';
  institutionId?: string | null;
  institution?: { id: string; name: string } | null;
  createdAt: string;
}

export interface ComplianceData {
  applicationId: string;
  score: number;
  approvedCount: number;
  pendingCount: number;
  correctionCount: number;
  rejectedCount: number;
  totalRequired: number;
  missingRequired: string[];
  status: string;
}

export interface AnalyticsSummary {
  totals: {
    applications: number;
    institutions: number;
    documents: number;
    users?: number;
    overdue: number;
    pendingScrutiny: number;
    critical: number;
    scheduledInspections: number;
  };
  applicationsByStatus: { status: AppStatus; label: string; count: number }[];
  applicationsByCategory: { category: string; count: number }[];
  documentsByStatus: { status: DocStatus; label: string; count: number }[];
  compliance: {
    averageScore: number;
    approved: number;
    pending: number;
    correction: number;
    rejected: number;
  };
  inspections: {
    total: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    upcoming: {
      id: string;
      refId?: string;
      inspectionDate: string;
      location: string;
      status: string;
    }[];
  };
  recentApplications: {
    id: string;
    refId: string;
    institution: string;
    category: string;
    status: AppStatus;
    deadline: string;
  }[];
  upcomingDeadlines: {
    id: string;
    refId: string;
    institution: string;
    deadline: string;
    status: AppStatus;
  }[];
  monthlySubmissions: { month: string; label: string; count: number }[];
}
