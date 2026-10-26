import React, { useEffect, useMemo, useState } from 'react';
import api, { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { ApplicationSummary, Institution, UserRecord } from '../services/types';
import { Field, Modal, Spinner, inputClass, primaryButtonClass, secondaryButtonClass } from './ui';

const todayPlus = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const CATEGORIES = ['Engineering', 'Management', 'Pharmacy', 'Architecture', 'Applied Arts'];

export const ApplicationFormModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: (application: ApplicationSummary) => void;
}> = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [officers, setOfficers] = useState<UserRecord[]>([]);
  const [form, setForm] = useState({
    institutionId: '',
    academicYear: '2026-27',
    category: 'Engineering',
    deadline: todayPlus(30),
    assignedOfficerId: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm((current) => ({
      ...current,
      institutionId: user?.institutionId || current.institutionId,
      deadline: todayPlus(30),
    }));

    const load = async () => {
      setLoading(true);
      try {
        const institutionsResponse = await api.get<Institution[]>('/institutions');
        setInstitutions(institutionsResponse.data);
        if (isAdmin) {
          const usersResponse = await api.get<UserRecord[]>('/users');
          setOfficers(usersResponse.data.filter((entry) => entry.role === 'OFFICER'));
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load institutions'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, isAdmin, user?.institutionId]);

  const selectedInstitution = useMemo(
    () => institutions.find((institution) => institution.id === form.institutionId),
    [institutions, form.institutionId]
  );

  useEffect(() => {
    if (selectedInstitution) {
      setForm((current) => ({ ...current, category: selectedInstitution.category }));
    }
  }, [selectedInstitution]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!form.institutionId) {
      setError('Select an institution for this application.');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post<ApplicationSummary>('/applications', {
        institutionId: form.institutionId,
        academicYear: form.academicYear,
        category: form.category,
        deadline: new Date(`${form.deadline}T23:59:59`).toISOString(),
        assignedOfficerId: form.assignedOfficerId || null,
      });
      onCreated(response.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create the application'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Approval Application"
      description="Create a draft application, then upload the statutory documents."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button
            type="submit"
            form="application-form"
            disabled={saving || loading}
            className={primaryButtonClass}
          >
            {saving && <Spinner />}
            Create Application
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 h-32 text-slate-500">
          <Spinner /> Loading form data...
        </div>
      ) : (
        <form id="application-form" onSubmit={submit} className="space-y-4">
          <Field label="Institution">
            <select
              value={form.institutionId}
              onChange={(event) => setForm({ ...form, institutionId: event.target.value })}
              className={inputClass}
              required
              disabled={!isAdmin}
            >
              <option value="">Select an institution</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name} — {institution.state}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Academic Year">
              <input
                value={form.academicYear}
                onChange={(event) => setForm({ ...form, academicYear: event.target.value })}
                className={inputClass}
                placeholder="2026-27"
                required
              />
            </Field>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className={inputClass}
                required
              >
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Submission Deadline">
            <input
              type="date"
              value={form.deadline}
              onChange={(event) => setForm({ ...form, deadline: event.target.value })}
              className={inputClass}
              required
            />
          </Field>

          {isAdmin && (
            <Field label="Assign Officer" hint="Optional. Submission auto-assigns the first officer if left empty.">
              <select
                value={form.assignedOfficerId}
                onChange={(event) => setForm({ ...form, assignedOfficerId: event.target.value })}
                className={inputClass}
              >
                <option value="">Auto-assign on submission</option>
                {officers.map((officer) => (
                  <option key={officer.id} value={officer.id}>
                    {officer.name} ({officer.email})
                  </option>
                ))}
              </select>
            </Field>
          )}

          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg">
              {error}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
};
