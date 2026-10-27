import React, { useEffect, useState } from 'react';
import { KeyRound, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Field,
  PageHeader,
  StatusBadge,
  formatDate,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [jobResult, setJobResult] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setProfileSaving(true);
    try {
      await api.patch('/auth/me', { name });
      await refreshUser();
      setProfileMessage('Profile updated successfully.');
    } catch (err) {
      setProfileError(getErrorMessage(err, 'Could not update your profile'));
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    if (passwords.newPassword.length < 6) {
      setPasswordError('The new password must be at least 6 characters.');
      return;
    }

    setPasswordSaving(true);
    try {
      await api.patch('/auth/me/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessage('Password changed successfully.');
    } catch (err) {
      setPasswordError(getErrorMessage(err, 'Could not change your password'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your profile, security and active session."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={saveProfile} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserRound size={16} className="text-blue-600" /> Profile
            </h2>
            <Field label="Full name">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                required
                minLength={2}
              />
            </Field>
            <Field label="Email address" hint="Contact an administrator to change your sign-in email.">
              <input value={user?.email || ''} className={`${inputClass} bg-slate-50 text-slate-500`} disabled />
            </Field>
            {profileError && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg">{profileError}</div>
            )}
            {profileMessage && (
              <div className="p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg">
                {profileMessage}
              </div>
            )}
            <div className="flex justify-end">
              <button type="submit" disabled={profileSaving || name === user?.name} className={primaryButtonClass}>
                {profileSaving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>

          <form onSubmit={changePassword} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <KeyRound size={16} className="text-blue-600" /> Security
            </h2>
            <Field label="Current password">
              <input
                type="password"
                value={passwords.currentPassword}
                onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
                className={inputClass}
                required
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="New password">
                <input
                  type="password"
                  value={passwords.newPassword}
                  onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
                  className={inputClass}
                  minLength={6}
                  required
                />
              </Field>
              <Field label="Confirm new password">
                <input
                  type="password"
                  value={passwords.confirmPassword}
                  onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })}
                  className={inputClass}
                  minLength={6}
                  required
                />
              </Field>
            </div>
            {passwordError && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg">{passwordError}</div>
            )}
            {passwordMessage && (
              <div className="p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg">
                {passwordMessage}
              </div>
            )}
            <div className="flex justify-end">
              <button type="submit" disabled={passwordSaving} className={primaryButtonClass}>
                {passwordSaving ? 'Updating...' : 'Change password'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-600" /> Account
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Role</dt>
                <dd>
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {user?.role}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Institution</dt>
                <dd className="text-slate-900 font-medium text-right">{user?.institution?.name || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Account ID</dt>
                <dd className="text-slate-500 text-xs truncate max-w-[140px]">{user?.id}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Session</dt>
                <dd>
                  <StatusBadge status="APPROVED" />
                </dd>
              </div>
            </dl>
            <button onClick={signOut} className={`${secondaryButtonClass} w-full mt-5 !text-red-600 !border-red-100 hover:!bg-red-50`}>
              <LogOut size={16} /> Sign out of this device
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl">
            <p className="text-sm font-bold text-blue-900">About FlowPilot</p>
            <p className="text-xs text-blue-700 mt-1.5">
              AICTE regulatory approval workflow dashboard. All data shown is stored in the local FlowPilot
              database.
            </p>
            <p className="text-xs text-blue-700 mt-3 font-bold">
              Build · {formatDate(new Date().toISOString())}
            </p>
          </div>

          {user?.role === 'ADMIN' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <p className="text-sm font-bold text-slate-900 mb-2">Scheduled checks</p>
              <button
                onClick={async () => {
                  try {
                    const res = await api.post('/admin/run-jobs');
                    const c = res.data?.counts;
                    setJobResult(
                      c
                        ? `Checked ${c.applicationsChecked} applications, ${c.inspectionsChecked} inspections, ${c.documentsChecked} documents, ${c.undertakingsChecked} undertakings. Reminders created: ${c.remindersCreated}; undertakings overdue: ${c.undertakingsMarkedOverdue}; documents expired: ${c.documentsMarkedExpired}.`
                        : res.data?.message || 'Done'
                    );
                  } catch (err) {
                    setJobResult(getErrorMessage(err, 'Failed'));
                  }
                }}
                className={primaryButtonClass}
              >
                Run scheduled checks now
              </button>
              {jobResult && <p className="text-xs text-slate-500 mt-2">{jobResult}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
