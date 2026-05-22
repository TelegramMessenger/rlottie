/**
 * @file Layout.tsx
 * Корневой layout-компонент для защищённых страниц.
 * Sidebar | Topbar + Content (через React Router Outlet)
 */

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
