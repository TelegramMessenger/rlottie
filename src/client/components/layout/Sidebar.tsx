/**
 * @file Sidebar.tsx
 * Боковая навигационная панель.
 * Использует NavLink из React Router для активного состояния.
 */

import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, MessageSquare, Users, CheckSquare, DollarSign,
  BarChart2, Settings, Sparkles, LogOut, Database,
} from 'lucide-react';
import clsx from 'clsx';
import { getAuthUser, logout } from '../../auth/auth';
import { BrandLogo } from '../ui/BrandLogo';

interface NavItem {
  id:    string;
  label: string;
  href:  string;
  badge?: number;
  icon:  React.ReactNode;
}

interface NavSection {
  section: string;
  items:   NavItem[];
}

const NAV: NavSection[] = [
  {
    section: 'Рабочее пространство',
    items: [
      { id: 'home',     label: 'Главная',    href: '/home',     icon: <Home size={16} /> },
      { id: 'messages', label: 'Сообщения',  href: '/messages', badge: 3, icon: <MessageSquare size={16} /> },
    ],
  },
  {
    section: 'Команда',
    items: [
      { id: 'employees', label: 'Сотрудники', href: '/employees', badge: 10, icon: <Users size={16} /> },
      { id: 'tasks',     label: 'Задачи',     href: '/tasks',     badge: 7,  icon: <CheckSquare size={16} /> },
    ],
  },
  {
    section: 'Финансы',
    items: [
      { id: 'finance',   label: 'Финансы',   href: '/finance',   icon: <DollarSign size={16} /> },
      { id: 'analytics', label: 'Аналитика', href: '/analytics', icon: <BarChart2 size={16} /> },
    ],
  },
  {
    section: 'Система',
    items: [
      { id: 'settings', label: 'Настройки', href: '/settings', icon: <Settings size={16} /> },
    ],
  },
];

export function Sidebar() {
  const user = getAuthUser();
  return (
    <aside className="sidebar">
      {/* Бренд */}
      <div className="sidebar-brand">
        <BrandLogo size={26} />
        <span>BAZZAR</span>
      </div>

      {/* Навигация */}
      {NAV.map(group => (
        <div className="nav-section" key={group.section}>
          <div className="nav-section-label">{group.section}</div>

          {group.items.map(item => (
            <NavLink
              key={item.id}
              to={item.href}
              className={({ isActive }) =>
                clsx('nav-item', isActive && 'active')
              }
            >
              {item.icon}
              {item.label}
              {item.badge !== undefined && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </NavLink>
          ))}
        </div>
      ))}

      {/* ИИ инструменты — выделен отдельно */}
      <div className="nav-section">
        <div className="nav-section-label">ИИ</div>
        <NavLink
          to="/ai-tools"
          className={({ isActive }) => clsx('nav-item', isActive && 'active')}
          style={{ color: 'var(--accent)', opacity: 0.9 }}
        >
          <Sparkles size={16} />
          ИИ редактор
        </NavLink>
      </div>

      {/* База данных — только для admin */}
      {user?.role === 'admin' && (
        <div className="nav-section">
          <div className="nav-section-label">Администратор</div>
          <NavLink
            to="/database"
            className={({ isActive }) => clsx('nav-item', isActive && 'active')}
            style={{ color: '#47C8FF', opacity: 0.9 }}
          >
            <Database size={16} />
            База данных
          </NavLink>
        </div>
      )}

      {/* Пользователь */}
      <SidebarUser />
    </aside>
  );
}

function SidebarUser() {
  const navigate = useNavigate();
  const user     = getAuthUser(); // own call — SidebarUser renders independently

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = user?.name
    ? user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : 'BZ';

  return (
    <div className="sidebar-bottom">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div
          className="avatar"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11 }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name ?? 'Гость'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email ?? 'не авторизован'}
          </div>
        </div>
        <button className="btn-icon" title="Выйти" onClick={handleLogout}>
          <LogOut size={13} />
        </button>
      </div>
    </div>
  );
}
