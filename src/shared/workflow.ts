export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CORRECTION_REQUIRED',
  'RESUBMITTED',
  'INSPECTION_PENDING',
  'APPROVED',
  'REJECTED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const DOCUMENT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUIRED', 'EXPIRED'] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const USER_ROLES = ['COLLEGE', 'OFFICER', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const OFFICER_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW', 'CORRECTION_REQUIRED', 'REJECTED'],
  UNDER_REVIEW: ['INSPECTION_PENDING', 'CORRECTION_REQUIRED', 'APPROVED', 'REJECTED'],
  CORRECTION_REQUIRED: ['RESUBMITTED', 'REJECTED'],
  RESUBMITTED: ['UNDER_REVIEW', 'CORRECTION_REQUIRED', 'REJECTED'],
  INSPECTION_PENDING: ['APPROVED', 'CORRECTION_REQUIRED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
};

export const COLLEGE_SUBMITTABLE: ApplicationStatus[] = ['DRAFT', 'CORRECTION_REQUIRED'];

export const statusLabel = (status: string) =>
  status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const isApplicationStatus = (value: unknown): value is ApplicationStatus =>
  typeof value === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(value);

export const isDocumentStatus = (value: unknown): value is DocumentStatus =>
  typeof value === 'string' && (DOCUMENT_STATUSES as readonly string[]).includes(value);

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);

// Frontend compatibility alias
export type AppStatus = ApplicationStatus;
export const APP_STATUSES = APPLICATION_STATUSES;
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  CORRECTION_REQUIRED: 'Correction Required',
  RESUBMITTED: 'Resubmitted',
  INSPECTION_PENDING: 'Inspection Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const allowedTransitions = (role: string | undefined, status: ApplicationStatus): ApplicationStatus[] => {
  if (status === 'APPROVED' || status === 'REJECTED') return [];
  if (role === 'ADMIN') return APPLICATION_STATUSES.filter((value) => value !== status);
  if (role === 'OFFICER') return OFFICER_TRANSITIONS[status] ?? [];
  return [];
};

export const COMMON_DOC_TYPES = [
  'Application Form',
  'Land Use Certificate',
  'Fire Safety NOC',
  'Structural Stability Certificate',
  'Faculty Qualification Records',
  'Building Plan Approval',
  'Library Facilities Report',
  'Laboratory Safety Audit',
  'Anti-Ragging Committee Declaration',
  'Affiliation Certificate',
  'Financial Solvency Certificate',
  'Other Supporting Document',
];