/**
 * @file src/client/auth/ProtectedRoute.tsx
 * Защищённый маршрут. Если пользователь не залогинен — редирект на /login
 * с сохранением пути для возврата после успешного входа.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from './auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
