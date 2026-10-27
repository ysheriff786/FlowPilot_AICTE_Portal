import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, Plus, Search, Layers } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { ApplicationSummary, AppStatus } from '../services/types';
import { ApplicationFormModal } from '../components/ApplicationFormModal';
import { ApplicationDetailModal } from '../components/ApplicationDetailModal';
import { APP_STATUSES, STATUS_LABELS } from '../lib/workflow';
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  formatDate,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui';

const FILTERS: Array<AppStatus | 'ALL'> = ['ALL', ...APP_STATUSES];

export const ApplicationsPage: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<AppStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'COLLEGE';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApplicationSummary[]>('/applications');
      setApplications(response.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load applications'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return applications.filter((application) => {
      const matchesStatus = filter === 'ALL' || application.status === filter;
      const matchesSearch =
        !query ||
        application.refId.toLowerCase().includes(query) ||
        application.institution.name.toLowerCase().includes(query) ||
        application.category.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [applications, filter, search]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const application of applications) {
      map.set(application.status, (map.get(application.status) || 0) + 1);
    }
    return map;
  }, [applications]);

  const exportCsv = () => {
    const rows = [
      ['Reference', 'Institution', 'Category', 'Academic Year', 'Status', 'Deadline', 'Documents'],
      ...filtered.map((application) => [
        application.refId,
        application.institution.name,
        application.category,
        application.academicYear,
        STATUS_LABELS[application.status] || application.status,
        formatDate(application.deadline),
        String(application._count?.documents ?? 0),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowpilot-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && applications.length === 0) return <LoadingBlock label="Loading applications..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        subtitle="Audit and track institutional approval requests."
        actions={
          <>
            <button onClick={exportCsv} className={secondaryButtonClass} disabled={filtered.length === 0}>
              <Download size={16} /> Export CSV
            </button>
            {canCreate && (
              <button onClick={() => setCreateOpen(true)} className={primaryButtonClass}>
                <Plus size={16} /> New Application
              </button>
            )}
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by reference, institution or category..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((status) => {
            const label = status === 'ALL' ? 'All' : STATUS_LABELS[status];
            const count = status === 'ALL' ? applications.length : counts.get(status) || 0;
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label} <span className={filter === status ? 'text-white' : 'text-slate-500'}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No applications found"
            description={
              applications.length === 0
                ? canCreate
                  ? 'Create the first application to begin the approval workflow.'
                  : 'No applications have been assigned to you yet.'
                : 'Try a different search term or status filter.'
            }
            action={
              canCreate && applications.length === 0 ? (
                <button onClick={() => setCreateOpen(true)} className={primaryButtonClass}>
                  <Plus size={16} /> New Application
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-5 py-3">Application</th>
                  <th className="px-5 py-3">Institution</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Docs</th>
                  <th className="px-5 py-3">Deadline</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((application) => {
                  const overdue =
                    new Date(application.deadline).getTime() < Date.now() &&
                    !['APPROVED', 'REJECTED'].includes(application.status);
                  return (
                    <tr
                      key={application.id}
                      onClick={() => setSelected(application.id)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <p className="text-sm font-bold text-blue-600">{application.refId}</p>
                        <p className="text-xs text-slate-500">
                          {application.category} · {application.academicYear}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm font-semibold text-slate-900">{application.institution.name}</p>
                        <p className="text-xs text-slate-500">{application.institution.type}</p>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={application.status} />
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 tabular-nums">
                        {application._count?.documents ?? 0}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-sm tabular-nums ${overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                          {formatDate(application.deadline)}
                        </span>
                        {overdue && <p className="text-xs text-red-700 font-bold">Overdue</p>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(application.id);
                          }}
                          className="p-2 text-slate-500 hover:text-blue-600 transition-colors"
                          title="View details"
                          aria-label={`View ${application.refId}`}
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ApplicationFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(application) => {
          load();
          setSelected(application.id);
        }}
      />
      <ApplicationDetailModal
        applicationId={selected}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    </div>
  );
};
