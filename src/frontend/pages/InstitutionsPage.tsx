import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Search } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import type { Institution } from '../services/types';
import {
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  Spinner,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui';

const EMPTY_FORM = {
  name: '',
  type: '',
  state: '',
  category: '',
  academicYear: '',
  address: '',
  email: '',
  phone: '',
  isNew: false,
};

type InstitutionForm = typeof EMPTY_FORM;

export const InstitutionsPage: React.FC = () => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Institution | null>(null);
  const [form, setForm] = useState<InstitutionForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Institution[]>('/institutions');
      setInstitutions(response.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load institutions'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (institution: Institution) => {
    setEditing(institution);
    setForm({
      name: institution.name,
      type: institution.type,
      state: institution.state,
      category: institution.category,
      academicYear: institution.academicYear,
      address: institution.address,
      email: institution.email,
      phone: institution.phone,
      isNew: Boolean(institution.isNew),
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/institutions/${editing.id}`, form);
      } else {
        await api.post('/institutions', form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save the institution'));
    } finally {
      setSaving(false);
    }
  };

  const filtered = institutions.filter((institution) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      institution.name.toLowerCase().includes(query) ||
      institution.state.toLowerCase().includes(query) ||
      institution.category.toLowerCase().includes(query)
    );
  });

  if (loading) return <LoadingBlock label="Loading institutions..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutions"
        subtitle="Institutions are entered by administrators. The region is resolved from the state-to-region mapping."
        actions={
          <button onClick={openCreate} className={primaryButtonClass}>
            <Plus size={16} /> Create Institution
          </button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, state or category..."
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No institutions found"
            description="Create an institution, then add its college users from the Users screen."
            action={
              <button onClick={openCreate} className={primaryButtonClass}>
                <Plus size={16} /> Create Institution
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-5 py-3">Institution</th>
                  <th className="px-5 py-3">State / Region</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Applications</th>
                  <th className="px-5 py-3">Users</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((institution) => (
                  <tr key={institution.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold text-slate-900">{institution.name}</p>
                      <p className="text-xs text-slate-500">
                        {institution.type} · {institution.academicYear}
                        {institution.isNew ? ' · New' : ''}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {institution.state}
                      <span className="ml-2 text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {institution.region || 'CENTRAL'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{institution.category}</td>
                    <td className="px-5 py-3 text-sm tabular-nums text-slate-600">
                      {institution._count?.applications ?? 0}
                    </td>
                    <td className="px-5 py-3 text-sm tabular-nums text-slate-600">
                      {institution._count?.users ?? 0}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openEdit(institution)}
                        className="p-2 text-slate-500 hover:text-blue-600 transition-colors"
                        title="Edit institution"
                        aria-label={`Edit ${institution.name}`}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? `Edit ${editing.name}` : 'Create Institution'}
        description="Values such as category and academic year must match the official AICTE records."
        footer={
          <>
            <button type="button" onClick={closeModal} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" form="institution-form" disabled={saving} className={primaryButtonClass}>
              {saving && <Spinner />} {editing ? 'Save changes' : 'Create institution'}
            </button>
          </>
        }
      >
        <form id="institution-form" onSubmit={submit} className="space-y-4">
          <Field label="Institution name">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className={inputClass}
              required
              minLength={2}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Institution type">
              <input
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
                className={inputClass}
                required
                minLength={2}
              />
            </Field>
            <Field label="State" hint="Region is resolved from /routing mappings.">
              <input
                value={form.state}
                onChange={(event) => setForm({ ...form, state: event.target.value })}
                className={inputClass}
                required
                minLength={2}
              />
            </Field>
            <Field label="Category">
              <input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className={inputClass}
                placeholder="e.g. Engineering"
                required
                minLength={2}
              />
            </Field>
            <Field label="Academic year">
              <input
                value={form.academicYear}
                onChange={(event) => setForm({ ...form, academicYear: event.target.value })}
                className={inputClass}
                placeholder="2026-27"
                required
                minLength={4}
              />
            </Field>
            <Field label="Contact email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Address">
            <input
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              className={inputClass}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isNew}
              onChange={(event) => setForm({ ...form, isNew: event.target.checked })}
            />
            New institution (used by routing rules)
          </label>
          {formError && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg">{formError}</div>
          )}
        </form>
      </Modal>
    </div>
  );
};
