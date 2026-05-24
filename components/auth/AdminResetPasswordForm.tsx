'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetSchema, type ResetInput } from '@/lib/validations/auth';

const INPUT_BASE =
  'w-full h-11 rounded-xl bg-admin-input-bg px-4 font-base text-sm text-admin-input-text ' +
  'placeholder:text-admin-placeholder transition-shadow duration-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-admin-accent focus:ring-offset-0 ';

const INPUT_ERROR = 'ring-2 ring-red-400';

const SUCCESS_MESSAGE = 'Пароль отправлен на указанный Email';

interface ResetSuccessResponse {
  success: true;
}

interface ResetErrorResponse {
  success: false;
  error: 'VALIDATION_ERROR' | 'ADMIN_NOT_FOUND' | 'RATE_LIMIT_EXCEEDED';
}

type ResetResponse = ResetSuccessResponse | ResetErrorResponse;

export function AdminResetPasswordForm(): React.ReactElement {
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const emailId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(data: ResetInput): Promise<void> {
    setServerError(null);

    try {
      const response = await fetch('/api/admin/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = (await response.json()) as ResetResponse;

      if (!result.success) {
        if (result.error === 'ADMIN_NOT_FOUND') {
          setServerError('Администратор с таким email не найден');
          return;
        }

        setServerError('Проверьте правильность введённых данных');
        return;
      }

      setIsSuccess(true);
    } catch (error) {
      console.error('Password reset failed:', error);
      setServerError('Не удалось отправить запрос. Попробуйте ещё раз');
    }
  }

  if (isSuccess) {
    return (
      <section
        aria-labelledby="admin-reset-success-title"
        className="w-full max-w-[730px] rounded-2xl bg-admin-card-bg shadow-admin-card px-8 py-10"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 id="admin-reset-success-title" className="font-base text-xl font-bold text-admin-input-text">
            Письмо отправлено
          </h1>
          <p className="font-base text-sm text-admin-label max-w-[330px]">
            {SUCCESS_MESSAGE}
          </p>
          <Link
            href="/admin-login"
            className="font-base text-sm text-admin-accent hover:text-admin-accent-hover transition-colors duration-150"
          >
            Вернуться к входу
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="admin-reset-title"
      className="w-full max-w-[730px] rounded-2xl bg-admin-card-bg shadow-admin-card px-8 py-10"
    >
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col items-center"
      >
        <div className="flex w-full max-w-[330px] flex-col gap-5">

          <div className="flex flex-col items-center gap-1 text-center">
            <h1 id="admin-reset-title" className="font-base text-xl font-bold text-admin-input-text">
              Забыли пароль?
            </h1>
            <p className="font-base text-sm text-admin-placeholder">
              Отправим его на почту
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={emailId} className="font-base text-sm text-admin-label">
              Email
            </label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
              className={`${INPUT_BASE}${errors.email ? INPUT_ERROR : ''} admin-input`}
              {...register('email')}
            />
            {errors.email ? (
              <p id={`${emailId}-error`} role="alert" className="font-base text-xs text-red-500">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          {serverError ? (
            <p role="alert" className="font-base text-sm text-center text-red-500">
              {serverError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-xl bg-admin-accent font-base text-sm font-medium text-white transition-colors duration-150 hover:bg-admin-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Отправка…' : 'Сбросить пароль'}
          </button>

          <div className="flex justify-center">
            <Link
              href="/admin-login"
              className="font-base text-sm text-admin-accent hover:text-admin-accent-hover transition-colors duration-150"
            >
              Назад
            </Link>
          </div>

        </div>
      </form>
    </section>
  );
}
