import React, { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../services/api';
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader, primaryButtonClass, inputClass } from '../components/ui';

export const RoutingPage: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ruleForm, setRuleForm] = useState({ category: '', isNew: false, route: '' });
  const [regionForm, setRegionForm] = useState({ state: '', region: 'CENTRAL' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, s] = await Promise.all([api.get('/routing/rules'), api.get('/routing/state-regions')]);
      setRules(r.data);
      setRegions(s.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load routing data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/routing/rules', ruleForm);
      setRuleForm({ category: '', isNew: false, route: '' });
      await load();
    } catch (err) { setError(getErrorMessage(err, 'Failed to add rule')); }
  };

  const addRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/routing/state-regions', regionForm);
      setRegionForm({ state: '', region: 'CENTRAL' });
      await load();
    } catch (err) { setError(getErrorMessage(err, 'Failed to add mapping')); }
  };

  if (loading) return <LoadingBlock label="Loading routing data..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Routing rules" subtitle="Values must come from the AICTE Approval Process Handbook and official state sources. See docs/DATA_SOURCES.md." />
      {error && <ErrorBanner message={error} onRetry={load} />}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        Routing rules and state-to-region mappings must be entered from authoritative sources. See <code>docs/DATA_SOURCES.md</code>.
      </div>
      <form onSubmit={addRule} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Add routing rule</h2>
        <input className={inputClass} placeholder="Category" value={ruleForm.category} onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })} required />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ruleForm.isNew} onChange={(e) => setRuleForm({ ...ruleForm, isNew: e.target.checked })} /> isNew institution</label>
        <input className={inputClass} placeholder="Route (e.g. SCRUTINY_EVC)" value={ruleForm.route} onChange={(e) => setRuleForm({ ...ruleForm, route: e.target.value })} required />
        <button type="submit" className={primaryButtonClass}>Add rule</button>
      </form>
      {rules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200"><EmptyState title="No routing rules" description="Add a rule so applications get a route." /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {rules.map((r) => (
              <li key={r.id} className="p-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">{r.category} · isNew={String(r.isNew)}</span>
                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{r.route}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={addRegion} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Add state-to-region mapping</h2>
        <input className={inputClass} placeholder="State" value={regionForm.state} onChange={(e) => setRegionForm({ ...regionForm, state: e.target.value })} required />
        <select aria-label="Region" className={inputClass} value={regionForm.region} onChange={(e) => setRegionForm({ ...regionForm, region: e.target.value })}>
          {['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'].map((r) => <option key={r}>{r}</option>)}
        </select>
        <button type="submit" className={primaryButtonClass}>Add mapping</button>
      </form>
      {regions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200"><EmptyState title="No state mappings" description="Add a mapping so institutions get a region." /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {regions.map((r) => (
              <li key={r.id} className="p-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">{r.state}</span>
                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{r.region}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};