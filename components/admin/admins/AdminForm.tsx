'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createAdminSchema } from '@/lib/validations/admin-admins';
import { NewPasswordModal } from './NewPasswordModal';

type FormValues = z.infer<typeof createAdminSchema>;

export function AdminForm(): React.ReactElement {
  const router = useRouter();
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createAdminSchema),
  });

  const onSubmit = async (values: FormValues): Promise<void> => {
    setServerError(null);

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'EMAIL_EXISTS') {
          setServerError('Администратор с таким email уже существует.');
        } else {
          setServerError('Не удалось создать администратора. Попробуйте еще раз.');
        }

        return;
      }

      setGeneratedPassword(data.password as string);
    } catch {
      setServerError('Не удалось создать администратора. Попробуйте еще раз.');
    }
  };

  const handleModalClose = (): void => {
    setGeneratedPassword(null);
    router.push('/admin/admins');
  };

  return (
    <>
      <h1 className="text-xl font-semibold text-admin-accent mb-6">
        Управление администраторами
      </h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-8 max-w-xl mx-auto">
          <section className="mb-8">
            <h2 className="text-base font-semibold text-admin-input-text mb-5">
              Общая информация
            </h2>

            <div className="mb-4">
              <label className="block text-sm text-admin-label mb-1.5">
                Почта
              </label>
              <input
                type="email"
                autoComplete="off"
                placeholder="admin@example.com"
                {...register('email')}
                className={[
                  'w-full px-4 py-2.5 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border focus:outline-none placeholder:text-admin-placeholder transition-colors',
                  errors.email
                    ? 'border-red-400'
                    : 'border-transparent focus:border-admin-accent',
                ].join(' ')}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>
          </section>

          <section className="mb-2">
            <h2 className="text-base font-semibold text-admin-input-text mb-3">
              Пароль
            </h2>
            <p className="text-sm text-admin-placeholder">
              Пароль будет сгенерирован автоматически и показан один раз после
              создания.
            </p>
          </section>

          {serverError && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => router.push('/admin/admins')}
            className="px-6 py-2 rounded-lg text-sm text-admin-input-text border border-admin-card-border hover:bg-gray-100 transition-colors"
          >
            Отменить
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Создание...' : 'Добавить'}
          </button>
        </div>
      </form>

      {generatedPassword && (
        <NewPasswordModal
          password={generatedPassword}
          title="Администратор создан"
          onClose={handleModalClose}
        />
      )}
    </>
  );
}
