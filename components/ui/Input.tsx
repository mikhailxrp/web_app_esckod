'use client';

import { type InputHTMLAttributes, useId, useState } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  id?: string;
  showPasswordToggle?: boolean;
}

function EyeIcon(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export function Input({
  label,
  placeholder,
  error,
  id,
  className = '',
  type,
  showPasswordToggle = false,
  ...props
}: InputProps): React.ReactElement {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hasError = Boolean(error);
  const hasPasswordToggle = showPasswordToggle && type === 'password';
  const inputType = hasPasswordToggle && isPasswordVisible ? 'text' : type;

  const inputElement = (
    <input
      id={inputId}
      placeholder={placeholder}
      type={inputType}
      aria-invalid={hasError}
      aria-describedby={errorId}
      className={[
        'h-input-height w-full rounded-game-lg border bg-bg-input',
        hasPasswordToggle ? 'pl-3 pr-10' : 'px-3',
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
  );

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="font-base text-game-sm text-content-label"
      >
        {label}
      </label>

      {hasPasswordToggle ? (
        <div className="relative">
          {inputElement}
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-content-secondary transition-colors hover:text-content-primary"
            aria-label={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
            aria-pressed={isPasswordVisible}
            onClick={() => setIsPasswordVisible((visible) => !visible)}
          >
            {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      ) : (
        inputElement
      )}

      {error ? (
        <p id={errorId} className="font-base text-game-sm text-semantic-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
