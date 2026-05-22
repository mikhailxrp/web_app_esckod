'use client';

import { type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-content-inverse hover:bg-accent-hover shadow-game-glow-sm hover:shadow-game-glow-md',
  secondary:
    'border border-border bg-bg-secondary text-content-primary hover:border-border-strong hover:bg-bg-tertiary',
  ghost:
    'bg-transparent text-accent hover:bg-accent-muted',
};

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonProps): React.ReactElement {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      className={[
        'inline-flex h-input-height min-w-[140px] items-center justify-center gap-2',
        'rounded-game-full px-6 font-accent text-game-sm uppercase tracking-game-wide',
        'transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <span
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
