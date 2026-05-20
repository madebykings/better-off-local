'use client';

import { useState } from 'react';

type LogoProps = {
  /** 'horizontal' = full wordmark; 'icon' = square mark only */
  variant?: 'horizontal' | 'icon';
  /** 'light' = for use on white/light backgrounds; 'dark' = for coloured/dark backgrounds */
  scheme?: 'light' | 'dark';
  /** Height in pixels. Width scales proportionally. */
  height?: number;
  className?: string;
};

/**
 * Better Off Local brand logo.
 *
 * Loads the SVG from /brand/ in the app's public directory. Falls back to
 * plain text if the asset is not yet present (e.g. before brand assets have
 * been exported and copied via scripts/copy-brand-assets.js).
 */
export function Logo({
  variant = 'horizontal',
  scheme = 'light',
  height = 28,
  className,
}: LogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={className}
        style={{ fontSize: height * 0.6, fontWeight: 600, lineHeight: 1 }}
      >
        Better Off Local
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/logo-${variant}-${scheme}.svg`}
      alt="Better Off Local"
      height={height}
      onError={() => setFailed(true)}
      className={className}
      style={{ height, width: 'auto' }}
    />
  );
}
