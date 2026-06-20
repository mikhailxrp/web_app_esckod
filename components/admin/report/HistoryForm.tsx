'use client';

import { useRef, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bold, Check, RefreshCw, Info } from 'lucide-react';
import { REPORT_FINAL_CHOICES } from '@/constants/reportFinalChoices';
import { isFinalChoiceQuestion } from '@/lib/final-report/isFinalChoiceQuestion';
import type { HistoryData, QuestionListItem } from '@/types/admin-report';

const formSchema = z.object({
  finalReportQuestionId: z.string().nullable(),
  contents: z.array(
    z.object({
      finalChoiceValue: z.string(),
      title: z.string().trim().min(1, 'Заголовок обязателен'),
      bodyText: z.string().trim().min(1, 'Текст обязателен'),
    }),
  ),
});

type FormValues = z.infer<typeof formSchema>;

interface HistoryFormProps {
  initialData: HistoryData;
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

const inputBase =
  'w-full px-4 py-2.5 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border focus:outline-none placeholder:text-admin-placeholder transition-colors';

const textareaBase =
  'w-full px-4 py-3 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent focus:outline-none focus:border-admin-accent placeholder:text-admin-placeholder transition-colors resize-none';

interface BoldTextareaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hasError?: boolean;
}

function BoldTextarea({
  id,
  value,
  onChange,
  rows = 6,
  placeholder,
  hasError,
}: BoldTextareaProps): React.ReactElement {
  const ref = useRef<HTMLTextAreaElement>(null);

  function applyBold(): void {
    const el = ref.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newValue = `${value.slice(0, start)}**${value.slice(start, end)}**${value.slice(end)}`;

    onChange(newValue);

    requestAnimationFrame(() => {
      el.focus();
      if (start === end) {
        el.setSelectionRange(start + 2, start + 2);
      } else {
        el.setSelectionRange(start + 2, end + 2);
      }
    });
  }

  return (
    <div>
      <div className="mb-1.5 flex gap-1">
        <button
          type="button"
          onClick={applyBold}
          title="Жирный текст (**текст**)"
          className="inline-flex items-center gap-1 rounded border border-admin-card-border bg-white px-2 py-0.5 text-xs text-admin-input-text transition-colors hover:bg-admin-input-bg"
        >
          <Bold size={11} strokeWidth={2.5} />
          <span className="font-semibold">Ж</span>
        </button>
      </div>
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={[
          textareaBase,
          hasError ? 'border-red-400' : '',
        ].join(' ')}
      />
    </div>
  );
}

function buildDefaultValues(data: HistoryData): FormValues {
  const contentsMap = new Map(
    data.contents.map((c) => [c.finalChoiceValue, c]),
  );

  return {
    finalReportQuestionId: data.finalReportQuestionId,
    contents: REPORT_FINAL_CHOICES.map((choice) => {
      const existing = contentsMap.get(choice.value);
      return {
        finalChoiceValue: choice.value,
        title: existing?.title ?? '',
        bodyText: existing?.bodyText ?? '',
      };
    }),
  };
}

export function HistoryForm({ initialData }: HistoryFormProps): React.ReactElement {
  const [data, setData] = useState<HistoryData>(initialData);
  const [toast, setToast] = useState<ToastState>(null);

  const finalQuestionOptions = data.questions.filter((q) =>
    isFinalChoiceQuestion(q.options),
  );

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildDefaultValues(data),
  });

  const selectedQuestionId = useWatch({ control, name: 'finalReportQuestionId' });

  const selectedQuestion = data.questions.find((q) => q.id === selectedQuestionId);

  const showToast = (type: 'success' | 'error', message: string): void => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const onSubmit = async (values: FormValues): Promise<void> => {
    try {
      const res = await fetch('/api/admin/report/history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalReportQuestionId: values.finalReportQuestionId || null,
          contents: values.contents,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        showToast(
          'error',
          (json as { message?: string }).message ??
            'Не удалось сохранить. Попробуйте ещё раз.',
        );
        return;
      }

      const updated = json as HistoryData;
      setData(updated);
      reset(buildDefaultValues(updated));
      showToast('success', 'История сохранена.');
      window.dispatchEvent(new CustomEvent('report-config-saved'));
    } catch {
      showToast('error', 'Не удалось сохранить. Попробуйте ещё раз.');
    }
  };

  const handleReset = (): void => {
    reset(buildDefaultValues(data));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-8 max-w-4xl">
        <h2 className="text-base font-semibold text-admin-input-text mb-6">
          Управление историей
        </h2>

        {/* Финальный вопрос */}
        <div className="grid grid-cols-[200px_1fr] items-start gap-4 mb-5">
          <label className="text-sm text-admin-label pt-2.5">
            Финальный вопрос
          </label>
          <div>
            {finalQuestionOptions.length === 0 ? (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <Info size={14} className="shrink-0 mt-0.5" />
                <span>
                  Нет вопросов с вариантами «Обвинить» и «Защитить». Создайте
                  такой вопрос в разделе{' '}
                  <a
                    href="/admin/report"
                    className="underline hover:no-underline"
                  >
                    Вопросы
                  </a>
                  .
                </span>
              </div>
            ) : (
              <select
                {...register('finalReportQuestionId')}
                className={[
                  inputBase,
                  'cursor-pointer appearance-none',
                  'border-transparent focus:border-admin-accent',
                ].join(' ')}
              >
                <option value="">— не выбран —</option>
                {finalQuestionOptions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {`Вопрос ${q.orderIndex}: ${q.questionText}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Метки вариантов выбранного вопроса */}
        {selectedQuestion && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {REPORT_FINAL_CHOICES.map((choice, i) => (
              <div key={choice.value} className="grid grid-cols-[100px_1fr] items-center gap-3">
                <label className="text-sm text-admin-label">
                  Вариант {i + 1}
                </label>
                <div className="px-4 py-2.5 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent">
                  {selectedQuestion.options[i] ?? choice.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Блоки концовок */}
        {REPORT_FINAL_CHOICES.map((choice, index) => (
          <div
            key={choice.value}
            className="border border-admin-card-border rounded-xl p-6 mb-4 last:mb-0"
          >
            <h3 className="text-sm font-semibold text-admin-input-text mb-4">
              {choice.label} ({choice.value})
            </h3>

            <div className="mb-4">
              <label className="text-sm text-admin-label block mb-1.5">
                Заголовок
              </label>
              <input
                type="text"
                {...register(`contents.${index}.title`)}
                className={[
                  inputBase,
                  errors.contents?.[index]?.title
                    ? 'border-red-400'
                    : 'border-transparent focus:border-admin-accent',
                ].join(' ')}
                placeholder={`Заголовок для «${choice.label}»`}
              />
              {errors.contents?.[index]?.title && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.contents[index].title.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={`history-body-${choice.value}`}
                className="text-sm text-admin-label block mb-1.5"
              >
                Текст истории {index + 1}
              </label>
              <Controller
                control={control}
                name={`contents.${index}.bodyText`}
                render={({ field }) => (
                  <BoldTextarea
                    id={`history-body-${choice.value}`}
                    value={field.value}
                    onChange={field.onChange}
                    rows={6}
                    placeholder={`Текст концовки для варианта «${choice.label}»`}
                    hasError={!!errors.contents?.[index]?.bodyText}
                  />
                )}
              />
              {errors.contents?.[index]?.bodyText && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.contents[index].bodyText.message}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={[
            'flex items-center gap-2 mt-4 max-w-4xl px-4 py-3 rounded-xl text-sm',
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
  );
}
