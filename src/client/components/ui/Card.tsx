/**
 * @file Card.tsx
 * Базовая карточка и вспомогательные блоки (KpiCard, EmptyState).
 */

import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  style?: React.CSSProperties;
}

/** Базовая карточка */
export function Card({ children, className, onClick, hover, style }: CardProps) {
  return (
    <div
      className={clsx('card', hover && 'card-hover', className)}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : undefined,
        transition: hover ? 'all 0.2s' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface KpiCardProps {
  label:    string;
  value:    React.ReactNode;
  delta?:   string;
  progress?: number; // 0–100
  color?:   string;
}

/** KPI-карточка с прогресс-баром */
export function KpiCard({ label, value, delta, progress, color = 'var(--accent)' }: KpiCardProps) {
  return (
    <Card>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: delta ? 4 : 0 }}>
        {value}
      </div>
      {delta && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{delta}</div>
      )}
      {progress !== undefined && (
        <div className="kpi-bar" style={{ marginTop: 10 }}>
          <div className="kpi-bar-fill" style={{ width: `${progress}%`, background: color }} />
        </div>
      )}
    </Card>
  );
}

interface EmptyStateProps {
  icon?:    React.ReactNode;
  title:    string;
  message?: string;
  action?:  React.ReactNode;
}

/** Пустое состояние (нет данных) */
export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
      {icon && <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>{icon}</div>}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 6 }}>{title}</div>
      {message && <div style={{ fontSize: 12, marginBottom: 16 }}>{message}</div>}
      {action}
    </div>
  );
}
