import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../services/api';
import type { ApplicationSummary } from '../services/types';
import { Field, Modal, Spinner, inputClass, primaryButtonClass, secondaryButtonClass } from './ui';

const defaultDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(10, 0, 0, 0);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export const InspectionModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialApplicationId?: string;
}> = ({ open, onClose, onCreated, initialApplicationId }) => {
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [form, setForm] = useState({
    applicationId: initialApplicationId || '',
    inspectionDate: defaultDate(),
    location: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm((current) => ({
      ...current,
      applicationId: initialApplicationId || current.applicationId,
      inspectionDate: defaultDate(),
    }));
    setError('');

    const load = async () => {
      setLoading(true);
      try {
        const response = await api.get<ApplicationSummary[]>('/applications');
        setApplications(
          response.data.filter((application) => !['APPROVED', 'REJECTED'].includes(application.status))
        );
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load applications'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, initialApplicationId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!form.applicationId) {
      setError('Select an application to inspect.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/inspections', {
        applicationId: form.applicationId,
        inspectionDate: new Date(form.inspectionDate).toISOString(),
        location: form.location,
        notes: form.notes.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not schedule the inspection'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule Expert Committee Visit"
      description="The institution and assigned officer will be notified automatically."
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" form="inspection-form" disabled={saving || loading} className={primaryButtonClass}>
            {saving && <Spinner />} Schedule Inspection
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 h-32 text-slate-500">
          <Spinner /> Loading applications...
        </div>
      ) : (
        <form id="inspection-form" onSubmit={submit} className="space-y-4">
          <Field label="Application">
            <select
              value={form.applicationId}
              onChange={(event) => setForm({ ...form, applicationId: event.target.value })}
              className={inputClass}
              required
            >
              <option value="">Select an application</option>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.refId} — {application.institution.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Date & time">
              <input
                type="datetime-local"
                value={form.inspectionDate}
                onChange={(event) => setForm({ ...form, inspectionDate: event.target.value })}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Location">
              <input
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                className={inputClass}
                placeholder="Campus address"
                required
                minLength={3}
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className={`${inputClass} min-h-[90px]`}
              placeholder="Scope of the visit, committee members, documents to check..."
            />
          </Field>

          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg">{error}</div>
          )}
        </form>
      )}
    </Modal>
  );
};
