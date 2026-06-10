'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { MissionType } from '@prisma/client';
import type { ActiveRdpSlot, MissionSlotDetail } from '@/types/admin-mission-slots';
import {
  createMissionSlotSchema,
  updateCrackMissionSlotSchema,
  updateDecipherMissionSlotSchema,
  updateRdpMissionSlotSchema,
} from '@/lib/validations/admin-mission-slots';
import { CrackSlotFields } from './CrackSlotFields';
import { DecipherSlotFields } from './DecipherSlotFields';
import { RdpSlotFields } from './RdpSlotFields';
import { SlotWarningBanner } from './SlotWarningBanner';
import { Field } from './FormField';
import { DeleteSlotDialog } from './DeleteSlotDialog';

// ── Exported form values type — used by sub-components ────────────────────────

export interface MissionSlotFormValues {
  // Common
  displayName: string;
  orderIndex: number;
  isActive: string; // 'true' | 'false' (from select)
  hintText: string;
  // Create only
  missionType: MissionType;
  slotKey: string;
  // CRACK
  targetUrl: string;
  targetEmail: string;
  resultPassword: string;
  crackMaxAttempts: number;
  // DECIPHER
  cipherType: string;
  encryptedWord: string;
  cipherKey: string;
  folderPassword: string;
  folderPath: string;
  unlocksRdpFolder: string;
  unlocksRdpSlotKey: string;
  // RDP
  rdpScenario: number;
  correctIp: string;
  logSubjectName: string;
  timerSeconds: number;
  nextRdpSlotKey: string;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface MissionSlotFormProps {
  mode: 'create' | 'edit';
  slot?: MissionSlotDetail;
  activeRdpSlots: ActiveRdpSlot[];
}

// ── Labels ────────────────────────────────────────────────────────────────────

const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  CRACK: 'Взлом сайта',
  DECIPHER: 'Дешифратор',
  RDP: 'Удалённый доступ',
};

// ── Default values builder ────────────────────────────────────────────────────

function buildDefaultValues(
  mode: 'create' | 'edit',
  slot?: MissionSlotDetail,
): MissionSlotFormValues {
  if (mode === 'create' || !slot) {
    return {
      missionType: 'CRACK',
      slotKey: '',
      displayName: '',
      orderIndex: 1,
      isActive: 'true',
      hintText: '',
      targetUrl: '',
      targetEmail: '',
      resultPassword: '',
      crackMaxAttempts: 5,
      cipherType: 'PLAYFAIR',
      encryptedWord: '',
      cipherKey: '',
      folderPassword: '',
      folderPath: '',
      unlocksRdpFolder: '',
      unlocksRdpSlotKey: '',
      rdpScenario: 2,
      correctIp: '',
      logSubjectName: '',
      timerSeconds: 120,
      nextRdpSlotKey: '',
    };
  }

  return {
    missionType: slot.missionType,
    slotKey: slot.slotKey,
    displayName: slot.displayName,
    orderIndex: slot.orderIndex,
    isActive: String(slot.isActive),
    hintText: slot.hintText ?? '',
    targetUrl: slot.targetUrl ?? '',
    targetEmail: slot.targetEmail ?? '',
    resultPassword: slot.resultPassword ?? '',
    crackMaxAttempts: slot.crackMaxAttempts ?? 5,
    cipherType: slot.cipherType ?? 'PLAYFAIR',
    encryptedWord: slot.encryptedWord ?? '',
    cipherKey: slot.cipherKey ?? '',
    folderPassword: slot.folderPassword ?? '',
    folderPath: slot.folderPath ?? '',
    unlocksRdpFolder: slot.unlocksRdpFolder ?? '',
    unlocksRdpSlotKey: slot.unlocksRdpSlotKey ?? '',
    rdpScenario: slot.rdpScenario ?? 2,
    correctIp: slot.correctIp ?? '',
    logSubjectName: slot.logSubjectName ?? '',
    timerSeconds: slot.timerSeconds ?? 120,
    nextRdpSlotKey: slot.nextRdpSlotKey ?? '',
  };
}

// ── Payload builders ──────────────────────────────────────────────────────────

function buildCommonFields(values: MissionSlotFormValues): Record<string, unknown> {
  return {
    displayName: values.displayName,
    orderIndex: values.orderIndex,
    isActive: values.isActive === 'true',
    hintText: values.hintText.trim() || null,
  };
}

function buildPayload(
  values: MissionSlotFormValues,
  mode: 'create' | 'edit',
  missionType: MissionType,
): Record<string, unknown> {
  const common = buildCommonFields(values);

  let typeFields: Record<string, unknown>;

  if (missionType === 'CRACK') {
    typeFields = {
      targetUrl: values.targetUrl,
      targetEmail: values.targetEmail,
      resultPassword: values.resultPassword,
      crackMaxAttempts: values.crackMaxAttempts,
    };
  } else if (missionType === 'DECIPHER') {
    typeFields = {
      cipherType: values.cipherType,
      encryptedWord: values.encryptedWord,
      cipherKey: values.cipherKey,
      folderPassword: values.folderPassword,
      folderPath: values.folderPath,
      unlocksRdpFolder: values.unlocksRdpFolder.trim() || null,
      unlocksRdpSlotKey: values.unlocksRdpSlotKey.trim() || null,
    };
  } else {
    // RDP
    const scenario = values.rdpScenario as 1 | 2;
    typeFields = {
      rdpScenario: scenario,
      correctIp: values.correctIp,
      logSubjectName: values.logSubjectName,
      timerSeconds: scenario === 1 ? null : values.timerSeconds,
      rdpPuzzleGridSize: scenario === 1 ? 6 : 7,
      nextRdpSlotKey: scenario === 1 ? values.nextRdpSlotKey : null,
    };
  }

  if (mode === 'create') {
    return { missionType, slotKey: values.slotKey.trim(), ...common, ...typeFields };
  }

  return { ...common, ...typeFields };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MissionSlotForm({
  mode,
  slot,
  activeRdpSlots,
}: MissionSlotFormProps): React.ReactElement {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [apiWarnings, setApiWarnings] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const confirmedPayloadRef = useRef<Record<string, unknown> | null>(null);

  const {
    register,
    watch,
    control,
    setError,
    getValues,
    formState: { errors },
  } = useForm<MissionSlotFormValues>({
    defaultValues: buildDefaultValues(mode, slot),
  });

  const missionType = watch('missionType') as MissionType;
  const activeMissionType = mode === 'edit' && slot ? slot.missionType : missionType;

  // ── Validation + submit flow ────────────────────────────────────────────────

  function getSchema(type: MissionType) {
    if (mode === 'create') return createMissionSlotSchema;
    if (type === 'CRACK') return updateCrackMissionSlotSchema;
    if (type === 'DECIPHER') return updateDecipherMissionSlotSchema;
    return updateRdpMissionSlotSchema;
  }

  async function submitToApi(payload: Record<string, unknown>): Promise<void> {
    setIsLoading(true);
    try {
      const url =
        mode === 'create'
          ? '/api/admin/mission-slots'
          : `/api/admin/mission-slots/${slot!.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        warnings?: Array<{ code: string; message: string } | string>;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setError('root', { message: data.message ?? 'Ошибка сервера' });
        return;
      }

      const warnings = (data.warnings ?? []).map((w) =>
        typeof w === 'string' ? w : w.message,
      );
      if (warnings.length > 0) {
        setApiWarnings(warnings);
        setTimeout(() => router.push('/admin/mission-slots'), 1500);
      } else {
        router.push('/admin/mission-slots');
      }
    } catch {
      setError('root', { message: 'Не удалось выполнить запрос' });
    } finally {
      setIsLoading(false);
    }
  }

  function validateAndPrepare(): Record<string, unknown> | null {
    const values = getValues();
    const payload = buildPayload(values, mode, activeMissionType);
    const schema = getSchema(activeMissionType);
    const result = schema.safeParse(payload);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      for (const [field, messages] of Object.entries(fieldErrors)) {
        const msg = messages?.[0];
        if (msg) {
          setError(field as keyof MissionSlotFormValues, { message: msg });
        }
      }
      return null;
    }

    return result.data as Record<string, unknown>;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();

    const payload = validateAndPrepare();
    if (!payload) return;

    if (mode === 'edit' && (slot?.completionsCount ?? 0) > 0) {
      confirmedPayloadRef.current = payload;
      setShowConfirmDialog(true);
      return;
    }

    void submitToApi(payload);
  }

  function handleConfirm(): void {
    setShowConfirmDialog(false);
    if (confirmedPayloadRef.current) {
      void submitToApi(confirmedPayloadRef.current);
      confirmedPayloadRef.current = null;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const pageTitle = mode === 'create' ? 'Добавление миссии' : 'Редактирование миссии';
  const submitLabel = mode === 'create' ? 'Создать' : 'Сохранить';
  const hasActivePlayers = mode === 'edit' && (slot?.completionsCount ?? 0) > 0;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">{pageTitle}</h1>

      <div className="max-w-3xl rounded-2xl border border-admin-card-border bg-white p-6 shadow-sm dark:bg-gray-900">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">

          {/* ── Тип миссии ──────────────────────────────────────────────── */}
          {mode === 'create' ? (
            <Field label="Тип миссии" htmlFor="missionType" required>
              <select
                {...register('missionType')}
                id="missionType"
                className="input-field"
              >
                <option value="CRACK">Взлом сайта</option>
                <option value="DECIPHER">Дешифратор</option>
                <option value="RDP">Удалённый доступ</option>
              </select>
            </Field>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Тип миссии
              </span>
              <div className="input-field-readonly w-fit rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                {MISSION_TYPE_LABELS[slot!.missionType]}
              </div>
            </div>
          )}

          {/* ── Общие поля ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Номер слота */}
            <Field
              label="Ключ слота"
              htmlFor="slotKey"
              hint={mode === 'create' ? 'Формат: CRACK_НАЗВАНИЕ (латиница + подчёркивание)' : undefined}
              error={errors.slotKey?.message}
              required={mode === 'create'}
            >
              {mode === 'create' ? (
                <input
                  {...register('slotKey')}
                  id="slotKey"
                  type="text"
                  className="input-field"
                  aria-describedby="slotKey-hint"
                />
              ) : (
                <div
                  id="slotKey"
                  className="input-field-readonly rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300"
                >
                  {slot!.slotKey}
                </div>
              )}
            </Field>

            {/* Порядковый номер */}
            <Field
              label="Порядковый номер"
              htmlFor="orderIndex"
              error={errors.orderIndex?.message}
              required
            >
              <input
                {...register('orderIndex', { valueAsNumber: true })}
                id="orderIndex"
                type="number"
                min={1}
                className="input-field"
              />
            </Field>

            {/* Наименование */}
            <Field
              label="Наименование"
              htmlFor="displayName"
              error={errors.displayName?.message}
              required
            >
              <input
                {...register('displayName')}
                id="displayName"
                type="text"
                className="input-field"
              />
            </Field>

            {/* Активна */}
            <Field
              label="Активна"
              htmlFor="isActive"
              error={errors.isActive?.message}
            >
              <select
                {...register('isActive')}
                id="isActive"
                className="input-field"
              >
                <option value="true">Да</option>
                <option value="false">Нет</option>
              </select>
            </Field>

            {/* Инструкция */}
            <Field
              label="Инструкция"
              htmlFor="hintText"
              hint="Текст подсказки, отображаемой игроку (необязательно)"
              error={errors.hintText?.message}
              className="sm:col-span-2"
            >
              <textarea
                {...register('hintText')}
                id="hintText"
                rows={3}
                placeholder="Текст подсказки..."
                className="input-field resize-none"
              />
            </Field>
          </div>

          {/* ── Разделитель + секция по типу ────────────────────────────── */}
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Настройки миссии
              </span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            {activeMissionType === 'CRACK' && (
              <CrackSlotFields register={register} errors={errors} />
            )}
            {activeMissionType === 'DECIPHER' && (
              <DecipherSlotFields
                register={register}
                errors={errors}
                activeRdpSlots={activeRdpSlots}
              />
            )}
            {activeMissionType === 'RDP' && (
              <RdpSlotFields
                register={register}
                errors={errors}
                control={control}
                activeRdpSlots={activeRdpSlots}
              />
            )}
          </div>

          {/* ── Ошибка корня + предупреждения API ───────────────────────── */}
          {errors.root?.message && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            >
              {errors.root.message}
            </p>
          )}

          {apiWarnings.length > 0 && <SlotWarningBanner warnings={apiWarnings} />}

          {/* ── Предупреждение «Есть активные игроки» (edit mode) ────────── */}
          {hasActivePlayers && (
            <p className="text-sm font-medium text-pink-600 dark:text-pink-400">
              Есть активные игроки
            </p>
          )}

          {/* ── Кнопки ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {mode === 'edit' && slot && (
              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isLoading}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/30"
              >
                Удалить
              </button>
            )}

            <div className="ml-auto flex gap-3">
              <button
                type="button"
                onClick={() => router.push('/admin/mission-slots')}
                disabled={isLoading}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Отменить
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? 'Сохранение…' : submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Диалог подтверждения (активные игроки) ──────────────────────── */}
      {showConfirmDialog && (
        <ConfirmDialog
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirm}
          isLoading={isLoading}
        />
      )}

      {/* ── Диалог удаления ──────────────────────────────────────────────── */}
      {showDeleteDialog && slot && (
        <DeleteSlotDialog
          slot={{ ...slot, completionsCount: slot.completionsCount }}
          onClose={() => setShowDeleteDialog(false)}
          onDeleted={() => router.push('/admin/mission-slots')}
        />
      )}
    </div>
  );
}

// ── Confirmation dialog ───────────────────────────────────────────────────────

interface ConfirmDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

function ConfirmDialog({
  onCancel,
  onConfirm,
  isLoading,
}: ConfirmDialogProps): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-200"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>

        <h2
          id="confirm-dialog-title"
          className="mb-2 text-base font-semibold text-gray-900 dark:text-white"
        >
          Вы уверены?
        </h2>

        <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
          Данная операция изменит процесс для активных игроков.
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            {isLoading ? 'Сохранение…' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  );
}
