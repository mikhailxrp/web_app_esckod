'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createKeySchema } from '@/lib/validations/admin-keys';

const formSchema = createKeySchema.extend({
  key: z.string().min(1, 'Ключ обязателен').max(100, 'Максимум 100 символов'),
  maxActivations: z
    .number({ invalid_type_error: 'Введите число' })
    .int()
    .min(1, 'Минимум 1')
    .max(100, 'Максимум 100'),
});

type FormValues = z.infer<typeof formSchema>;

export function AddKeyForm(): React.ReactElement {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { maxActivations: 5 },
  });

  const onSubmit = async (values: FormValues): Promise<void> => {
    setServerError(null);
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'KEY_EXISTS') {
          setServerError('Ключ с таким значением уже существует');
          return;
        }
        setServerError('Ошибка при создании ключа');
        return;
      }

      reset();
      router.push('/admin/keys');
    } catch {
      setServerError('Ошибка соединения. Попробуйте снова.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-6 mb-6">
      <h2 className="text-base font-semibold text-admin-input-text mb-5">
        Добавление ключа
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label
              htmlFor="key"
              className="block text-sm text-admin-label mb-1"
            >
              Ключ
            </label>
            <input
              id="key"
              type="text"
              placeholder="Введите ключ доступа"
              {...register('key')}
              className={[
                'w-full rounded-lg bg-admin-input-bg text-admin-input-text text-sm px-3 py-2 border focus:outline-none focus:border-admin-accent placeholder:text-admin-placeholder transition-colors',
                errors.key ? 'border-red-400' : 'border-transparent',
              ].join(' ')}
            />
            {errors.key && (
              <p className="mt-1 text-xs text-red-500">{errors.key.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="maxActivations"
              className="block text-sm text-admin-label mb-1"
            >
              Лимит активаций
            </label>
            <input
              id="maxActivations"
              type="number"
              min={1}
              max={100}
              placeholder="5"
              {...register('maxActivations', { valueAsNumber: true })}
              className={[
                'w-full rounded-lg bg-admin-input-bg text-admin-input-text text-sm px-3 py-2 border focus:outline-none focus:border-admin-accent placeholder:text-admin-placeholder transition-colors',
                errors.maxActivations ? 'border-red-400' : 'border-transparent',
              ].join(' ')}
            />
            {errors.maxActivations && (
              <p className="mt-1 text-xs text-red-500">
                {errors.maxActivations.message}
              </p>
            )}
          </div>
        </div>

        {serverError && (
          <p className="mb-3 text-sm text-red-500">{serverError}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  );
}
