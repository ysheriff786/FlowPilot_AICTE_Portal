import React, { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, ErrorBanner, Field, LoadingBlock, PageHeader, primaryButtonClass, inputClass } from '../components/ui';

interface Undertaking { id: string; applicationId: string; description: string; dueDate: string; status: string; application?: { refId: string; institution?: { name: string } } }

export const UndertakingsPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Undertaking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('');
  const [appId, setAppId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/undertakings');
      setItems(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load undertakings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/undertakings', { applicationId: appId, description: desc, dueDate: new Date(due).toISOString() });
      setDesc(''); setDue(''); setAppId('');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create undertaking'));
    }
  };

  if (loading) return <LoadingBlock label="Loading undertakings..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Time-bound Undertakings" subtitle="Track conditional approvals and evidence submissions." />
      {error && <ErrorBanner message={error} onRetry={load} />}
      {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && (
        <form onSubmit={create} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Create undertaking</h2>
          <Field label="Application ID">
            <input className={inputClass} placeholder="Application ID" value={appId} onChange={(e) => setAppId(e.target.value)} required />
          </Field>
          <Field label="Description">
            <input className={inputClass} placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} required />
          </Field>
          <Field label="Due date">
            <input type="date" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} required />
          </Field>
          <button type="submit" className={primaryButtonClass}>Create</button>
        </form>
      )}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState title="No undertakings" description="Undertakings created on approved applications will appear here." />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {items.map((u) => (
              <li key={u.id} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-600">{u.application?.refId}</span>
                  <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{u.status}</span>
                </div>
                <p className="text-sm text-slate-700 mt-1">{u.description}</p>
                <p className="text-xs text-slate-500 mt-1">Due {new Date(u.dueDate).toLocaleDateString()}</p>
                <input type="file" className="text-xs mt-2" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.append('file', f);
                  try { await api.post(`/undertakings/${u.id}/evidence`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); await load(); } catch (err) { setError(getErrorMessage(err, 'Upload failed')); }
                }} />
                {(user?.role === 'ADMIN' || user?.role === 'OFFICER') && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={async () => { await api.patch(`/undertakings/${u.id}`, { status: 'VERIFIED' }); await load(); }} className="text-xs font-bold text-emerald-600 hover:underline">Verify</button>
                    <button onClick={async () => { await api.patch(`/undertakings/${u.id}`, { status: 'REJECTED' as any }); await load(); }} className="text-xs font-bold text-red-600 hover:underline">Reject</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};