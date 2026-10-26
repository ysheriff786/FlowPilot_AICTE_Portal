import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Calendar,
  FileText,
  Layers,
  ShieldAlert,
  TrendingUp,
  Users,
  Building2,
} from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { AnalyticsSummary } from '../services/types';
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  formatDate,
  formatDateTime,
} from '../components/ui';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-400',
  SUBMITTED: 'bg-sky-400',
  UNDER_REVIEW: 'bg-blue-600',
  CORRECTION_REQUIRED: 'bg-amber-400',
  RESUBMITTED: 'bg-sky-400',
  INSPECTION_PENDING: 'bg-cyan-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-red-500',
  PENDING: 'bg-slate-400',
};

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [pendency, setPendency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setError(getErrorMessage(err, 'Could not load analytics'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !summary) return <LoadingBlock label="Crunching analytics..." />;

  const maxStatus = Math.max(1, ...(summary?.applicationsByStatus.map((item) => item.count) || [1]));
  const maxCategory = Math.max(1, ...(summary?.applicationsByCategory.map((item) => item.count) || [1]));
  const maxMonth = Math.max(1, ...(summary?.monthlySubmissions.map((item) => item.count) || [1]));
  const documentTotal = Math.max(
    1,
    summary?.documentsByStatus.reduce((total, item) => total + item.count, 0) || 1
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & Intelligence"
        subtitle="Live throughput, compliance and workload metrics across your scope."
        actions={
          <>
            <span className="text-xs font-bold bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg">
              Live data · no estimates
            </span>
            <button
              onClick={async () => {
                const res = await api.get('/reports/consolidated?format=csv', { responseType: 'blob' });
                const url = URL.createObjectURL(res.data as Blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'consolidated-report.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg"
            >
              Export report
            </button>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Layers} label="Applications" value={summary?.totals.applications ?? 0} />
        <Kpi icon={Building2} label="Institutions" value={summary?.totals.institutions ?? 0} />
        <Kpi icon={FileText} label="Documents" value={summary?.totals.documents ?? 0} />
        <Kpi
          icon={user?.role === 'ADMIN' ? Users : Calendar}
          label={user?.role === 'ADMIN' ? 'Users' : 'Inspections'}
          value={
            user?.role === 'ADMIN'
              ? summary?.totals.users ?? 0
              : summary?.inspections.total ?? 0
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-600" /> Applications by status
          </h2>
          <div className="space-y-3">
            {summary?.applicationsByStatus.map((item) => (
              <div key={item.status}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">{item.label}</span>
                  <span className="text-slate-500 tabular-nums">{item.count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${STATUS_COLORS[item.status] || 'bg-slate-400'}`}
                    style={{ width: `${(item.count / maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {summary?.applicationsByStatus.every((item) => item.count === 0) && (
              <p className="text-sm text-slate-500">No applications in scope yet.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" /> Submissions — last 6 months
          </h2>
          <div className="flex items-end justify-between gap-2 h-44">
            {summary?.monthlySubmissions.map((item) => (
              <div key={item.month} className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                <span className="text-xs font-bold text-slate-700 tabular-nums">{item.count}</span>
                <div
                  className="w-full max-w-10 bg-blue-500 rounded-t-md min-h-[3px]"
                  style={{ height: `${Math.max(3, (item.count / maxMonth) * 100)}%` }}
                  title={`${item.label}: ${item.count}`}
                />
                <span className="text-xs text-slate-500 text-center">{item.label.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Documents by status</h2>
          {summary && summary.documentsByStatus.some((item) => item.count > 0) ? (
            <>
              <div className="h-3 w-full bg-slate-100 rounded-full flex overflow-hidden mb-4">
                {summary.documentsByStatus.map((item) =>
                  item.count > 0 ? (
                    <div
                      key={item.status}
                      className={STATUS_COLORS[item.status]}
                      style={{ width: `${(item.count / documentTotal) * 100}%` }}
                      title={`${item.label}: ${item.count}`}
                    />
                  ) : null
                )}
              </div>
              <ul className="space-y-2">
                {summary.documentsByStatus.map((item) => (
                  <li key={item.status} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[item.status]}`} />
                      {item.label}
                    </span>
                    <span className="font-bold text-slate-800 tabular-nums">{item.count}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-slate-500">No documents uploaded yet.</p>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600">Average compliance</span>
              <span className="font-bold text-slate-900">{summary?.compliance.averageScore ?? 0}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${summary?.compliance.averageScore ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Applications by category</h2>
          {summary?.applicationsByCategory.length ? (
            <div className="space-y-3">
              {summary.applicationsByCategory.map((item) => (
                <div key={item.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{item.category}</span>
                    <span className="text-slate-500 tabular-nums">{item.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${(item.count / maxCategory) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No category data yet.</p>
          )}

          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-100">
            <SmallStat label="Overdue" value={summary?.totals.overdue ?? 0} />
            <SmallStat label="Critical" value={summary?.totals.critical ?? 0} />
            <SmallStat label="Inspection" value={summary?.totals.scheduledInspections ?? 0} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-blue-600" /> Upcoming inspections
          </h2>
          {summary?.inspections.upcoming.length ? (
            <ul className="space-y-3">
              {summary.inspections.upcoming.map((inspection) => (
                <li key={inspection.id} className="p-2.5 bg-slate-50 rounded-lg">
                  <p className="text-xs font-bold text-blue-600">{inspection.refId || 'Application'}</p>
                  <p className="text-xs text-slate-600">{formatDateTime(inspection.inspectionDate)}</p>
                  <p className="text-xs text-slate-500 truncate">{inspection.location}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No inspections scheduled.</p>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-600">
                <ShieldAlert size={13} className="text-amber-500" /> Pending scrutiny
              </span>
              <strong className="text-slate-900">{summary?.totals.pendingScrutiny ?? 0}</strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-600">
                <Calendar size={13} className="text-cyan-600" /> Completed visits
              </span>
              <strong className="text-slate-900">{summary?.inspections.completed ?? 0}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Deadline watchlist</h2>
        </div>
        {summary?.upcomingDeadlines.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-5 py-3">Application</th>
                  <th className="px-5 py-3">Institution</th>
                  <th className="px-5 py-3">Deadline</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.upcomingDeadlines.map((item) => {
                  const days = Math.ceil((new Date(item.deadline).getTime() - Date.now()) / 86400000);
                  return (
                    <tr key={item.id}>
                      <td className="px-5 py-3 text-sm font-bold text-blue-600">{item.refId}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{item.institution}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">
                        {formatDate(item.deadline)}
                        <span className={`ml-2 text-xs font-bold ${days <= 3 ? 'text-red-700' : 'text-slate-500'}`}>
                          {days >= 0 ? `${days}d left` : 'overdue'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No deadlines in range" description="Active applications have no upcoming deadlines." />
        )}
      </div>

      {pendency && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Region breakdown</h2>
            {pendency.byRegion?.length ? (
              <ul className="space-y-2">
                {pendency.byRegion.map((r: any) => (
                  <li key={r.region} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{r.region}</span>
                    <strong className="text-slate-900">{r.count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No regional data yet.</p>
            )}
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Stage bottleneck</h2>
            <p className="text-sm text-slate-700">
              {pendency.bottleneckStage ? `Bottleneck stage: ${pendency.bottleneckStage}` : 'No bottleneck detected.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const Kpi = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <Icon size={15} className="text-slate-500" aria-hidden="true" />
    </div>
    <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
  </div>
);

const SmallStat = ({ label, value }: { label: string; value: number }) => (
  <div>
    <p className="text-xs font-bold text-slate-500">{label}</p>
    <p className="text-base font-bold text-slate-900">{value}</p>
  </div>
);
