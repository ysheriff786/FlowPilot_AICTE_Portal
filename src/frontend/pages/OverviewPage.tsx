import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ClipboardCheck,
  Layers,
  ShieldAlert,
  TrendingUp,
  ArrowRight,
  Building2,
  FileCheck2,
} from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { AnalyticsSummary } from '../services/types';
import { ApplicationFormModal } from '../components/ApplicationFormModal';
import { InspectionModal } from '../components/InspectionModal';
import { ApplicationDetailModal } from '../components/ApplicationDetailModal';
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  formatDate,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui';

const PIPELINE_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-300',
  SUBMITTED: 'bg-sky-400',
  UNDER_REVIEW: 'bg-blue-600',
  CORRECTION_REQUIRED: 'bg-amber-400',
  RESUBMITTED: 'bg-sky-400',
  INSPECTION_PENDING: 'bg-cyan-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-red-500',
};

export const OverviewPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [pendency, setPendency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newApplicationOpen, setNewApplicationOpen] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<AnalyticsSummary>('/analytics/summary');
      setSummary(response.data);
      try {
        const p = await api.get('/analytics/pendency');
        setPendency(p.data);
      } catch {
        // ignore
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !summary) return <LoadingBlock label="Loading dashboard..." />;

  const totals = summary?.totals;
  const pipelineTotal = Math.max(1, summary?.applicationsByStatus.reduce((total, item) => total + item.count, 0) || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutional Overview"
        subtitle="Real-time regulatory throughput and compliance monitoring."
        actions={
          <>
            {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && (
              <button onClick={() => setInspectionOpen(true)} className={secondaryButtonClass}>
                <Calendar size={16} /> Schedule Inspection
              </button>
            )}
            {(user?.role === 'ADMIN' || user?.role === 'COLLEGE') && (
              <button onClick={() => setNewApplicationOpen(true)} className={primaryButtonClass}>
                <Layers size={16} /> New Application
              </button>
            )}
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          icon={Layers}
          label="Total Applications"
          value={totals?.applications ?? 0}
          hint={`${totals?.pendingScrutiny ?? 0} awaiting scrutiny`}
        />
        <StatCard
          icon={ClipboardCheck}
          label="Pending Scrutiny"
          value={totals?.pendingScrutiny ?? 0}
          hint={`${totals?.overdue ?? 0} past deadline`}
        />
        <StatCard
          icon={ShieldAlert}
          label="Correction Required"
          value={totals?.critical ?? 0}
          hint="Institutions need to act"
        />
        <StatCard
          icon={Calendar}
          label="Upcoming Inspections"
          value={totals?.scheduledInspections ?? 0}
          hint={`${summary?.inspections.completed ?? 0} completed`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center mb-6 gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Application Lifecycle</h2>
              <p className="text-xs text-slate-500">Live pipeline across all visible applications</p>
            </div>
            <button
              onClick={() => navigate('/analytics')}
              className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Analytics <ArrowRight size={13} />
            </button>
          </div>

          <div className="h-4 w-full bg-slate-100 rounded-full flex overflow-hidden p-0.5 gap-0.5 mb-5">
            {summary?.applicationsByStatus.map((item) =>
              item.count > 0 ? (
                <div
                  key={item.status}
                  className={`h-full ${PIPELINE_COLORS[item.status] || 'bg-slate-300'}`}
                  style={{ width: `${(item.count / pipelineTotal) * 100}%` }}
                  title={`${item.label}: ${item.count}`}
                />
              ) : null
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {summary?.applicationsByStatus
              .filter((item) => item.count > 0)
              .map((item) => (
                <span key={item.status} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <span className={`w-2 h-2 rounded-full ${PIPELINE_COLORS[item.status]}`} />
                  {item.label} <strong className="text-slate-800">{item.count}</strong>
                </span>
              ))}
            {summary?.applicationsByStatus.every((item) => item.count === 0) && (
              <span className="text-xs text-slate-500">No applications in the pipeline yet.</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-100">
            <MiniStat label="Institutions" value={totals?.institutions ?? 0} icon={Building2} />
            <MiniStat label="Documents" value={totals?.documents ?? 0} icon={FileCheck2} />
            <MiniStat label="Avg. Compliance" value={`${summary?.compliance.averageScore ?? 0}%`} icon={TrendingUp} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Upcoming Deadlines</h2>
            <button
              onClick={() => navigate('/applications')}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              View all
            </button>
          </div>
          {summary?.upcomingDeadlines.length ? (
            <ul className="divide-y divide-slate-100">
              {summary.upcomingDeadlines.slice(0, 5).map((application) => (
                <li key={application.id}>
                  <button
                    onClick={() => setSelectedApplication(application.id)}
                    className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-blue-600">{application.refId}</span>
                      <span className="text-xs text-slate-500">{formatDate(application.deadline)}</span>
                    </div>
                    <p className="text-sm text-slate-500 truncate mt-0.5">{application.institution}</p>
                    <div className="mt-1.5">
                      <StatusBadge status={application.status} withIcon={false} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No upcoming deadlines" description="All active applications are current." />
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Recent Applications</h2>
          <button
            onClick={() => navigate('/applications')}
            className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            Open applications <ArrowRight size={13} />
          </button>
        </div>
        {summary?.recentApplications.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-5 py-3">Application</th>
                  <th className="px-5 py-3">Institution</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Deadline</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.recentApplications.map((application) => (
                  <tr
                    key={application.id}
                    onClick={() => setSelectedApplication(application.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-sm font-bold text-blue-600">{application.refId}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{application.institution}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{application.category}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(application.deadline)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={application.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No applications yet"
            description={
              user?.role === 'COLLEGE'
                ? 'Create your first application to begin the approval workflow.'
                : 'Applications created by institutions will appear here.'
            }
          />
        )}
      </div>

      {pendency && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Stage ageing & pendency</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr><th className="px-4 py-2">Stage</th><th className="px-4 py-2">Count</th><th className="px-4 py-2">Avg age (days)</th><th className="px-4 py-2">Max age (days)</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendency.stages.map((s: any) => (
                  <tr key={s.stage}><td className="px-4 py-2">{s.stage}</td><td className="px-4 py-2">{s.count}</td><td className="px-4 py-2">{s.avgAgeDays}</td><td className="px-4 py-2">{s.maxAgeDays}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">Overdue: {pendency.overdue?.length ?? 0} · Approaching deadline: {pendency.approachingDeadline?.length ?? 0}</p>
          {user?.role === 'ADMIN' && pendency.officerPendency?.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-500 mb-2">Officer workload</h3>
              <ul className="space-y-1">
                {pendency.officerPendency.map((o: any) => (
                  <li key={o.officerId} className="text-sm text-slate-700">{o.name}: {o.pending} pending</li>
                ))}
              </ul>
            </div>
          )}
          {pendency.approachingDeadline?.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-500 mb-2">Approaching deadline</h3>
              <ul className="space-y-1">
                {pendency.approachingDeadline.map((a: any) => (
                  <li key={a.id} className="text-sm text-slate-700">{a.refId} — {new Date(a.deadline).toLocaleDateString()}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ApplicationFormModal
        open={newApplicationOpen}
        onClose={() => setNewApplicationOpen(false)}
        onCreated={() => load()}
      />
      <InspectionModal
        open={inspectionOpen}
        onClose={() => setInspectionOpen(false)}
        onCreated={() => load()}
      />
      <ApplicationDetailModal
        applicationId={selectedApplication}
        onClose={() => setSelectedApplication(null)}
        onChanged={load}
      />
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  hint: string;
}) => {
  return (
    <div className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-200">
      <div className="flex justify-between items-start mb-4">
        <span className="text-sm font-bold text-slate-500">{label}</span>
        <Icon size={18} className="text-slate-500" aria-hidden="true" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-slate-900">{value}</span>
      </div>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
  );
};

const MiniStat = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) => (
  <div className="flex items-center gap-2">
    <Icon size={15} className="text-slate-500 shrink-0" aria-hidden="true" />
    <div>
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="text-sm font-bold text-slate-900">{value}</p>
    </div>
  </div>
);
