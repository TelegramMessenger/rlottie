/**
 * @file src/App.tsx
 * Корневой компонент с React Router 6.
 *
 * Архитектура маршрутов:
 *   /login          — страница входа (без Layout)
 *   /               — редирект → /home
 *   /home           — главная: проекты + полезные программы
 *   /project/:id    — страница проекта (задачи, команда, финансы)
 *   /ai-tools       — ИИ редактор фото/видео
 *   /messages       — сообщения
 *   /employees      — команда
 *   /tasks          — все задачи
 *   /analytics      — аналитика
 *   /settings       — настройки
 *   *               — 404
 *
 * Lazy loading: каждая страница грузится отдельным чанком Vite.
 */

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@client/components/layout/Layout';
import { PageSpinner } from '@client/components/ui/Spinner';
import { ProtectedRoute } from '@client/auth/ProtectedRoute';

// Lazy-loaded pages (code splitting)
const LoginPage     = lazy(() => import('@client/pages/LoginPage'));
const HomePage      = lazy(() => import('@client/pages/HomePage'));
const ProjectPage   = lazy(() => import('@client/pages/ProjectPage'));
const AiToolsPage   = lazy(() => import('@client/pages/AiToolsPage'));
const EmployeesPage = lazy(() => import('@client/pages/EmployeesPage'));
const TasksPage     = lazy(() => import('@client/pages/TasksPage'));
const AnalyticsPage = lazy(() => import('@client/pages/AnalyticsPage'));
const MessagesPage  = lazy(() => import('@client/pages/MessagesPage'));
const SettingsPage   = lazy(() => import('@client/pages/SettingsPage'));
const FinancePage    = lazy(() => import('@client/pages/FinancePage'));
const DatabasePage   = lazy(() => import('@client/pages/DatabasePage'));

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Страница входа — без общего Layout */}
        <Route path="/login" element={<LoginPage />} />

        {/* Все основные страницы — защищены auth + Layout (Sidebar + Topbar) */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home"           element={<HomePage />} />
          <Route path="/project/:id"    element={<ProjectPage />} />
          <Route path="/ai-tools"       element={<AiToolsPage />} />
          <Route path="/messages"       element={<MessagesPage />} />
          <Route path="/employees"      element={<EmployeesPage />} />
          <Route path="/tasks"          element={<TasksPage />} />
          <Route path="/analytics"      element={<AnalyticsPage />} />
          <Route path="/finance"        element={<FinancePage />} />
          <Route path="/settings"       element={<SettingsPage />} />
          <Route path="/database"       element={<DatabasePage />} />
        </Route>

        {/* 404 — редирект на главную */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Suspense>
  );
}
