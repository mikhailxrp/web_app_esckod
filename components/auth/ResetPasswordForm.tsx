'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { resetSchema, type ResetInput } from '@/lib/validations/auth';

const AUTH_CARD_PATTERN = '/'.repeat(60);
const FALLBACK_SUPPORT_EMAIL = 'support@example.com';

interface RegistrationDefaults {
  supportEmail: string;
}

interface ResetSuccessResponse {
  success: true;
}

interface ResetErrorResponse {
  success: false;
  error: 'VALIDATION_ERROR' | 'EMAIL_NOT_FOUND' | 'RATE_LIMIT_EXCEEDED';
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
  const [isEmailNotFound, setIsEmailNotFound] = useState(false);
  const [supportEmail, setSupportEmail] = useState(FALLBACK_SUPPORT_EMAIL);

  useEffect(() => {
    let isMounted = true;

    async function loadSupportEmail(): Promise<void> {
      try {
        const res = await fetch('/api/settings/registration-defaults');
        if (!res.ok) return;
        const data = (await res.json()) as RegistrationDefaults;
        if (isMounted) setSupportEmail(data.supportEmail);
      } catch (error) {
        console.error('Failed to load support email:', error);
      }
    }

    void loadSupportEmail();

    return () => {
      isMounted = false;
    };
  }, []);

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
    setIsEmailNotFound(false);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = (await response.json()) as ResetResponse;

      if (!result.success) {
        if (result.error === 'EMAIL_NOT_FOUND') {
          setServerError('Почта не найдена');
          setIsEmailNotFound(true);
        } else if (result.error === 'RATE_LIMIT_EXCEEDED') {
          setServerError('Слишком много попыток. Попробуйте позже');
        } else {
          setServerError('Проверьте правильность введённых данных');
        }
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
            <div
              id="reset-success-title"
              className="flex max-w-[360px] flex-col gap-2 text-center"
            >
              <p>На ваш email отправлено письмо с новым паролем</p>
              <p className="text-content-secondary">
                Если письмо не приходит: обращайтесь в службу поддержки по
                адресу{' '}
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-accent hover:text-accent-hover"
                >
                  {supportEmail}
                </a>
              </p>
            </div>
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
              {isEmailNotFound ? (
                <Link href="/register" className="form-link">
                  Зарегистрироваться
                </Link>
              ) : (
                <Link href="/login" className="form-link">
                  Вернуться к логину
                </Link>
              )}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
