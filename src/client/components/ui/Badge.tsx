/**
 * @file Badge.tsx
 * Chip-компонент для статусов и тегов.
 */

import clsx from 'clsx';
import { Check, Ban, MinusCircle, Loader } from 'lucide-react';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'muted';
type TagVariant   = 'dev' | 'design' | 'ops' | 'bug' | 'marketing';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

/** Статусный badge */
export function Badge({ variant = 'green', children, className, dot }: BadgeProps) {
  return (
    <span className={clsx('badge', `badge-${variant}`, className)}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />}
      {children}
    </span>
  );
}

const TAG_LABELS: Record<TagVariant, string> = {
  dev:       'Dev',
  design:    'Design',
  ops:       'Ops',
  bug:       'Баг',
  marketing: 'Маркетинг',
};

interface TaskTagProps {
  tag: TagVariant | string;
}

/** Тег задачи (Dev, Design, Bug…) */
export function TaskTag({ tag }: TaskTagProps) {
  return (
    <span
      className={clsx('badge', 'tag-' + tag)}
      style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}
    >
      {TAG_LABELS[tag as TagVariant] ?? tag}
    </span>
  );
}

interface StatusBadgeProps {
  status: 'paid' | 'pending' | 'cancelled' | 'active' | 'archived';
}

const STATUS_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  paid:      { variant: 'green',  label: 'Оплачено' },
  pending:   { variant: 'yellow', label: 'Ожидание' },
  cancelled: { variant: 'red',    label: 'Отменено' },
  active:    { variant: 'green',  label: 'Активен' },
  archived:  { variant: 'muted',  label: 'Архив' },
};

/** Статус финансовой записи или проекта */
export function StatusBadge({ status }: StatusBadgeProps) {
  const { variant, label } = STATUS_MAP[status] ?? { variant: 'muted' as BadgeVariant, label: status };
  return <Badge variant={variant} dot>{label}</Badge>;
}

// ── StatusPill — стильные статусные кнопки ─────────────────────────

export type PillStatus  = 'verified' | 'blocked' | 'inactive' | 'active' | 'unverified';
export type PillVariant = 'soft' | 'outline' | 'solid';

interface StatusPillProps {
  status:   PillStatus;
  variant?: PillVariant;
  label?:   string;
  onClick?: () => void;
  className?: string;
}

const PILL_CONFIG: Record<PillStatus, { label: string; Icon: typeof Check; spin?: boolean }> = {
  verified:   { label: 'Verified',   Icon: Check },
  blocked:    { label: 'Blocked',    Icon: Ban },
  inactive:   { label: 'Inactive',   Icon: MinusCircle },
  active:     { label: 'Active',     Icon: Check },
  unverified: { label: 'Unverified', Icon: Loader, spin: true },
};

/**
 * Стильная статусная плашка с иконкой.
 * @example
 * <StatusPill status="verified" variant="solid" />
 * <StatusPill status="blocked" variant="outline" label="Заблокирован" />
 */
export function StatusPill({ status, variant = 'soft', label, onClick, className }: StatusPillProps) {
  const { label: defaultLabel, Icon, spin } = PILL_CONFIG[status];

  return (
    <span
      className={clsx(
        'pill',
        `pill-${status}`,
        `pill-${variant}`,
        onClick && 'pill-clickable',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <Icon size={13} strokeWidth={2.5} className={spin ? 'pill-spin' : undefined} />
      {label ?? defaultLabel}
    </span>
  );
}
