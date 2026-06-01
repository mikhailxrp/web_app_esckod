'use client';

import { useEffect } from 'react';
import {
  useForm,
  useFieldArray,
  type UseFormRegisterReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, X } from 'lucide-react';
import { createScriptSchema, updateScriptSchema } from '@/lib/validations/admin-chats';
import type { CreateScriptInput, UpdateScriptInput } from '@/lib/validations/admin-chats';
import type { ChatScriptListItem, ChatType } from '@/types/admin-chats';

interface CreateProps {
  mode: 'create';
  onClose: () => void;
  onSaved: () => void;
}

interface EditProps {
  mode: 'edit';
  script: ChatScriptListItem;
  onClose: () => void;
  onSaved: () => void;
}

type ChatScriptFormProps = CreateProps | EditProps;

const CHAT_TYPE_OPTIONS: { value: ChatType; label: string }[] = [
  { value: 'DETECTIVE', label: 'Детектив' },
  { value: 'MARINA', label: 'Марина' },
];

export function ChatScriptForm(props: ChatScriptFormProps): React.ReactElement {
  if (props.mode === 'create') {
    return <CreateForm {...props} />;
  }

  return <EditForm {...props} />;
}

// ── Create ───────────────────────────────────────────────────────────────────

function CreateForm({ onClose, onSaved }: CreateProps): React.ReactElement {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateScriptInput>({
    resolver: zodResolver(createScriptSchema),
    defaultValues: {
      chatType: 'DETECTIVE',
      code: '',
      text: '',
      hasChoices: false,
      isStart: false,
      isEnd: false,
      choices: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'choices' });
  const hasChoices = watch('hasChoices');

  async function onSubmit(values: CreateScriptInput): Promise<void> {
    try {
      const response = await fetch('/api/admin/chats/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        onSaved();

        return;
      }

      const data = (await response.json()) as { error?: string; message?: string };

      if (data.error === 'CODE_EXISTS') {
        setError('code', { message: 'Реплика с таким кодом уже существует' });
      } else {
        setError('root', { message: data.message ?? 'Ошибка сервера' });
      }
    } catch {
      setError('root', { message: 'Не удалось выполнить запрос' });
    }
  }

  return (
    <FormLayout
      title="Создать реплику"
      onClose={onClose}
      onSubmit={handleSubmit((v) => void onSubmit(v))}
      isSubmitting={isSubmitting}
      submitLabel="Создать"
      rootError={errors.root?.message}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Тип чата" error={errors.chatType?.message}>
          <select
            {...register('chatType')}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            {CHAT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Код (машинное имя)" error={errors.code?.message}>
          <input
            {...register('code')}
            type="text"
            placeholder="detective_greeting"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </Field>
      </div>

      <Field label="Текст реплики" error={errors.text?.message}>
        <textarea
          {...register('text')}
          rows={4}
          placeholder="Текст сообщения персонажа..."
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </Field>

      <div className="flex flex-wrap gap-6">
        <CheckboxField label="Начальная реплика (isStart)" {...register('isStart')} />
        <CheckboxField label="Конечная реплика (isEnd)" {...register('isEnd')} />
        <CheckboxField label="Есть выбор (hasChoices)" {...register('hasChoices')} />
      </div>

      {hasChoices && (
        <ChoicesEditor
          fields={fields}
          onAppend={() => append({ label: '', value: '' })}
          onRemove={remove}
          registerChoice={(index, field) =>
            register(`choices.${index}.${field}` as `choices.${number}.label`)
          }
          choicesError={errors.choices?.message ?? (errors.choices as { root?: { message?: string } })?.root?.message}
        />
      )}
    </FormLayout>
  );
}

// ── Edit ─────────────────────────────────────────────────────────────────────

function EditForm({ script, onClose, onSaved }: EditProps): React.ReactElement {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateScriptInput>({
    resolver: zodResolver(updateScriptSchema),
    defaultValues: {
      text: script.text,
      hasChoices: script.hasChoices,
      isStart: script.isStart,
      isEnd: script.isEnd,
      choices: script.choices ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'choices' });
  const hasChoices = watch('hasChoices');

  useEffect(() => {
    reset({
      text: script.text,
      hasChoices: script.hasChoices,
      isStart: script.isStart,
      isEnd: script.isEnd,
      choices: script.choices ?? [],
    });
  }, [script, reset]);

  async function onSubmit(values: UpdateScriptInput): Promise<void> {
    try {
      const response = await fetch(`/api/admin/chats/scripts/${script.id}`, {
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
      title="Редактировать реплику"
      onClose={onClose}
      onSubmit={handleSubmit((v) => void onSubmit(v))}
      isSubmitting={isSubmitting}
      submitLabel="Сохранить"
      rootError={errors.root?.message}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Тип чата">
          <input
            value={script.chatType === 'DETECTIVE' ? 'Детектив' : 'Марина'}
            disabled
            className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400"
          />
        </Field>

        <Field label="Код (машинное имя)">
          <input
            value={script.code}
            disabled
            className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400"
          />
        </Field>
      </div>

      <Field label="Текст реплики" error={errors.text?.message}>
        <textarea
          {...register('text')}
          rows={4}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </Field>

      <div className="flex flex-wrap gap-6">
        <CheckboxField label="Начальная реплика (isStart)" {...register('isStart')} />
        <CheckboxField label="Конечная реплика (isEnd)" {...register('isEnd')} />
        <CheckboxField label="Есть выбор (hasChoices)" {...register('hasChoices')} />
      </div>

      {hasChoices && (
        <ChoicesEditor
          fields={fields}
          onAppend={() => append({ label: '', value: '' })}
          onRemove={remove}
          registerChoice={(index, field) =>
            register(`choices.${index}.${field}` as `choices.${number}.label`)
          }
          choicesError={errors.choices?.message ?? (errors.choices as { root?: { message?: string } })?.root?.message}
        />
      )}
    </FormLayout>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

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
  error?: string;
  children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
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

interface ChoicesEditorProps {
  fields: { id: string }[];
  onAppend: () => void;
  onRemove: (index: number) => void;
  registerChoice: (index: number, field: 'label' | 'value') => UseFormRegisterReturn;
  choicesError?: string;
}

function ChoicesEditor({
  fields,
  onAppend,
  onRemove,
  registerChoice,
  choicesError,
}: ChoicesEditorProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Варианты выбора
        </span>
        <button
          type="button"
          onClick={onAppend}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={12} />
          Добавить
        </button>
      </div>

      {fields.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Нет вариантов. Добавьте хотя бы один.
        </p>
      )}

      {fields.map((field, index) => (
        <div key={field.id} className="flex items-start gap-2">
          <div className="flex flex-1 gap-2">
            <input
              {...registerChoice(index, 'label')}
              placeholder="Метка (для отображения)"
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <input
              {...registerChoice(index, 'value')}
              placeholder="Значение (машинное)"
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-mono text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="mt-1 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
            aria-label="Удалить вариант"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {choicesError && (
        <p className="text-xs text-red-600 dark:text-red-400">{choicesError}</p>
      )}
    </div>
  );
}
