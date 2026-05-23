'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { loginFormSchema, type LoginFormInput } from '@/lib/validations/auth';

const INPUT_BASE =
  'w-full h-11 rounded-xl bg-admin-input-bg px-4 font-base text-sm text-admin-input-text ' +
  'placeholder:text-admin-placeholder transition-shadow duration-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-admin-accent focus:ring-offset-0 ';

const INPUT_ERROR = 'ring-2 ring-red-400';

function EyeIcon(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="size-4" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="size-4" aria-hidden="true">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export function AdminLoginForm(): React.ReactElement {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: LoginFormInput): Promise<void> {
    setAuthError(null);

    try {
      const result = await signIn('admin', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (!result) {
        setAuthError('Произошла ошибка. Попробуйте ещё раз');
        return;
      }

      if (result.error === undefined) {
        router.push('/admin');
        return;
      }

      if (result.error === 'CredentialsSignin') {
        setAuthError('Неверный email или пароль');
        return;
      }

      setAuthError('Произошла ошибка. Попробуйте ещё раз');
    } catch (error) {
      console.error('Admin login failed:', error);
      setAuthError('Произошла ошибка. Попробуйте ещё раз');
    }
  }

  return (
    <section
      aria-labelledby="admin-login-title"
      className="w-full max-w-[730px] rounded-2xl bg-admin-card-bg shadow-admin-card px-8 py-8"
    >
      <h1 id="admin-login-title" className="sr-only">
        Форма входа администратора
      </h1>

      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col items-center py-4"
      >
        <div className="flex w-full max-w-[330px] flex-col gap-5">

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={emailId} className="font-base text-sm text-admin-label">
              Введите Email
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

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={passwordId} className="font-base text-sm text-admin-label">
              Пароль
            </label>
            <div className="relative">
              <input
                id={passwordId}
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? `${passwordId}-error` : undefined}
                className={`${INPUT_BASE}pr-10 ${errors.password ? INPUT_ERROR : ''} admin-input`}
                {...register('password')}
              />
              <button
                type="button"
                aria-label={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                aria-pressed={isPasswordVisible}
                onClick={() => setIsPasswordVisible((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-placeholder hover:text-admin-label transition-colors duration-150"
              >
                {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password ? (
              <p id={`${passwordId}-error`} role="alert" className="font-base text-xs text-red-500">
                {errors.password.message}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Link
                href="/admin-reset-password"
                className="font-base text-sm text-admin-accent hover:text-admin-accent-hover transition-colors duration-150"
              >
                Забыли пароль?
              </Link>
            </div>
          </div>

          {authError ? (
            <p role="alert" className="font-base text-sm text-center text-red-500">
              {authError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-xl bg-admin-accent font-base text-sm font-medium text-white transition-colors duration-150 hover:bg-admin-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Вход…' : 'Войти'}
          </button>

        </div>
      </form>
    </section>
  );
}
