export type StageKey =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CORRECTION_REQUIRED'
  | 'RESUBMITTED'
  | 'INSPECTION_PENDING'
  | 'APPROVED';

export type DocumentState = 'Uploaded' | 'Approved' | 'Correction requested' | 'Pending';

export interface CaseDocument {
  name: string;
  state: DocumentState;
  detail: string;
}

export interface Stage {
  key: StageKey;
  label: string;
  short: string;
  date: string;
  actor: string;
  action: string;
  gate: string;
  summary: string;
  next: string;
  note: string;
  documents: CaseDocument[];
  audit: string;
}

export const CASE_META = {
  ref: 'AICTE/2026/0412',
  institution: 'Aruna College of Engineering',
  category: 'Engineering',
  state: 'Tamil Nadu',
  region: 'South',
  year: '2026–27',
};

const BASE_DOCUMENTS: CaseDocument[] = [
  { name: 'Affiliation letter', state: 'Uploaded', detail: 'PDF · 1.2 MB' },
  { name: 'Faculty list', state: 'Uploaded', detail: 'PDF · 840 KB' },
  { name: 'Land documents', state: 'Uploaded', detail: 'PDF · 2.4 MB' },
  { name: 'Financial statement', state: 'Uploaded', detail: 'PDF · 1.1 MB' },
];

export const STAGES: Stage[] = [
  {
    key: 'SUBMITTED',
    label: 'Submitted',
    short: 'Submitted',
    date: '12 Aug 2026 · 09:42',
    actor: 'College',
    action: 'Application submitted',
    gate: 'All required documents present',
    summary:
      'Submitted. Four of four required documents are present. The submission gate has passed and the file is waiting for an officer.',
    next: 'An officer begins document verification.',
    note: 'Submission gate passed: 4 of 4 required documents present.',
    documents: BASE_DOCUMENTS,
    audit: 'Draft → Submitted',
  },
  {
    key: 'UNDER_REVIEW',
    label: 'Under review',
    short: 'Review',
    date: '14 Aug 2026 · 10:15',
    actor: 'Officer',
    action: 'Document verification',
    gate: 'Every document must be approved',
    summary:
      'Under review. Two documents are approved and two are still with the officer. Approval is blocked until every required document is approved.',
    next: 'Approve, reject or request a correction on each document.',
    note: 'Two documents approved; two still in the officer’s queue.',
    documents: [
      { name: 'Affiliation letter', state: 'Approved', detail: 'Checked 14 Aug' },
      { name: 'Faculty list', state: 'Pending', detail: 'In the officer’s queue' },
      { name: 'Land documents', state: 'Approved', detail: 'Checked 14 Aug' },
      { name: 'Financial statement', state: 'Pending', detail: 'In the officer’s queue' },
    ],
    audit: 'Submitted → Under review',
  },
  {
    key: 'CORRECTION_REQUIRED',
    label: 'Correction required',
    short: 'Correction',
    date: '18 Aug 2026 · 11:03',
    actor: 'Officer',
    action: 'Correction requested',
    gate: 'A comment travels with the request',
    summary:
      'Correction required. The faculty list needs the 2025–26 approved list. The request carries a comment, so the college knows exactly what to fix.',
    next: 'The college uploads the corrected faculty list and resubmits.',
    note: 'Attach the 2025–26 approved faculty list. The current file is for 2024–25.',
    documents: [
      { name: 'Affiliation letter', state: 'Approved', detail: 'Checked 14 Aug' },
      { name: 'Faculty list', state: 'Correction requested', detail: 'Comment added 18 Aug' },
      { name: 'Land documents', state: 'Approved', detail: 'Checked 14 Aug' },
      { name: 'Financial statement', state: 'Approved', detail: 'Checked 18 Aug' },
    ],
    audit: 'Under review → Correction required',
  },
  {
    key: 'RESUBMITTED',
    label: 'Resubmitted',
    short: 'Resubmitted',
    date: '21 Aug 2026 · 16:40',
    actor: 'College',
    action: 'Application resubmitted',
    gate: 'The answer stays on the same file',
    summary:
      'Resubmitted. The corrected faculty list is on the same record. Three of four documents are approved; the corrected document is back in verification.',
    next: 'The officer verifies the corrected document.',
    note: 'Corrected faculty list uploaded. Three of four documents are approved.',
    documents: [
      { name: 'Affiliation letter', state: 'Approved', detail: 'Checked 14 Aug' },
      { name: 'Faculty list', state: 'Uploaded', detail: 'Replaced 21 Aug' },
      { name: 'Land documents', state: 'Approved', detail: 'Checked 14 Aug' },
      { name: 'Financial statement', state: 'Approved', detail: 'Checked 18 Aug' },
    ],
    audit: 'Correction required → Resubmitted',
  },
  {
    key: 'INSPECTION_PENDING',
    label: 'Inspection pending',
    short: 'Inspection',
    date: '02 Sep 2026 · 09:20',
    actor: 'Officer',
    action: 'Expert committee visit scheduled',
    gate: 'The EVC queue has no unscheduled file',
    summary:
      'Inspection pending. Every document is approved. The expert committee visit is scheduled for 14 September at 10:30.',
    next: 'Complete the expert committee visit and record the report.',
    note: 'Visit scheduled for 14 Sep 2026, 10:30. Report due before the final decision.',
    documents: BASE_DOCUMENTS.map((document) => ({
      ...document,
      state: 'Approved' as const,
      detail: 'Verified before inspection',
    })),
    audit: 'Resubmitted → Inspection pending',
  },
  {
    key: 'APPROVED',
    label: 'Approved',
    short: 'Approved',
    date: '27 Sep 2026 · 12:02',
    actor: 'Officer',
    action: 'Application approved',
    gate: 'The stage change is written to the audit trail',
    summary:
      'Approved. The application moved from inspection pending to approved. The stage change is written to the audit trail, and the file enters compliance watch.',
    next: 'Compliance watch: documents, undertakings and reminders.',
    note: 'Sanction recorded. The file moves into compliance watch.',
    documents: BASE_DOCUMENTS.map((document) => ({
      ...document,
      state: 'Approved' as const,
      detail: 'Verified before approval',
    })),
    audit: 'Inspection pending → Approved',
  },
];

export const AUDIT_ROWS = [
  {
    time: '12 Aug · 09:42',
    actor: 'college@aruna.edu',
    action: 'Submitted application',
    from: 'Draft',
    to: 'Submitted',
  },
  {
    time: '14 Aug · 10:15',
    actor: 'officer@aicte.gov.in',
    action: 'Started document review',
    from: 'Submitted',
    to: 'Under review',
  },
  {
    time: '18 Aug · 11:03',
    actor: 'officer@aicte.gov.in',
    action: 'Requested a correction',
    from: 'Under review',
    to: 'Correction required',
  },
  {
    time: '21 Aug · 16:40',
    actor: 'college@aruna.edu',
    action: 'Resubmitted application',
    from: 'Correction required',
    to: 'Resubmitted',
  },
  {
    time: '02 Sep · 09:20',
    actor: 'officer@aicte.gov.in',
    action: 'Scheduled the EVC visit',
    from: 'Resubmitted',
    to: 'Inspection pending',
  },
  {
    time: '27 Sep · 12:02',
    actor: 'officer@aicte.gov.in',
    action: 'Approved application',
    from: 'Inspection pending',
    to: 'Approved',
  },
];

export const SCOPES = [
  {
    role: 'College',
    sees: 'Its own institution only',
    acts: 'Upload documents, submit and resubmit',
    cannot: 'Open another institution’s file',
  },
  {
    role: 'Officer',
    sees: 'Applications assigned by routing',
    acts: 'Verify documents, request corrections, schedule inspections',
    cannot: 'See an unassigned file',
  },
  {
    role: 'Administrator',
    sees: 'Every application and all reference data',
    acts: 'Configure routing and requirements, manage users, review audit, export reports',
    cannot: 'Skip a workflow gate',
  },
];

export const WATCHLIST = [
  {
    name: 'Fire safety certificate',
    meta: 'Expires 06 Nov 2026',
    value: '10 days',
    tone: 'amber' as const,
  },
  {
    name: 'Faculty approval list',
    meta: 'Expires 24 Nov 2026',
    value: '28 days',
    tone: 'quiet' as const,
  },
  {
    name: 'Land lease agreement',
    meta: 'Expired 24 Oct 2026',
    value: '3 days late',
    tone: 'red' as const,
  },
];

export const UNDERTAKING = {
  title: 'Library upgrade',
  due: 'Due 31 Dec 2026',
  state: 'Evidence uploaded',
  detail: 'Verification pending',
};

export const INSPECTION = {
  ref: 'AICTE/2026/0412',
  date: '14 Nov 2026 · 10:30',
  state: 'Scheduled',
  detail: 'First compliance visit · Three-member committee',
};

export const FAQS = [
  {
    question: 'Who gets an account?',
    answer:
      'Only accounts an administrator creates. The first run creates one administrator; there is no public registration. That administrator adds officers and college users, and assigns each college to its institution.',
  },
  {
    question: 'What blocks a submission?',
    answer:
      'A missing required document stops submission. A required document that has not been approved stops approval. A correction request must carry a comment, so the college knows exactly what to fix.',
  },
  {
    question: 'Can a college see another institution’s file?',
    answer:
      'No. College users see their own institution, officers see the applications assigned to them, and administrators see all applications and reference data.',
  },
  {
    question: 'What happens after approval?',
    answer:
      'Documents stay on a 30-day expiry watch, undertakings are tracked through evidence and verification, inspections are scheduled and completed, and the scheduler sends each reminder once.',
  },
  {
    question: 'Where does the audit trail live?',
    answer:
      'The audit trail is append-only. Every write records the actor, action and from/to status, and administrators and officers can export a consolidated CSV.',
  },
  {
    question: 'How does first-run setup work?',
    answer:
      'The first visit creates the administrator at the setup screen. That administrator enters the routing rules, state-to-region mappings, document requirements and institutions before any application is created.',
  },
];

export const NAV_LINKS = [
  { href: '#the-file', label: 'The file' },
  { href: '#gates', label: 'The gates' },
  { href: '#record', label: 'The record' },
  { href: '#questions', label: 'Questions' },
];
