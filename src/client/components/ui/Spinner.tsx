/**
 * @file Spinner.tsx
 * Компоненты индикаторов загрузки.
 */

interface SpinnerProps {
  size?: number;
  className?: string;
}

/** Inline спиннер (в кнопках, внутри контента) */
export function Spinner({ size = 16, className }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
    </svg>
  );
}

/** Полноэкранный спиннер для Suspense fallback */
export function PageSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: '2px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }}
        />
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Загрузка...</div>
      </div>
    </div>
  );
}

/** Типичные dots-анимация в чате */
export function TypingDots() {
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: '11px 16px', background: 'var(--bg-card2)', borderRadius: '16px 16px 16px 4px', alignSelf: 'flex-start' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--text-muted)',
            display: 'inline-block',
            animation: 'blink 1.2s infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}
