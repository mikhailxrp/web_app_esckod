'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { createTransitionSchema } from '@/lib/validations/admin-chats';
import type { CreateTransitionInput } from '@/lib/validations/admin-chats';
import type {
  ChatScriptListItem,
  ChatTransitionListItem,
  ChatType,
  ConditionType,
  TriggerValueOption,
} from '@/types/admin-chats';

interface CreateProps {
  mode: 'create';
  scripts: ChatScriptListItem[];
  triggerValues: TriggerValueOption[];
  onClose: () => void;
  onSaved: () => void;
}

interface EditProps {
  mode: 'edit';
  transition: ChatTransitionListItem;
  scripts: ChatScriptListItem[];
  triggerValues: TriggerValueOption[];
  onClose: () => void;
  onSaved: () => void;
}

type ChatTransitionFormProps = CreateProps | EditProps;

const CONDITION_TYPE_OPTIONS: { value: ConditionType; label: string }[] = [
  { value: 'ALWAYS', label: 'ALWAYS — всегда' },
  { value: 'CHOICE', label: 'CHOICE — выбор игрока' },
  { value: 'TRIGGER', label: 'TRIGGER — событие' },
];

const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  DETECTIVE: 'Детектив',
  MARINA: 'Марина',
};

const SERVER_ERROR_MESSAGES: Record<string, string> = {
  INVALID_TRIGGER_VALUE: 'Недопустимое значение триггера',
  INVALID_REFERENCE: 'Реплика «откуда» или «куда» не найдена',
  VALIDATION_ERROR: 'Проверьте поля формы',
};

export function ChatTransitionForm(props: ChatTransitionFormProps): React.ReactElement {
  if (props.mode === 'create') {
    return <CreateForm {...props} />;
  }

  return <EditForm {...props} />;
}

function scriptOptionLabel(script: ChatScriptListItem): string {
  return `${script.code} (${CHAT_TYPE_LABELS[script.chatType]})`;
}

function buildEditDefaultValues(transition: ChatTransitionListItem): CreateTransitionInput {
  const base = {
    fromMessageId: transition.fromMessageId,
    toMessageId: transition.toMessageId,
    priority: transition.priority,
  };

  if (transition.conditionType === 'ALWAYS') {
    return { ...base, conditionType: 'ALWAYS', conditionValue: null };
  }

  if (transition.conditionType === 'CHOICE') {
    return {
      ...base,
      conditionType: 'CHOICE',
      conditionValue: transition.conditionValue ?? '',
    };
  }

  return {
    ...base,
    conditionType: 'TRIGGER',
    conditionValue: transition.conditionValue ?? '',
  };
}

function CreateForm({
  scripts,
  triggerValues,
  onClose,
  onSaved,
}: CreateProps): React.ReactElement {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateTransitionInput>({
    resolver: zodResolver(createTransitionSchema),
    defaultValues: {
      fromMessageId: '',
      toMessageId: '',
      conditionType: 'ALWAYS',
      conditionValue: null,
      priority: 0,
    },
  });

  const conditionType = watch('conditionType');
  const fromMessageId = watch('fromMessageId');
  const conditionValue = watch('conditionValue');

  const fromScript = useMemo(
    () => scripts.find((s) => s.id === fromMessageId),
    [scripts, fromMessageId],
  );

  const choiceWarning = useChoiceWarning(fromScript, conditionType, conditionValue);

  useEffect(() => {
    if (conditionType === 'ALWAYS') {
      setValue('conditionValue', null);
    }
  }, [conditionType, setValue]);

  async function onSubmit(values: CreateTransitionInput): Promise<void> {
    const body =
      values.conditionType === 'ALWAYS'
        ? { ...values, conditionValue: null }
        : values;

    try {
      const response = await fetch('/api/admin/chats/transitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        onSaved();

        return;
      }

      const data = (await response.json()) as { error?: string; message?: string };
      setError('root', {
        message:
          SERVER_ERROR_MESSAGES[data.error ?? ''] ??
          data.message ??
          'Ошибка сервера',
      });
    } catch {
      setError('root', { message: 'Не удалось выполнить запрос' });
    }
  }

  return (
    <TransitionFormLayout
      title="Создать переход"
      onClose={onClose}
      onSubmit={handleSubmit((v) => void onSubmit(v))}
      isSubmitting={isSubmitting}
      rootError={errors.root?.message}
      choiceWarning={choiceWarning}
    >
      <TransitionFields
        register={register}
        errors={errors}
        scripts={scripts}
        triggerValues={triggerValues}
        conditionType={conditionType}
        fromScript={fromScript}
      />
    </TransitionFormLayout>
  );
}

function EditForm({
  transition,
  scripts,
  triggerValues,
  onClose,
  onSaved,
}: EditProps): React.ReactElement {
  const defaultValues = buildEditDefaultValues(transition);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateTransitionInput>({
    resolver: zodResolver(createTransitionSchema),
    defaultValues,
  });

  const conditionType = watch('conditionType');
  const fromMessageId = watch('fromMessageId');
  const conditionValue = watch('conditionValue');

  const fromScript = useMemo(
    () => scripts.find((s) => s.id === fromMessageId),
    [scripts, fromMessageId],
  );

  const choiceWarning = useChoiceWarning(fromScript, conditionType, conditionValue);

  useEffect(() => {
    if (conditionType === 'ALWAYS') {
      setValue('conditionValue', null);
    }
  }, [conditionType, setValue]);

  async function onSubmit(values: CreateTransitionInput): Promise<void> {
    const body =
      values.conditionType === 'ALWAYS'
        ? { ...values, conditionValue: null }
        : values;

    try {
      const response = await fetch(`/api/admin/chats/transitions/${transition.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        onSaved();

        return;
      }

      const data = (await response.json()) as { error?: string; message?: string };
      setError('root', {
        message:
          SERVER_ERROR_MESSAGES[data.error ?? ''] ??
          data.message ??
          'Ошибка сервера',
      });
    } catch {
      setError('root', { message: 'Не удалось выполнить запрос' });
    }
  }

  return (
    <TransitionFormLayout
      title="Редактировать переход"
      onClose={onClose}
      onSubmit={handleSubmit((v) => void onSubmit(v))}
      isSubmitting={isSubmitting}
      rootError={errors.root?.message}
      choiceWarning={choiceWarning}
    >
      <TransitionFields
        register={register}
        errors={errors}
        scripts={scripts}
        triggerValues={triggerValues}
        conditionType={conditionType}
        fromScript={fromScript}
      />
    </TransitionFormLayout>
  );
}

function useChoiceWarning(
  fromScript: ChatScriptListItem | undefined,
  conditionType: ConditionType,
  conditionValue: string | null | undefined,
): string | null {
  return useMemo(() => {
    if (conditionType !== 'CHOICE' || !fromScript || !conditionValue) {
      return null;
    }

    if (!fromScript.hasChoices || !fromScript.choices?.length) {
      return 'У реплики-источника нет вариантов выбора (hasChoices=false).';
    }

    const known = fromScript.choices.some((c) => c.value === conditionValue);

    if (!known) {
      return 'Значение не совпадает ни с одним value из choices реплики-источника (сервер не блокирует).';
    }

    return null;
  }, [fromScript, conditionType, conditionValue]);
}

interface TransitionFieldsProps {
  register: ReturnType<typeof useForm<CreateTransitionInput>>['register'];
  errors: ReturnType<typeof useForm<CreateTransitionInput>>['formState']['errors'];
  scripts: ChatScriptListItem[];
  triggerValues: TriggerValueOption[];
  conditionType: ConditionType;
  fromScript: ChatScriptListItem | undefined;
}

function TransitionFields({
  register,
  errors,
  scripts,
  triggerValues,
  conditionType,
  fromScript,
}: TransitionFieldsProps): React.ReactElement {
  return (
    <>
      <Field label="Откуда (from)" error={errors.fromMessageId?.message}>
        <select
          {...register('fromMessageId')}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <option value="">— выберите реплику —</option>
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>
              {scriptOptionLabel(s)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Куда (to)" error={errors.toMessageId?.message}>
        <select
          {...register('toMessageId')}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <option value="">— выберите реплику —</option>
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>
              {scriptOptionLabel(s)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Тип условия" error={errors.conditionType?.message}>
        <select
          {...register('conditionType')}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          {CONDITION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      {conditionType === 'CHOICE' && (
        <Field label="Значение выбора (conditionValue)" error={errors.conditionValue?.message}>
          {fromScript?.hasChoices && fromScript.choices?.length ? (
            <select
              {...register('conditionValue')}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">— выберите value —</option>
              {fromScript.choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} ({c.value})
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              У выбранной реплики-источника нет choices. Сначала добавьте варианты в реплику
              или выберите другую.
            </p>
          )}
        </Field>
      )}

      {conditionType === 'TRIGGER' && (
        <Field label="Событие (conditionValue)" error={errors.conditionValue?.message}>
          <select
            {...register('conditionValue')}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="">— выберите триггер —</option>
            {triggerValues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Приоритет (priority)" error={errors.priority?.message}>
        <input
          type="number"
          {...register('priority', { valueAsNumber: true })}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </Field>
    </>
  );
}

interface TransitionFormLayoutProps {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  rootError?: string;
  choiceWarning: string | null;
  children: React.ReactNode;
}

function TransitionFormLayout({
  title,
  onClose,
  onSubmit,
  isSubmitting,
  rootError,
  choiceWarning,
  children,
}: TransitionFormLayoutProps): React.ReactElement {
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

          {choiceWarning && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {choiceWarning}
            </p>
          )}

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
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
