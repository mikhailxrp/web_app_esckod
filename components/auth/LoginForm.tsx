'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { Input } from '@/components/ui/Input';
import {
  loginFormSchema,
  type LoginFormInput,
} from '@/lib/validations/auth';

const AUTH_CARD_PATTERN = '/'.repeat(60);
const FALLBACK_SUPPORT_EMAIL = 'support@example.com';

type BlockStatus = 'ok' | 'USER_BLOCKED' | 'KEY_BLOCKED';

interface CheckBlockResponse {
  status: BlockStatus;
}

interface RegistrationDefaults {
  supportEmail: string;
}

function AuthCardHeader(): React.ReactElement {
  return (
    <header className="auth-card__header">
      <h1 className="auth-card__title">Вход</h1>
      <span className="auth-card__pattern" aria-hidden="true">
        {AUTH_CARD_PATTERN}
      </span>
    </header>
  );
}

async function checkBlockStatus(email: string): Promise<BlockStatus> {
  try {
    const res = await fetch('/api/auth/check-block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json()) as CheckBlockResponse;
    return data.status;
  } catch {
    return 'ok';
  }
}

export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [supportEmail, setSupportEmail] = useState(FALLBACK_SUPPORT_EMAIL);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

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

  async function onSubmit(data: LoginFormInput): Promise<void> {
    setAuthError(null);

    try {
      const blockStatus = await checkBlockStatus(data.email);

      if (blockStatus === 'USER_BLOCKED') {
        setAuthError(
          `Ваш аккаунт заблокирован. Обратитесь в поддержку: ${supportEmail}`,
        );
        return;
      }

      if (blockStatus === 'KEY_BLOCKED') {
        setAuthError(
          `Ваш ключ доступа заблокирован. Обратитесь в поддержку: ${supportEmail}`,
        );
        return;
      }

      const result = await signIn('player', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (!result) {
        setAuthError('Произошла ошибка. Попробуйте ещё раз');
        return;
      }

      if (result.error === undefined) {
        router.push('/dashboard');
        return;
      }

      if (result.error === 'CredentialsSignin') {
        setAuthError('Неверный email или пароль');
        return;
      }

      setAuthError('Произошла ошибка. Попробуйте ещё раз');
    } catch (error) {
      console.error('Login failed:', error);
      setAuthError('Произошла ошибка. Попробуйте ещё раз');
    }
  }

  return (
    <section aria-labelledby="login-title" className="auth-card">
      <AuthCardHeader />

      <div className="auth-card__body">
        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col items-center py-6"
        >
          <div className="flex w-full max-w-[360px] flex-col gap-4">
            <h2 id="login-title" className="sr-only">
              Форма входа
            </h2>

            <Input
              label="Почта"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="flex flex-col gap-1.5">
              <Input
                label="Пароль"
                type="password"
                showPasswordToggle
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />

              <div className="text-right">
                <Link href="/reset-password" className="form-link">
                  Забыли пароль?
                </Link>
              </div>
            </div>

            {authError ? (
              <p role="alert" className="form-alert form-alert--error">
                {authError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
            >
              {isSubmitting ? 'ВХОД…' : 'ПОДТВЕРДИТЬ'}
            </button>

            <p className="text-center">
              <Link href="/register" className="form-link">
                Зарегистрироваться
              </Link>
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
