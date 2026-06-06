'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { createHintSchema, updateHintSchema } from '@/lib/validations/admin-hints';
import type { CreateHintInput, UpdateHintInput } from '@/lib/validations/admin-hints';
import type { HintListItem } from '@/types/admin-hints';

interface CreateProps {
  mode: 'create';
  onClose: () => void;
  onSaved: () => void;
}

interface EditProps {
  mode: 'edit';
  hint: HintListItem;
  onClose: () => void;
  onSaved: () => void;
}

type HintFormProps = CreateProps | EditProps;

export function HintForm(props: HintFormProps): React.ReactElement {
  if (props.mode === 'create') {
    const { onClose, onSaved } = props;
    return <CreateForm mode="create" onClose={onClose} onSaved={onSaved} />;
  }

  const { hint, onClose, onSaved } = props;
  return <EditForm mode="edit" hint={hint} onClose={onClose} onSaved={onSaved} />;
}

// ── Create ────────────────────────────────────────────────────────────────────

function CreateForm({ onClose, onSaved }: CreateProps): React.ReactElement {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateHintInput>({
    resolver: zodResolver(createHintSchema),
    defaultValues: { text: '', orderIndex: 1, isActive: true },
  });

  async function onSubmit(values: CreateHintInput): Promise<void> {
    try {
      const response = await fetch('/api/admin/hints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        onSaved();
        return;
      }

      const data = (await response.json()) as { error?: string; message?: string };

      if (data.error === 'INDEX_TAKEN') {
        setError('orderIndex', {
          message: 'Подсказка с таким порядковым номером уже существует',
        });
      } else {
        setError('root', { message: data.message ?? 'Ошибка сервера' });
      }
    } catch {
      setError('root', { message: 'Не удалось выполнить запрос' });
    }
  }

  return (
    <FormLayout
      title="Создать подсказку"
      onClose={onClose}
      onSubmit={handleSubmit((v) => void onSubmit(v))}
      isSubmitting={isSubmitting}
      submitLabel="Создать"
      rootError={errors.root?.message}
    >
      <Field label="Текст подсказки" htmlFor="create-hint-text" error={errors.text?.message}>
        <textarea
          {...register('text')}
          id="create-hint-text"
          rows={5}
          placeholder="Введите текст подсказки Детектива…"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </Field>

      <Field label="Порядковый номер" htmlFor="create-hint-order" error={errors.orderIndex?.message}>
        <input
          {...register('orderIndex', { valueAsNumber: true })}
          id="create-hint-order"
          type="number"
          min={1}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </Field>

      <CheckboxField label="Активна" {...register('isActive')} />
    </FormLayout>
  );
}

// ── Edit ──────────────────────────────────────────────────────────────────────

function EditForm({ hint, onClose, onSaved }: EditProps): React.ReactElement {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateHintInput>({
    resolver: zodResolver(updateHintSchema),
    defaultValues: { text: hint.text, isActive: hint.isActive },
  });

  useEffect(() => {
    reset({ text: hint.text, isActive: hint.isActive });
  }, [hint, reset]);

  async function onSubmit(values: UpdateHintInput): Promise<void> {
    try {
      const response = await fetch(`/api/admin/hints/${hint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        onSaved();
        return;
      }

      const data = (await response.json()) as { error?: string; message?: string };
      setError('root', { message: data.message ?? 'Ошибка сервера' });
    } catch {
      setError('root', { message: 'Не удалось выполнить запрос' });
    }
  }

  return (
    <FormLayout
      title="Редактировать подсказку"
      onClose={onClose}
      onSubmit={handleSubmit((v) => void onSubmit(v))}
      isSubmitting={isSubmitting}
      submitLabel="Сохранить"
      rootError={errors.root?.message}
    >
      <Field label="Порядковый номер" htmlFor="edit-hint-order">
        <input
          id="edit-hint-order"
          value={hint.orderIndex}
          disabled
          className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400"
        />
      </Field>

      <Field label="Текст подсказки" htmlFor="edit-hint-text" error={errors.text?.message}>
        <textarea
          {...register('text')}
          id="edit-hint-text"
          rows={5}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </Field>

      <CheckboxField label="Активна" {...register('isActive')} />
    </FormLayout>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

interface FormLayoutProps {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  submitLabel: string;
  rootError?: string;
  children: React.ReactNode;
}

function FormLayout({
  title,
  onClose,
  onSubmit,
  isSubmitting,
  submitLabel,
  rootError,
  children,
}: FormLayoutProps): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {children}

          {rootError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {rootError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Сохранение…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, error, children }: FieldProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-gray-600 dark:text-gray-400"
      >
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

interface CheckboxFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const CheckboxField = ({ label, ...rest }: CheckboxFieldProps): React.ReactElement => (
  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      {...rest}
    />
    {label}
  </label>
);
