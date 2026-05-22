/**
 * @file BrandLogo.tsx
 * Логотип BAZZAR.
 *
 * По умолчанию использует реальное фото из /logo.png (положи файл в public/).
 * Если фото нет — автоматический fallback на CSS-голографию (буква B с
 * вращающимся conic-gradient).
 *
 * Для фото с чёрным фоном включён mix-blend-mode: screen — на тёмной UI
 * чёрный пиксели "испаряются", остаётся только сама наклейка.
 */

import { useState } from 'react';
import clsx from 'clsx';

interface BrandLogoProps {
  /** Размер квадрата в пикселях */
  size?:      number;
  /** Анимировать голографическое кольцо (только для fallback) */
  animated?:  boolean;
  /** Класс для контейнера */
  className?: string;
  /** Путь к картинке; по умолчанию /logo.png. Поставь null чтобы всегда использовать CSS-fallback. */
  image?:     string | null;
}

export function BrandLogo({
  size = 56,
  animated = true,
  className,
  image = '/logo.png',
}: BrandLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const radius = Math.round(size * 0.26);

  // Если задано изображение и оно не упало — показываем его
  if (image && !imageFailed) {
    return (
      <img
        src={image}
        alt="BAZZAR"
        className={clsx('brand-logo-img', className)}
        style={{ width: size, height: size, borderRadius: radius }}
        onError={() => setImageFailed(true)}
        draggable={false}
      />
    );
  }

  // Fallback: CSS-голография
  return (
    <div
      className={clsx('brand-logo', className)}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <div
        className={clsx('brand-logo-ring', animated && 'brand-logo-ring-spin')}
        style={{ borderRadius: radius }}
      />
      <div
        className="brand-logo-inner"
        style={{ borderRadius: radius - 2 }}
      >
        <span className="brand-logo-letter" style={{ fontSize: Math.round(size * 0.48) }}>
          B
        </span>
      </div>
    </div>
  );
}
