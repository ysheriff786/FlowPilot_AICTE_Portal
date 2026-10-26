import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  XCircle,
  Layers,
} from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Inspection } from '../services/types';
import { InspectionModal } from '../components/InspectionModal';
import { ApplicationDetailModal } from '../components/ApplicationDetailModal';
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  formatDateTime,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui';

const FILTERS = ['ALL', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;

export const InspectionsPage: React.FC = () => {
  const { user } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [queue, setQueue] = useState<any[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState('');

  const canManage = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Inspection[]>('/inspections');
      setInspections(response.data);
      try {
        const q = await api.get('/inspections/queue');
        setQueue(q.data);
      } catch {
        // ignore
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load inspections'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => (filter === 'ALL' ? inspections : inspections.filter((item) => item.status === filter)),
    [inspections, filter]
  );

  const updateStatus = async (inspection: Inspection, status: Inspection['status']) => {
    setUpdatingId(inspection.id);
    setError('');
    setNotice('');
    try {
      await api.patch(`/inspections/${inspection.id}`, { status });
      setNotice(`Inspection for ${inspection.application?.refId || 'application'} marked ${status.toLowerCase()}.`);
      await load();
      window.dispatchEvent(new CustomEvent('flowpilot:notifications-changed'));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the inspection'));
    } finally {
      setUpdatingId('');
    }
  };

  if (loading && inspections.length === 0) return <LoadingBlock label="Loading inspections..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expert Committee Inspections"
        subtitle="Schedule and track campus visits for institutional approval."
        actions={
          canManage ? (
            <button onClick={() => setScheduleOpen(true)} className={primaryButtonClass}>
              <Plus size={16} /> Schedule Inspection
            </button>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}
      {notice && (
        <div className="p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((status) => {
          const count = status === 'ALL' ? inspections.length : inspections.filter((item) => item.status === status).length;
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
              {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()} ({count})
            </button>
          );
        })}
      </div>

      {showQueue && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">EVC queue</h2>
          {queue.length === 0 ? (
            <p className="text-sm text-slate-500">No applications awaiting EVC scheduling.</p>
          ) : (
            <ul className="space-y-2">
              {queue.map((q: any) => (
                <li key={q.id} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{q.refId} — {q.institution}</span>
                  <button onClick={() => setScheduleOpen(true)} className="text-xs font-bold text-blue-600 hover:underline">Schedule</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button onClick={() => setShowQueue((v) => !v)} className="text-xs font-bold text-blue-600 hover:underline">
        {showQueue ? 'Hide EVC queue' : 'Show EVC queue'}
      </button>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState
            icon={Calendar}
            title="No inspections found"
            description={
              canManage
                ? 'Schedule an expert committee visit for an application in scrutiny.'
                : 'Inspections scheduled for your institution will appear here.'
            }
            action={
              canManage ? (
                <button onClick={() => setScheduleOpen(true)} className={primaryButtonClass}>
                  <Plus size={16} /> Schedule Inspection
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((inspection) => {
            const isPast = new Date(inspection.inspectionDate).getTime() < Date.now();
            return (
              <div
                key={inspection.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button
                      onClick={() => inspection.application && setSelectedApplication(inspection.application.id)}
                      className="text-sm font-bold text-blue-600 hover:underline text-left"
                    >
                      {inspection.application?.refId || 'Application'}
                    </button>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {inspection.application?.institution.name}
                    </p>
                  </div>
                  <StatusBadge status={inspection.status} />
                </div>

                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm text-slate-700">
                    <Clock size={15} className="text-slate-500 shrink-0" />
                    {formatDateTime(inspection.inspectionDate)}
                    {isPast && inspection.status === 'SCHEDULED' && (
                      <span className="text-xs font-bold text-amber-700">Past due</span>
                    )}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-slate-700">
                    <MapPin size={15} className="text-slate-500 shrink-0" />
                    {inspection.location}
                  </p>
                  {inspection.notes && (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">{inspection.notes}</p>
                  )}
                </div>

                {canManage && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {inspection.status !== 'COMPLETED' && (
                      <button
                        onClick={() => updateStatus(inspection, 'COMPLETED')}
                        disabled={updatingId === inspection.id}
                        className={`${secondaryButtonClass} !py-1.5 !px-3 !text-xs`}
                      >
                        <CheckCircle2 size={14} className="text-emerald-600" /> Mark completed
                      </button>
                    )}
                    {inspection.status !== 'CANCELLED' && (
                      <button
                        onClick={() => updateStatus(inspection, 'CANCELLED')}
                        disabled={updatingId === inspection.id}
                        className={`${secondaryButtonClass} !py-1.5 !px-3 !text-xs`}
                      >
                        <XCircle size={14} className="text-red-500" /> Cancel
                      </button>
                    )}
                    {inspection.status !== 'SCHEDULED' && (
                      <button
                        onClick={() => updateStatus(inspection, 'SCHEDULED')}
                        disabled={updatingId === inspection.id}
                        className={`${secondaryButtonClass} !py-1.5 !px-3 !text-xs`}
                      >
                        <Layers size={14} /> Reschedule
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <InspectionModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} onCreated={load} />
      <ApplicationDetailModal
        applicationId={selectedApplication}
        onClose={() => setSelectedApplication(null)}
        onChanged={load}
      />
    </div>
  );
};
