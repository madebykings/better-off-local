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
 * Serves PNG assets from /public in the host app.
 * horizontal → /better-off-local-logo.png
 * icon       → /better-off-local-icon.png
 */
export function Logo({
  variant = 'horizontal',
  scheme: _scheme = 'light',
  height = 28,
  className,
}: LogoProps) {
  const src =
    variant === 'icon'
      ? '/better-off-local-icon.png'
      : '/better-off-local-logo.png';

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Better Off Local"
      height={height}
      className={className}
      style={{ height, width: 'auto' }}
    />
  );
}
