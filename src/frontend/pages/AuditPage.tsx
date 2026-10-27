import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Search, ShieldCheck } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import type { AuditLogItem } from '../services/types';
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  formatDateTime,
  inputClass,
} from '../components/ui';

const ACTION_STYLES: Record<string, string> = {
  APPLICATION_CREATED: 'bg-blue-100 text-blue-700',
  APPLICATION_SUBMITTED: 'bg-sky-100 text-sky-700',
  APPLICATION_RESUBMITTED: 'bg-sky-100 text-sky-700',
  STATUS_CHANGED: 'bg-cyan-100 text-cyan-700',
  DOCUMENT_UPLOADED: 'bg-amber-100 text-amber-700',
  DOCUMENT_VERIFIED: 'bg-emerald-100 text-emerald-700',
  INSPECTION_SCHEDULED: 'bg-cyan-100 text-cyan-700',
  INSPECTION_UPDATED: 'bg-sky-100 text-sky-700',
  USER_CREATED: 'bg-slate-100 text-slate-700',
  USER_UPDATED: 'bg-slate-100 text-slate-700',
  PROFILE_UPDATED: 'bg-slate-100 text-slate-700',
  PASSWORD_CHANGED: 'bg-red-100 text-red-700',
};

const formatAction = (action: string) => action.replaceAll('_', ' ').toLowerCase();

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<AuditLogItem[]>('/audit');
      setLogs(response.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the audit trail'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useMemo(() => [...new Set(logs.map((log) => log.action))].sort(), [logs]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesAction = action === 'ALL' || log.action === action;
      const matchesSearch =
        !query ||
        log.actor.name.toLowerCase().includes(query) ||
        log.entity.toLowerCase().includes(query) ||
        (log.application?.refId || '').toLowerCase().includes(query) ||
        (log.metadata || '').toLowerCase().includes(query);
      return matchesAction && matchesSearch;
    });
  }, [logs, action, search]);

  if (loading) return <LoadingBlock label="Loading audit trail..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        subtitle="Immutable record of every workflow, document and account action."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg">
            <ShieldCheck size={13} /> {logs.length} events retained
          </span>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search actor, entity, application or metadata..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <select aria-label="Filter by action" value={action} onChange={(event) => setAction(event.target.value)} className={inputClass}>
          <option value="ALL">All actions</option>
          {actions.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={History}
            title="No audit events found"
            description={
              logs.length === 0
                ? 'Workflow actions will be recorded here as they happen.'
                : 'Try a different search term or action filter.'
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((log) => {
              let metadata: Record<string, unknown> | null = null;
              if (log.metadata) {
                try {
                  metadata = JSON.parse(log.metadata);
                } catch {
                  metadata = null;
                }
              }

              return (
                <li key={log.id} className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            ACTION_STYLES[log.action] || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {formatAction(log.action)}
                        </span>
                        <span className="text-xs text-slate-500">{log.entity}</span>
                        {log.application && (
                          <span className="text-xs font-bold text-blue-600">{log.application.refId}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mt-1.5">
                        {log.actor.name}{' '}
                        <span className="font-normal text-slate-500">({log.actor.role.toLowerCase()})</span>
                      </p>
                      {log.application && (
                        <p className="text-xs text-slate-500">{log.application.institution.name}</p>
                      )}
                      {metadata && Object.keys(metadata).length > 0 && (
                        <p className="text-xs text-slate-500 mt-1 break-words">
                          {Object.entries(metadata)
                            .map(([key, value]) => `${key}: ${String(value)}`)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                      {formatDateTime(log.timestamp)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
