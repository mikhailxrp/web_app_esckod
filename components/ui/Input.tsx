'use client';

import { type InputHTMLAttributes, useId } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  id?: string;
}

export function Input({
  label,
  placeholder,
  error,
  id,
  className = '',
  ...props
}: InputProps): React.ReactElement {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hasError = Boolean(error);

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="font-base text-game-sm text-content-label"
      >
        {label}
      </label>

      <input
        id={inputId}
        placeholder={placeholder}
        aria-invalid={hasError}
        aria-describedby={errorId}
        className={[
          'h-input-height w-full rounded-game-lg border bg-bg-input px-3',
          'font-base text-game-base text-content-primary',
          'placeholder:text-content-muted',
          'transition-shadow duration-200',
          'focus:outline-none',
          hasError
            ? 'border-border-error shadow-game-error'
            : 'border-border focus:border-border-focus focus:shadow-game-focus',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />

      {error ? (
        <p id={errorId} className="font-base text-game-sm text-semantic-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
