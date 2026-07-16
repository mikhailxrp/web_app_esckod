'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, RefreshCw } from 'lucide-react';
import {
  updateSettingsSchema,
  type UpdateSettingsInput,
} from '@/lib/validations/app-settings';
import { PlaceholderWarningBanner } from './PlaceholderWarningBanner';
import { MarketingConsentWarningModal } from './MarketingConsentWarningModal';

interface AppSettingsData {
  id: string;
  supportEmail: string;
  defaultMarketingConsent: boolean;
  crackLaunchHint: string;
  decipherLaunchHint: string;
  rdpLaunchHint: string;
  updatedAt: string;
}

interface AppSettingsFormProps {
  initialData: AppSettingsData;
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

export function AppSettingsForm({
  initialData,
}: AppSettingsFormProps): React.ReactElement {
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [pendingData, setPendingData] = useState<UpdateSettingsInput | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: {
      supportEmail: initialData.supportEmail,
      defaultMarketingConsent: initialData.defaultMarketingConsent,
      crackLaunchHint: initialData.crackLaunchHint,
      decipherLaunchHint: initialData.decipherLaunchHint,
      rdpLaunchHint: initialData.rdpLaunchHint,
    },
  });

  const watchedEmail = watch('supportEmail') ?? initialData.supportEmail;

  const showToast = (type: 'success' | 'error', message: string): void => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const performSave = async (data: UpdateSettingsInput): Promise<void> => {
    try {
      const res = await fetch('/api/admin/app-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.error === 'VALIDATION_ERROR') {
          showToast('error', 'Некорректные данные. Проверьте email.');
        } else {
          showToast('error', 'Не удалось сохранить настройки. Попробуйте еще раз.');
        }
        return;
      }

      reset({
        supportEmail: json.supportEmail,
        defaultMarketingConsent: json.defaultMarketingConsent,
        crackLaunchHint: json.crackLaunchHint,
        decipherLaunchHint: json.decipherLaunchHint,
        rdpLaunchHint: json.rdpLaunchHint,
      });

      showToast('success', 'Настройки сохранены.');
    } catch {
      showToast('error', 'Не удалось сохранить настройки. Попробуйте еще раз.');
    }
  };

  const onSubmit = (data: UpdateSettingsInput): void => {
    if (data.defaultMarketingConsent === true && !initialData.defaultMarketingConsent) {
      setPendingData(data);
      setShowModal(true);
      return;
    }

    void performSave(data);
  };

  const handleModalConfirm = (): void => {
    setShowModal(false);
    if (pendingData) {
      void performSave(pendingData);
      setPendingData(null);
    }
  };

  const handleModalCancel = (): void => {
    setShowModal(false);
    setPendingData(null);
  };

  const handleReset = (): void => {
    reset({
      supportEmail: initialData.supportEmail,
      defaultMarketingConsent: initialData.defaultMarketingConsent,
      crackLaunchHint: initialData.crackLaunchHint,
      decipherLaunchHint: initialData.decipherLaunchHint,
      rdpLaunchHint: initialData.rdpLaunchHint,
    });
  };

  const inputBase =
    'w-full px-4 py-2.5 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border focus:outline-none placeholder:text-admin-placeholder transition-colors';

  return (
    <>
      <PlaceholderWarningBanner supportEmail={watchedEmail} />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-8 max-w-3xl">
          <h2 className="text-base font-semibold text-admin-input-text mb-6">
            Настройки
          </h2>

          {/* supportEmail */}
          <div className="grid grid-cols-[220px_1fr] items-start gap-4 mb-5">
            <label className="text-sm text-admin-label pt-2.5">
              Адрес службы поддержки
            </label>
            <div>
              <input
                type="email"
                placeholder="support@example.com"
                {...register('supportEmail')}
                className={[
                  inputBase,
                  errors.supportEmail
                    ? 'border-red-400'
                    : 'border-transparent focus:border-admin-accent',
                ].join(' ')}
              />
              {errors.supportEmail && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.supportEmail.message}
                </p>
              )}
            </div>
          </div>

          {/* defaultMarketingConsent */}
          <div className="grid grid-cols-[220px_1fr] items-start gap-4 mb-2">
            <label className="text-sm text-admin-label pt-2.5">
              Маркетинговая метка (дефолт)
            </label>
            <div>
              <select
                {...register('defaultMarketingConsent', {
                  setValueAs: (v: string) => v === 'true',
                })}
                defaultValue={String(initialData.defaultMarketingConsent)}
                className={[
                  inputBase,
                  'cursor-pointer appearance-none',
                  errors.defaultMarketingConsent
                    ? 'border-red-400'
                    : 'border-transparent focus:border-admin-accent',
                ].join(' ')}
              >
                <option value="false">Отключено</option>
                <option value="true">Включено</option>
              </select>
            </div>
          </div>

          <div className="my-6 border-t border-admin-card-border" />

          <h3 className="text-sm font-semibold text-admin-input-text mb-1">
            Инструкции к формам запуска миссий
          </h3>
          <p className="text-xs text-admin-placeholder mb-4">
            Текст подсказки по значку «i» в окне запуска миссии (появляется по кнопке «Открыть» на плашке). Пустое поле — значок скрыт.
          </p>

          {/* crackLaunchHint */}
          <div className="grid grid-cols-[220px_1fr] items-start gap-4 mb-5">
            <label className="text-sm text-admin-label pt-2.5">
              Взломщик сайтов
            </label>
            <textarea
              rows={3}
              placeholder="Например: введите адрес сайта и почту, доступ к которой нужно получить."
              {...register('crackLaunchHint')}
              className={[
                inputBase,
                'resize-y',
                errors.crackLaunchHint
                  ? 'border-red-400'
                  : 'border-transparent focus:border-admin-accent',
              ].join(' ')}
            />
          </div>

          {/* decipherLaunchHint */}
          <div className="grid grid-cols-[220px_1fr] items-start gap-4 mb-5">
            <label className="text-sm text-admin-label pt-2.5">
              Дешифратор папок
            </label>
            <textarea
              rows={3}
              placeholder="Например: введите путь к папке и кодовое слово."
              {...register('decipherLaunchHint')}
              className={[
                inputBase,
                'resize-y',
                errors.decipherLaunchHint
                  ? 'border-red-400'
                  : 'border-transparent focus:border-admin-accent',
              ].join(' ')}
            />
          </div>

          {/* rdpLaunchHint */}
          <div className="grid grid-cols-[220px_1fr] items-start gap-4 mb-2">
            <label className="text-sm text-admin-label pt-2.5">
              Удаленный доступ
            </label>
            <textarea
              rows={3}
              placeholder="Например: введите IP-адрес компьютера, к которому нужно подключиться."
              {...register('rdpLaunchHint')}
              className={[
                inputBase,
                'resize-y',
                errors.rdpLaunchHint
                  ? 'border-red-400'
                  : 'border-transparent focus:border-admin-accent',
              ].join(' ')}
            />
          </div>

          {/* updatedAt */}
          <p className="mt-6 text-xs text-admin-placeholder">
            Последнее обновление:{' '}
            {new Date(initialData.updatedAt).toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={[
              'flex items-center gap-2 mt-4 max-w-3xl px-4 py-3 rounded-xl text-sm',
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800',
            ].join(' ')}
          >
            {toast.type === 'success' && (
              <Check size={15} className="shrink-0 text-green-600" />
            )}
            {toast.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || isSubmitting}
            className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm text-admin-input-text border border-admin-card-border hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} />
            Отменить
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="px-6 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>

      <MarketingConsentWarningModal
        isOpen={showModal}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </>
  );
}
