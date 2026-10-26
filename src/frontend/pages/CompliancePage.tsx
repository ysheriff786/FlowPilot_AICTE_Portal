import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  Info,
  Layers,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import type { ApplicationSummary, ComplianceData } from '../services/types';
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  formatDate,
  inputClass,
  primaryButtonClass,
} from '../components/ui';

export const CompliancePage: React.FC = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [applicationId, setApplicationId] = useState('');
  const [data, setData] = useState<ComplianceData | null>(null);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const application = applications.find((entry) => entry.id === applicationId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const applicationsResponse = await api.get<ApplicationSummary[]>('/applications');
      setApplications(applicationsResponse.data);
      const nextId = applicationId || applicationsResponse.data[0]?.id || '';
      setApplicationId(nextId);
      if (nextId) {
        const complianceResponse = await api.get<ComplianceData>(`/documents/compliance/${nextId}`);
        setData(complianceResponse.data);
      }
      try {
        const exp = await api.get('/documents/expiring?days=30');
        setExpiring(exp.data);
      } catch {
        // ignore
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load compliance data'));
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectApplication = async (nextId: string) => {
    setApplicationId(nextId);
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ComplianceData>(`/documents/compliance/${nextId}`);
      setData(response.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load compliance data'));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) return <LoadingBlock label="Analysing compliance..." />;

  const score = data?.score ?? 0;
  const deadlineRisk = application
    ? Math.max(0, Math.ceil((new Date(application.deadline).getTime() - Date.now()) / 86400000))
    : null;
  const missing = data?.missingRequired ?? [];
  const attention = (data?.correctionCount ?? 0) + (data?.rejectedCount ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance Monitor"
        subtitle={
          application
            ? `Regulatory readiness for ${application.refId} · ${application.institution.name}.`
            : 'Regulatory readiness and risk assessment.'
        }
        actions={
          applications.length > 0 ? (
            <select
              value={applicationId}
              onChange={(event) => selectApplication(event.target.value)}
              className={`${inputClass} sm:w-72`}
            >
              {applications.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.refId} — {entry.institution.name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {!application ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState
            icon={Layers}
            title="No applications yet"
            description="Create an application to start compliance analysis."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center">
              <div className="flex justify-center mb-5">
                <div
                  className={`w-36 h-36 rounded-full border-8 flex items-center justify-center ${
                    score >= 80 ? 'border-emerald-500' : score >= 50 ? 'border-amber-500' : 'border-red-500'
                  }`}
                >
                  <div>
                    <span className="text-4xl font-bold text-slate-900">{score}%</span>
                    <p className="text-xs font-bold text-slate-500 mt-1">Compliance</p>
                  </div>
                </div>
              </div>
              <h3 className={`text-lg font-bold ${score === 100 ? 'text-emerald-600' : 'text-slate-900'}`}>
                {data?.status || 'Evaluating'}
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                {data?.approvedCount ?? 0} of {data?.totalRequired ?? 0} required documents approved.
              </p>
              <div className="mt-5">
                <StatusBadge status={application.status} />
              </div>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-5 gap-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Info size={18} className="text-blue-600" /> Compliance breakdown
                </h3>
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                  Live data
                </span>
              </div>

              <div className="space-y-4">
                <RiskBar
                  label="Verified documents"
                  value={data?.approvedCount ?? 0}
                  total={data?.totalRequired ?? 1}
                  color="bg-emerald-500"
                />
                <RiskBar
                  label="Awaiting review"
                  value={data?.pendingCount ?? 0}
                  total={Math.max(1, data?.totalRequired ?? 1)}
                  color="bg-slate-400"
                />
                <RiskBar
                  label="Corrections / rejected"
                  value={attention}
                  total={Math.max(1, data?.totalRequired ?? 1)}
                  color="bg-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
                <Metric label="Pending" value={data?.pendingCount ?? 0} icon={Clock} tone="text-slate-600" />
                <Metric
                  label="Corrections"
                  value={data?.correctionCount ?? 0}
                  icon={FileWarning}
                  tone="text-amber-700"
                />
                <Metric label="Rejected" value={data?.rejectedCount ?? 0} icon={XCircle} tone="text-red-700" />
                <Metric
                  label="Deadline"
                  value={deadlineRisk !== null ? `${deadlineRisk}d` : '—'}
                  icon={Clock}
                  tone={deadlineRisk !== null && deadlineRisk <= 3 ? 'text-red-700' : 'text-slate-600'}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                <FileWarning size={18} className="text-amber-500" /> Missing required documents
              </h3>
              {missing.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 size={16} /> Every required document has been approved.
                </div>
              ) : (
                <ul className="space-y-2">
                  {missing.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-sm text-slate-700 p-2.5 bg-amber-50/60 border border-amber-100 rounded-lg"
                    >
                      <AlertTriangle size={14} className="text-amber-500 shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                <ShieldCheck size={18} className="text-blue-600" /> Recommended next step
              </h3>
              <p className="text-sm text-slate-600">
                {missing.length > 0
                  ? `Request the institution upload the ${missing.length} outstanding document${
                      missing.length > 1 ? 's' : ''
                    } before final approval.`
                  : attention > 0
                  ? 'Resolve documents marked for correction or rejection, then re-run verification.'
                  : 'All statutory requirements are met. The application can proceed to final approval.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => navigate(`/verification?application=${application.id}`)}
                  className={primaryButtonClass}
                >
                  Open verification studio
                </button>
                <span className="text-xs text-slate-500 self-center">
                  Deadline {formatDate(application.deadline)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Expiring and expired documents (next 30 days)</h2>
        {expiring.length === 0 ? (
          <p className="text-sm text-slate-500">No expiring documents.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {expiring.map((d: any) => (
              <li key={d.id} className="py-2 flex items-center justify-between">
                <span className="text-sm text-slate-700">{d.docType} — {d.refId}</span>
                <span className={`text-xs font-bold ${d.expired ? 'text-red-700' : 'text-amber-700'}`}>
                  {d.expired ? 'Expired' : new Date(d.expiryDate).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const RiskBar = ({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) => {
  const percentage = Math.min(100, Math.round((value / Math.max(1, total)) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs font-medium mb-1.5">
        <span className="text-slate-700">{label}</span>
        <span className="text-slate-500 tabular-nums">
          {value} / {total}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

const Metric = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone: string;
}) => (
  <div>
    <div className={`flex items-center gap-1 text-xs font-bold ${tone}`}>
      <Icon size={12} /> {label}
    </div>
    <p className="text-lg font-bold text-slate-900 mt-1">{value}</p>
  </div>
);
