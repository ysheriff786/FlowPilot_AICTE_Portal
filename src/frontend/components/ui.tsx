import React, { useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

const STATUS_STYLES: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-600', icon: FileText },
  SUBMITTED: { label: 'Submitted', className: 'bg-sky-100 text-sky-700', icon: Clock },
  UNDER_REVIEW: { label: 'Under Review', className: 'bg-blue-100 text-blue-700', icon: Clock },
  CORRECTION_REQUIRED: {
    label: 'Correction Req.',
    className: 'bg-amber-100 text-amber-700',
    icon: AlertTriangle,
  },
  RESUBMITTED: { label: 'Resubmitted', className: 'bg-sky-100 text-sky-700', icon: Clock },
  INSPECTION_PENDING: {
    label: 'Inspection Pending',
    className: 'bg-cyan-100 text-cyan-700',
    icon: Clock,
  },
  APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700', icon: XCircle },
  PENDING: { label: 'Pending', className: 'bg-slate-100 text-slate-600', icon: Clock },
  SCHEDULED: { label: 'Scheduled', className: 'bg-cyan-100 text-cyan-700', icon: Clock },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-700', icon: XCircle },
};

export const StatusBadge: React.FC<{ status: string; withIcon?: boolean }> = ({
  status,
  withIcon = true,
}) => {
  const config = STATUS_STYLES[status] || {
    label: status.replaceAll('_', ' '),
    className: 'bg-slate-100 text-slate-600',
    icon: FileText,
  };
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[13px] font-bold whitespace-nowrap ${config.className}`}
    >
      {withIcon && <Icon size={12} />}
      {config.label}
    </span>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon = FileText, title, description, action }) => (
  <div className="p-12 text-center">
    <div className="w-14 h-14 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
      <Icon size={26} />
    </div>
    <h3 className="font-bold text-slate-900">{title}</h3>
    {description && <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{description}</p>}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
    <span className="flex items-start gap-2">
      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
      {message}
    </span>
    {onRetry && (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg font-semibold hover:bg-red-100 transition-colors self-start sm:self-auto"
      >
        <RefreshCw size={14} /> Retry
      </button>
    )}
  </div>
);

export const LoadingBlock: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <div className="flex items-center justify-center gap-2 h-64 text-slate-500">
    <Loader2 size={18} className="animate-spin" />
    {label}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        className={`relative w-full ${widths[size]} bg-white rounded-2xl shadow-2xl border border-slate-200 my-8`} /* taste-skill-ignore */
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 max-h-[65vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const Spinner: React.FC<{ size?: number; className?: string }> = ({
  size = 16,
  className = '',
}) => <Loader2 size={size} className={`animate-spin ${className}`} />;

export const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, children, hint }) => (
  <label className="block">
    <span className="block text-sm font-medium text-slate-700 mb-1.5">
      {label}
    </span>
    {children}
    {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
  </label>
);

export const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-white';

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-600 text-sm font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const dangerButtonClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export const relativeTime = (value: string) => {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
};
