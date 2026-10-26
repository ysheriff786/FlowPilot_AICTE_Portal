import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  LayoutDashboard,
  Layers,
  FileCheck,
  ShieldAlert,
  Calendar,
  Bell,
  BarChart3,
  History,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: 'Core Workflow',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Overview' },
      { to: '/applications', icon: Layers, label: 'Applications' },
      { to: '/verification', icon: FileCheck, label: 'Verification' },
      { to: '/compliance', icon: ShieldAlert, label: 'Compliance' },
      { to: '/inspections', icon: Calendar, label: 'Inspections' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { to: '/notifications', icon: Bell, label: 'Notifications' },
      { to: '/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/audit', icon: History, label: 'Audit Trail', roles: ['ADMIN', 'OFFICER'] },
      { to: '/undertakings', icon: FileCheck, label: 'Undertakings' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/users', icon: Users, label: 'User Management', roles: ['ADMIN'] },
      { to: '/routing', icon: Layers, label: 'Routing rules', roles: ['ADMIN'] },
      { to: '/requirements', icon: FileCheck, label: 'Requirements', roles: ['ADMIN'] },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/applications': 'Applications',
  '/verification': 'Verification',
  '/compliance': 'Compliance',
  '/inspections': 'Inspections',
  '/notifications': 'Notifications',
  '/analytics': 'Analytics',
  '/audit': 'Audit Trail',
  '/users': 'User Management',
  '/settings': 'Settings',
  '/undertakings': 'Undertakings',
};

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'FP';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const sections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => !('roles' in item) || (item.roles as string[]).includes(user?.role || '')
        ),
      })).filter((section) => section.items.length > 0),
    [user?.role]
  );

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;

    const loadUnread = async () => {
      try {
        const response = await api.get<{ unreadCount: number }>('/notifications');
        if (active) setUnread(response.data.unreadCount);
      } catch {
        // Badge is cosmetic; ignore transient failures.
      }
    };

    loadUnread();
    const timer = window.setInterval(loadUnread, 60000);

    const refresh = () => loadUnread();
    window.addEventListener('flowpilot:notifications-changed', refresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('flowpilot:notifications-changed', refresh);
    };
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const SidebarItem = ({
    to,
    icon: Icon,
    label,
  }: {
    to: string;
    icon: React.ElementType;
    label: string;
  }) => (
    <li>
      <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            isActive ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'
          }`
        }
      >
        <Icon size={19} className="shrink-0" />
        <span className="text-sm">{label}</span>
        {label === 'Notifications' && unread > 0 && (
          <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </NavLink>
    </li>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col z-50 transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <span className="font-bold text-xs">FP</span>
            </div>
            <span className="font-jakarta font-bold text-xl tracking-tight">FlowPilot</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-7 mt-2 overflow-y-auto pb-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-bold text-slate-500 mb-3 px-2">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <SidebarItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
              {initials(user?.name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <div className="lg:pl-64 min-h-screen flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-700 truncate">
                {PAGE_TITLES[location.pathname] || 'Dashboard'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NavLink
              to="/notifications"
              className="relative p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Notifications"
            >
              <Bell size={19} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </NavLink>
            <div className="h-8 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                {initials(user?.name)}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold leading-none text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {user?.institution?.name || user?.role}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
