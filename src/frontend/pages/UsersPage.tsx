import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Users as UsersIcon } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import type { Institution, UserRecord } from '../services/types';
import { UserModal } from '../components/UserModal';
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  formatDate,
  inputClass,
  primaryButtonClass,
} from '../components/ui';

const ROLE_STYLES: Record<string, string> = {
  ADMIN: 'bg-slate-100 text-slate-700',
  OFFICER: 'bg-blue-100 text-blue-700',
  COLLEGE: 'bg-emerald-100 text-emerald-700',
};

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersResponse, institutionsResponse] = await Promise.all([
        api.get<UserRecord[]>('/users'),
        api.get<Institution[]>('/institutions'),
      ]);
      setUsers(usersResponse.data);
      setInstitutions(institutionsResponse.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load user accounts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = role === 'ALL' || user.role === role;
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.institution?.name || '').toLowerCase().includes(query);
      return matchesRole && matchesSearch;
    });
  }, [users, role, search]);

  if (loading) return <LoadingBlock label="Loading user accounts..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Create accounts and control role-based access across the platform."
        actions={
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className={primaryButtonClass}
          >
            <Plus size={16} /> Create User
          </button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid grid-cols-3 gap-3">
        {(['ADMIN', 'OFFICER', 'COLLEGE'] as const).map((value) => (
          <div key={value} className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-bold text-slate-500">{value}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {users.filter((user) => user.role === value).length}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or institution..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={role} onChange={(event) => setRole(event.target.value)} className={inputClass}>
          <option value="ALL">All roles</option>
          <option value="ADMIN">Administrators</option>
          <option value="OFFICER">Officers</option>
          <option value="COLLEGE">College users</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No matching users"
            description="Adjust the filters or create a new account."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Institution</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          ROLE_STYLES[user.role] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {user.institution?.name || <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(user.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditing(user);
                          setModalOpen(true);
                        }}
                        className="p-2 text-slate-500 hover:text-blue-600 transition-colors"
                        title="Edit user"
                        aria-label={`Edit ${user.name}`}
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

      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        user={editing}
        institutions={institutions}
      />
    </div>
  );
};
