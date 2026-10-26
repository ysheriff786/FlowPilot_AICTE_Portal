import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Inbox, Loader2 } from 'lucide-react';
import api, { getErrorMessage } from '../services/api';
import type { NotificationItem } from '../services/types';
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  primaryButtonClass,
  relativeTime,
  secondaryButtonClass,
} from '../components/ui';

const TYPE_STYLES: Record<string, { className: string; label: string }> = {
  DEADLINE: { className: 'bg-red-100 text-red-600', label: 'Deadline' },
  APPLICATION: { className: 'bg-blue-100 text-blue-700', label: 'Application' },
  DOCUMENT: { className: 'bg-amber-100 text-amber-700', label: 'Document' },
  INSPECTION: { className: 'bg-cyan-100 text-cyan-700', label: 'Inspection' },
  STATUS: { className: 'bg-emerald-100 text-emerald-700', label: 'Status' },
  REPORT: { className: 'bg-sky-100 text-sky-700', label: 'Report' },
};

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>(
        '/notifications'
      );
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
      window.dispatchEvent(new CustomEvent('flowpilot:notifications-changed'));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load notifications'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => (filter === 'UNREAD' ? notifications.filter((item) => !item.isRead) : notifications),
    [notifications, filter]
  );

  const markRead = async (notification: NotificationItem) => {
    if (notification.isRead) return;
    setWorkingId(notification.id);
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      window.dispatchEvent(new CustomEvent('flowpilot:notifications-changed'));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not mark the notification as read'));
    } finally {
      setWorkingId('');
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    setError('');
    try {
      await api.patch('/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('flowpilot:notifications-changed'));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not mark all notifications as read'));
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) return <LoadingBlock label="Loading notifications..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'} for your account.`}
        actions={
          <>
            <button
              onClick={() => setFilter(filter === 'ALL' ? 'UNREAD' : 'ALL')}
              className={secondaryButtonClass}
            >
              <Inbox size={16} /> {filter === 'ALL' ? 'Show unread' : 'Show all'}
            </button>
            <button
              onClick={markAll}
              disabled={unreadCount === 0 || markingAll}
              className={primaryButtonClass}
            >
              {markingAll ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
              Mark all read
            </button>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'UNREAD' ? 'You are all caught up' : 'No notifications yet'}
            description={
              filter === 'UNREAD'
                ? 'There are no unread notifications right now.'
                : 'Workflow updates, document reviews and inspection alerts will appear here.'
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((notification) => {
              const type = TYPE_STYLES[notification.type] || {
                className: 'bg-slate-100 text-slate-500',
                label: notification.type,
              };
              return (
                <li
                  key={notification.id}
                  className={`p-4 sm:p-5 flex items-start gap-4 transition-colors ${
                    notification.isRead ? 'bg-white' : 'bg-blue-50/40'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${type.className}`}
                  >
                    <Bell size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${type.className}`}>
                        {type.label}
                      </span>
                      {!notification.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" aria-label="Unread" />
                      )}
                      <span className="text-xs text-slate-500">{relativeTime(notification.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-800 mt-1.5">{notification.message}</p>
                  </div>
                  {!notification.isRead && (
                    <button
                      onClick={() => markRead(notification)}
                      disabled={workingId === notification.id}
                      className="text-xs font-bold text-blue-600 hover:underline shrink-0 disabled:opacity-50"
                    >
                      {workingId === notification.id ? 'Saving...' : 'Mark read'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
