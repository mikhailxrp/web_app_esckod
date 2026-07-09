'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isFinalChoiceQuestion } from '@/lib/final-report/isFinalChoiceQuestion';
import { REPORT_FINAL_CHOICES } from '@/constants/reportFinalChoices';
import type { QuestionListItem } from '@/types/admin-report';

const OPTION_LABELS = ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4'] as const;

const questionFormSchema = z
  .object({
    isFinalQuestion: z.boolean(),
    questionText: z.string().trim().min(1, 'Текст вопроса обязателен'),
    option1: z.string(),
    option2: z.string(),
    option3: z.string(),
    option4: z.string(),
    correctOption: z.coerce.number().int().min(0).max(3),
  })
  .superRefine((data, ctx) => {
    if (data.isFinalQuestion) {
      return;
    }

    const options = [data.option1, data.option2, data.option3, data.option4]
      .map((option) => option.trim())
      .filter(Boolean);

    if (options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Нужно минимум 2 варианта ответа',
        path: ['option1'],
      });
    }

    if (data.correctOption < 0 || data.correctOption >= options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Выберите верный ответ из заполненных вариантов',
        path: ['correctOption'],
      });
    }
  });

type QuestionFormValues = z.infer<typeof questionFormSchema>;

function formValuesToPayload(values: QuestionFormValues): {
  questionText: string;
  options: string[];
  correctOption: number;
} {
  if (values.isFinalQuestion) {
    return {
      questionText: values.questionText.trim(),
      options: REPORT_FINAL_CHOICES.map((c) => c.label),
      correctOption: 0,
    };
  }

  const rawOptions = [values.option1, values.option2, values.option3, values.option4];
  // Сохраняем оригинальные индексы перед фильтрацией, чтобы правильно
  // перемапить correctOption после удаления пустых вариантов.
  const indexed = rawOptions.map((opt, i) => ({ text: opt.trim(), formIndex: i }));
  const nonEmpty = indexed.filter(({ text }) => text.length > 0);
  const options = nonEmpty.map(({ text }) => text);
  const correctOption = nonEmpty.findIndex(({ formIndex }) => formIndex === values.correctOption);

  return {
    questionText: values.questionText.trim(),
    options,
    correctOption: correctOption >= 0 ? correctOption : 0,
  };
}

function questionToDefaultValues(question: QuestionListItem): QuestionFormValues {
  const isFinal = isFinalChoiceQuestion(question.options);
  return {
    isFinalQuestion: isFinal,
    questionText: question.questionText,
    option1: isFinal ? '' : (question.options[0] ?? ''),
    option2: isFinal ? '' : (question.options[1] ?? ''),
    option3: isFinal ? '' : (question.options[2] ?? ''),
    option4: isFinal ? '' : (question.options[3] ?? ''),
    correctOption: question.correctOption,
  };
}

const INPUT_CLASS =
  'w-full rounded-lg bg-admin-input-bg text-admin-input-text text-sm px-3 py-2.5 border border-transparent focus:outline-none focus:border-admin-accent placeholder:text-admin-placeholder transition-colors';

const INPUT_ERROR_CLASS = 'border-red-400';

interface CreateProps {
  mode: 'create';
  nextOrderIndex: number;
  onCancel: () => void;
  onSaved: () => void;
}

interface EditProps {
  mode: 'edit';
  question: QuestionListItem;
  onSaved: () => void;
  onDeleted: () => void;
}

type QuestionFormProps = CreateProps | EditProps;

export function QuestionForm(props: QuestionFormProps): React.ReactElement {
  if (props.mode === 'create') {
    return <CreateQuestionForm {...props} />;
  }

  return <EditQuestionForm {...props} />;
}

function CreateQuestionForm({
  nextOrderIndex,
  onCancel,
  onSaved,
}: CreateProps): React.ReactElement {
  const {
    register,
    handleSubmit,
    setError,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      isFinalQuestion: false,
      questionText: '',
      option1: '',
      option2: '',
      option3: '',
      option4: '',
      correctOption: 0,
    },
  });

  const isFinalQuestion = useWatch({ control, name: 'isFinalQuestion' });

  function handleFinalToggle(value: boolean): void {
    setValue('isFinalQuestion', value);
    if (value) {
      setValue('option1', '');
      setValue('option2', '');
      setValue('option3', '');
      setValue('option4', '');
      setValue('correctOption', 0);
    }
  }

  async function onSubmit(values: QuestionFormValues): Promise<void> {
    const payload = formValuesToPayload(values);

    try {
      const response = await fetch('/api/admin/report/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          orderIndex: nextOrderIndex,
        }),
      });

      if (response.ok) {
        onSaved();
        return;
      }

      const data = (await response.json()) as { error?: string; message?: string };

      if (data.error === 'INDEX_TAKEN') {
        setError('root', {
          message: 'Вопрос с таким порядковым номером уже существует',
        });
      } else {
        setError('root', { message: data.message ?? 'Ошибка сервера' });
      }
    } catch {
      setError('root', { message: 'Не удалось выполнить запрос' });
    }
  }

  return (
    <FormCard
      onSubmit={handleSubmit((values) => void onSubmit(values))}
      isSubmitting={isSubmitting}
      rootError={errors.root?.message}
      footer={
        <div className="flex justify-end gap-3">
          <OutlineButton type="button" onClick={onCancel} disabled={isSubmitting}>
            Отменить
          </OutlineButton>
          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Сохранение…' : 'Сохранить'}
          </PrimaryButton>
        </div>
      }
    >
      <QuestionFields
        register={register}
        errors={errors}
        isFinalQuestion={isFinalQuestion}
        onFinalToggle={handleFinalToggle}
      />
    </FormCard>
  );
}

function EditQuestionForm({
  question,
  onSaved,
  onDeleted,
}: EditProps): React.ReactElement {
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: questionToDefaultValues(question),
  });

  const isFinalQuestion = useWatch({ control, name: 'isFinalQuestion' });

  useEffect(() => {
    reset(questionToDefaultValues(question));
  }, [question, reset]);

  function handleFinalToggle(value: boolean): void {
    setValue('isFinalQuestion', value);
    if (value) {
      setValue('option1', '');
      setValue('option2', '');
      setValue('option3', '');
      setValue('option4', '');
      setValue('correctOption', 0);
    }
  }

  async function onSubmit(values: QuestionFormValues): Promise<void> {
    const payload = formValuesToPayload(values);

    try {
      const response = await fetch(`/api/admin/report/questions/${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onSaved();
        return;
      }

      const data = (await response.json()) as { message?: string };
      setError('root', { message: data.message ?? 'Ошибка сервера' });
    } catch {
      setError('root', { message: 'Не удалось выполнить запрос' });
    }
  }

  async function handleDelete(): Promise<void> {
    if (isFinalQuestion) return;

    if (!window.confirm('Удалить этот вопрос?')) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/report/questions/${question.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onDeleted();
        return;
      }

      const data = (await response.json()) as { message?: string };
      setError('root', { message: data.message ?? 'Не удалось удалить вопрос' });
    } catch {
      setError('root', { message: 'Не удалось выполнить запрос' });
    } finally {
      setIsDeleting(false);
    }
  }

  const busy = isSubmitting || isDeleting;

  return (
    <FormCard
      onSubmit={handleSubmit((values) => void onSubmit(values))}
      isSubmitting={busy}
      rootError={errors.root?.message}
      footer={
        <div className="flex items-center justify-between gap-4">
          {isFinalQuestion ? (
            <p className="text-sm text-semantic-error">Финальный вопрос нельзя удалить</p>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <OutlineButton type="submit" disabled={busy}>
              {isSubmitting ? 'Сохранение…' : 'Сохранить'}
            </OutlineButton>
            {!isFinalQuestion && (
              <DangerButton type="button" onClick={() => void handleDelete()} disabled={busy}>
                {isDeleting ? 'Удаление…' : 'Удалить'}
              </DangerButton>
            )}
          </div>
        </div>
      }
    >
      <QuestionFields
        register={register}
        errors={errors}
        isFinalQuestion={isFinalQuestion}
        onFinalToggle={handleFinalToggle}
      />
    </FormCard>
  );
}

interface FormCardProps {
  onSubmit: (event: React.FormEvent) => void;
  isSubmitting: boolean;
  rootError?: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}

function FormCard({
  onSubmit,
  isSubmitting,
  rootError,
  footer,
  children,
}: FormCardProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-admin-card-border bg-white shadow-admin-card p-6 md:p-8">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {children}

        {rootError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {rootError}
          </p>
        )}

        <div className="pt-2">{footer}</div>
      </form>
    </div>
  );
}

interface QuestionFieldsProps {
  register: ReturnType<typeof useForm<QuestionFormValues>>['register'];
  errors: ReturnType<typeof useForm<QuestionFormValues>>['formState']['errors'];
  isFinalQuestion: boolean;
  onFinalToggle: (value: boolean) => void;
}

const RADIO_CLASS =
  'h-4 w-4 cursor-pointer accent-admin-accent';

const FIXED_OPTION_CLASS =
  'rounded-lg border border-admin-card-border bg-admin-input-bg px-3 py-2.5 text-sm text-admin-placeholder select-none';

function QuestionFields({
  register,
  errors,
  isFinalQuestion,
  onFinalToggle,
}: QuestionFieldsProps): React.ReactElement {
  const optionFields = [
    { name: 'option1' as const, label: 'Вариант 1', id: 'question-option-1' },
    { name: 'option2' as const, label: 'Вариант 2', id: 'question-option-2' },
    { name: 'option3' as const, label: 'Вариант 3', id: 'question-option-3' },
    { name: 'option4' as const, label: 'Вариант 4', id: 'question-option-4' },
  ];

  return (
    <>
      <div>
        <p className="mb-2 block text-sm text-admin-label">Тип вопроса</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              className={RADIO_CLASS}
              checked={!isFinalQuestion}
              onChange={() => onFinalToggle(false)}
            />
            <span className="text-sm text-admin-input-text">Обычный</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              className={RADIO_CLASS}
              checked={isFinalQuestion}
              onChange={() => onFinalToggle(true)}
            />
            <span className="text-sm text-admin-input-text">
              Финальный{' '}
              <span className="text-admin-label">
                ({REPORT_FINAL_CHOICES.map((c) => c.label).join(' / ')})
              </span>
            </span>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="question-text" className="mb-1 block text-sm text-admin-label">
          Вопрос
        </label>
        <textarea
          {...register('questionText')}
          id="question-text"
          rows={4}
          placeholder=""
          className={[INPUT_CLASS, errors.questionText ? INPUT_ERROR_CLASS : ''].join(' ')}
        />
        {errors.questionText && (
          <p className="mt-1 text-xs text-red-500">{errors.questionText.message}</p>
        )}
      </div>

      {isFinalQuestion ? (
        <div>
          <p className="mb-2 block text-sm text-admin-label">Варианты ответа</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {REPORT_FINAL_CHOICES.map((choice) => (
              <div key={choice.value} className={FIXED_OPTION_CLASS}>
                {choice.label}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-admin-placeholder">
            Варианты фиксированы для финального вопроса
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {optionFields.map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} className="mb-1 block text-sm text-admin-label">
                  {field.label}
                </label>
                <input
                  {...register(field.name)}
                  id={field.id}
                  type="text"
                  placeholder="Пример"
                  className={[
                    INPUT_CLASS,
                    errors[field.name] ? INPUT_ERROR_CLASS : '',
                  ].join(' ')}
                />
                {errors[field.name] && (
                  <p className="mt-1 text-xs text-red-500">{errors[field.name]?.message}</p>
                )}
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="question-correct" className="mb-1 block text-sm text-admin-label">
              Верный ответ
            </label>
            <div className="relative">
              <select
                {...register('correctOption')}
                id="question-correct"
                className={[
                  INPUT_CLASS,
                  'appearance-none pr-10',
                  errors.correctOption ? INPUT_ERROR_CLASS : '',
                ].join(' ')}
              >
                {OPTION_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
              <span
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-admin-label"
                aria-hidden="true"
              >
                ▾
              </span>
            </div>
            {errors.correctOption && (
              <p className="mt-1 text-xs text-red-500">{errors.correctOption.message}</p>
            )}
            {errors.option1 && !errors.correctOption && (
              <p className="mt-1 text-xs text-red-500">{errors.option1.message}</p>
            )}
          </div>
        </>
      )}
    </>
  );
}

interface ButtonProps {
  type: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function OutlineButton({ type, onClick, disabled, children }: ButtonProps): React.ReactElement {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-admin-accent px-5 py-2 text-sm font-medium text-admin-accent transition-colors hover:bg-admin-accent-muted disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function PrimaryButton({ type, onClick, disabled, children }: ButtonProps): React.ReactElement {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-admin-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function DangerButton({ type, onClick, disabled, children }: ButtonProps): React.ReactElement {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-semantic-error px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
