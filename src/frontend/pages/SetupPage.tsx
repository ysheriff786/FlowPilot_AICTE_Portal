import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { inputClass, primaryButtonClass } from '../components/ui';

export const SetupPage: React.FC = () => {
  const { checkSetup } = useAuth() as any;
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/setup', form);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Setup failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">First-run setup</h1>
        <p className="text-sm text-slate-500 mb-6">Create the first administrator account.</p>
        <form onSubmit={submit} className="space-y-4">
          <input className={inputClass} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className={inputClass} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className={inputClass} type="password" placeholder="Password (min 12 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={12} />
          {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">{error}</div>}
          <button type="submit" disabled={loading} className={primaryButtonClass + ' w-full'}>{loading ? 'Creating...' : 'Create administrator'}</button>
        </form>
      </div>
    </div>
  );
};