import React, { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../services/api';
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader, primaryButtonClass, inputClass } from '../components/ui';

export const RequirementsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ category: '', academicYear: '', docType: '', isRequired: true });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/documents/requirements');
      setItems(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load requirements'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/documents/requirements', form);
      setForm({ category: '', academicYear: '', docType: '', isRequired: true });
      await load();
    } catch (err) { setError(getErrorMessage(err, 'Failed to add requirement')); }
  };

  if (loading) return <LoadingBlock label="Loading requirements..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Document requirements" subtitle="Managed by administrators. Values from the AICTE Approval Process Handbook." />
      {error && <ErrorBanner message={error} onRetry={load} />}
      <form onSubmit={add} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Add requirement</h2>
        <input className={inputClass} placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
        <input className={inputClass} placeholder="Academic year (e.g. 2026-27)" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} required />
        <input className={inputClass} placeholder="Document type" value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })} required />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isRequired} onChange={(e) => setForm({ ...form, isRequired: e.target.checked })} /> Required</label>
        <button type="submit" className={primaryButtonClass}>Add</button>
      </form>
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200"><EmptyState title="No requirements" description="Add document requirements for each category." /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {items.map((r) => (
              <li key={r.id} className="p-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">{r.category} · {r.academicYear}</span>
                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{r.docType} {r.isRequired ? '(required)' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};