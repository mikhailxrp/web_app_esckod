'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { resetSchema, type ResetInput } from '@/lib/validations/auth';

const AUTH_CARD_PATTERN = '/'.repeat(60);

const SUCCESS_MESSAGE =
  'Если такой email зарегистрирован, на него отправлено письмо с новым паролем';

interface ResetSuccessResponse {
  success: true;
}

interface ResetErrorResponse {
  success: false;
  error: 'VALIDATION_ERROR';
}

type ResetResponse = ResetSuccessResponse | ResetErrorResponse;

function AuthCardHeader(): React.ReactElement {
  return (
    <header className="auth-card__header">
      <h1 className="auth-card__title">Восстановление пароля</h1>
      <span className="auth-card__pattern" aria-hidden="true">
        {AUTH_CARD_PATTERN}
      </span>
    </header>
  );
}

export function ResetPasswordForm(): React.ReactElement {
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(data: ResetInput): Promise<void> {
    setServerError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = (await response.json()) as ResetResponse;

      if (!result.success) {
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
      <section aria-labelledby="reset-success-title" className="auth-card">
        <AuthCardHeader />

        <div className="auth-card__body">
          <div className="flex flex-col items-center gap-6 py-6">
            <p id="reset-success-title" className="max-w-[360px] text-center">
              {SUCCESS_MESSAGE}
            </p>
            <Link href="/login" className="btn-primary">
              ВЕРНУТЬСЯ К ЛОГИНУ
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="reset-title" className="auth-card">
      <AuthCardHeader />

      <div className="auth-card__body">
        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col items-center py-6"
        >
          <div className="flex w-full max-w-[360px] flex-col gap-4">
            <h2 id="reset-title" className="sr-only">
              Форма восстановления пароля
            </h2>

            <p className="text-content-secondary">
              Введите email, указанный при регистрации. Мы отправим на него новый
              пароль.
            </p>

            <Input
              label="Почта"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />

            {serverError ? (
              <p role="alert" className="form-alert form-alert--error">
                {serverError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
            >
              {isSubmitting ? 'ОТПРАВКА…' : 'ПОДТВЕРДИТЬ'}
            </button>

            <p className="text-center">
              <Link href="/login" className="form-link">
                Вернуться к логину
              </Link>
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
