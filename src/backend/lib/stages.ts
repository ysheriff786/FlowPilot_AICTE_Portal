export const statusToStage = (status: string): string => {
  if (['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED', 'CORRECTION_REQUIRED', 'DRAFT'].includes(status)) return 'SCRUTINY';
  if (status === 'INSPECTION_PENDING') return 'EVC';
  if (status === 'APPROVED' || status === 'REJECTED') return 'DONE';
  return 'SCRUTINY';
};

