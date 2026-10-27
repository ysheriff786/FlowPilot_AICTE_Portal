import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../services/api';
import type { Institution, UserRecord } from '../services/types';
import { Field, Modal, Spinner, inputClass, primaryButtonClass, secondaryButtonClass } from './ui';

export const UserModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  user?: UserRecord | null;
  institutions: Institution[];
}> = ({ open, onClose, onSaved, user, institutions }) => {
  const isEdit = Boolean(user);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'OFFICER' as UserRecord['role'],
    institutionId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      name: user?.name || '',
      email: user?.email || '',
      password: '',
      role: user?.role || 'OFFICER',
      institutionId: user?.institutionId || '',
    });
  }, [open, user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (form.role === 'COLLEGE' && !form.institutionId) {
      setError('College accounts must be linked to an institution.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && user) {
        await api.patch(`/users/${user.id}`, {
          name: form.name,
          role: form.role,
          institutionId: form.role === 'COLLEGE' ? form.institutionId : null,
        });
      } else {
        await api.post('/users', {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          institutionId: form.role === 'COLLEGE' ? form.institutionId : null,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the user'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${user?.name}` : 'Create User Account'}
      description={
        isEdit
          ? 'Update the profile, role or institution for this account.'
          : 'Accounts created here can sign in immediately.'
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" form="user-form" disabled={saving} className={primaryButtonClass}>
            {saving && <Spinner />} {isEdit ? 'Save changes' : 'Create user'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className={inputClass}
            required
            minLength={2}
          />
        </Field>

        {!isEdit && (
          <Field label="Email address">
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className={inputClass}
              required
            />
          </Field>
        )}

        {!isEdit && (
          <Field label="Temporary password" hint="Minimum 12 characters.">
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className={inputClass}
              required
              minLength={12}
            />
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Role">
            <select
              value={form.role}
              onChange={(event) =>
                setForm({ ...form, role: event.target.value as UserRecord['role'] })
              }
              className={inputClass}
            >
              <option value="OFFICER">Officer</option>
              <option value="COLLEGE">College</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </Field>
          <Field label="Institution">
            <select
              value={form.institutionId}
              onChange={(event) => setForm({ ...form, institutionId: event.target.value })}
              className={inputClass}
              disabled={form.role !== 'COLLEGE'}
              required={form.role === 'COLLEGE'}
            >
              <option value="">{form.role === 'COLLEGE' ? 'Select institution' : 'Not applicable'}</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg">{error}</div>
        )}
      </form>
    </Modal>
  );
};
