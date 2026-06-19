'use client';

import { useCallback, useState } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { isFinalChoiceQuestion } from '@/lib/final-report/isFinalChoiceQuestion';
import type { QuestionListItem } from '@/types/admin-report';
import { QuestionForm } from './QuestionForm';
import { QuestionsReorderControl } from './QuestionsReorderControl';

type ViewMode = 'list' | 'create' | 'edit';

interface QuestionsTableProps {
  initialQuestions: QuestionListItem[];
}

const PAGE_TITLES: Record<ViewMode, string> = {
  list: 'Управление отчетом',
  create: 'Добавление вопроса',
  edit: 'Редактирование вопроса',
};

export function QuestionsTable({
  initialQuestions,
}: QuestionsTableProps): React.ReactElement {
  const [questions, setQuestions] = useState<QuestionListItem[]>(initialQuestions);
  const [view, setView] = useState<ViewMode>('list');
  const [editTarget, setEditTarget] = useState<QuestionListItem | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const nextOrderIndex =
    questions.length > 0 ? Math.max(...questions.map((q) => q.orderIndex)) + 1 : 1;

  const refetch = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/admin/report/questions');

      if (!response.ok) {
        setFetchError('Не удалось обновить список вопросов');
        return;
      }

      const data = (await response.json()) as QuestionListItem[];
      setQuestions(data);
      setFetchError(null);
    } catch {
      setFetchError('Не удалось выполнить запрос');
    }
  }, []);

  function handleSaved(): void {
    setView('list');
    setEditTarget(null);
    void refetch();
  }

  function handleDeleted(): void {
    setView('list');
    setEditTarget(null);
    void refetch();
  }

  async function handleDeleteFromTable(question: QuestionListItem): Promise<void> {
    if (isFinalChoiceQuestion(question.options)) {
      setActionError('Финальный вопрос нельзя удалить');
      return;
    }

    if (!window.confirm('Удалить этот вопрос?')) return;

    setDeletingId(question.id);
    setActionError(null);

    try {
      const response = await fetch(`/api/admin/report/questions/${question.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        setActionError('Не удалось удалить вопрос');
        return;
      }

      await refetch();
    } catch {
      setActionError('Не удалось выполнить запрос. Проверьте соединение.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-admin-accent">{PAGE_TITLES[view]}</h1>

      {(fetchError || actionError) && view === 'list' && (
        <div className="mb-4">
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {fetchError ?? actionError}
          </p>
        </div>
      )}

      {view === 'list' && (
        <div className="rounded-xl border border-admin-card-border bg-white shadow-admin-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-card-border">
                  <th className="w-12 px-4 py-3 text-left text-sm font-normal text-admin-label">
                    №
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-normal text-admin-label">
                    Вопрос
                  </th>
                  <th className="w-36 px-4 py-3 text-left text-sm font-normal text-admin-label">
                    Вариант 1
                  </th>
                  <th className="w-36 px-4 py-3 text-left text-sm font-normal text-admin-label">
                    Вариант 2
                  </th>
                  <th className="w-36 px-4 py-3 text-left text-sm font-normal text-admin-label">
                    Вариант 3
                  </th>
                  <th className="w-36 px-4 py-3 text-left text-sm font-normal text-admin-label">
                    Вариант 4
                  </th>
                  <th className="w-28 px-4 py-3" aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {questions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-admin-placeholder"
                    >
                      Вопросы не найдены. Добавьте первый.
                    </td>
                  </tr>
                ) : (
                  questions.map((question) => (
                    <QuestionRow
                      key={question.id}
                      question={question}
                      questions={questions}
                      isDeleting={deletingId === question.id}
                      onEdit={() => {
                        setEditTarget(question);
                        setView('edit');
                      }}
                      onDelete={() => void handleDeleteFromTable(question)}
                      onReordered={() => void refetch()}
                      onError={(message) => setActionError(message)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center border-t border-admin-card-border px-4 py-5">
            <button
              type="button"
              onClick={() => setView('create')}
              className="rounded-lg bg-admin-accent px-8 py-2.5 text-sm font-medium text-white transition-colors hover:bg-admin-accent-hover"
            >
              Добавить
            </button>
          </div>
        </div>
      )}

      {view === 'create' && (
        <QuestionForm
          mode="create"
          nextOrderIndex={nextOrderIndex}
          onCancel={() => setView('list')}
          onSaved={handleSaved}
        />
      )}

      {view === 'edit' && editTarget && (
        <QuestionForm
          mode="edit"
          question={editTarget}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

interface QuestionRowProps {
  question: QuestionListItem;
  questions: QuestionListItem[];
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReordered: () => void;
  onError: (message: string) => void;
}

function QuestionRow({
  question,
  questions,
  isDeleting,
  onEdit,
  onDelete,
  onReordered,
  onError,
}: QuestionRowProps): React.ReactElement {
  const cells = [0, 1, 2, 3].map((index) => question.options[index] ?? '');

  return (
    <tr className="border-b border-admin-card-border last:border-b-0">
      <td className="px-4 py-3 text-admin-input-text">{question.orderIndex}</td>
      <td className="px-4 py-3 text-admin-input-text">{question.questionText}</td>
      {cells.map((text, index) => (
        <td key={index} className="px-4 py-3 text-admin-input-text">
          <div className="flex items-center gap-2">
            {question.correctOption === index && text.trim().length > 0 && (
              <CorrectOptionMark />
            )}
            <span>{text}</span>
          </div>
        </td>
      ))}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <QuestionsReorderControl
            question={question}
            questions={questions}
            onReordered={onReordered}
            onError={onError}
          />
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-1.5 text-admin-label hover:bg-admin-nav-hover-bg hover:text-admin-accent"
            aria-label={`Редактировать вопрос №${question.orderIndex}`}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting || isFinalChoiceQuestion(question.options)}
            className="rounded-lg p-1.5 text-admin-label hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Удалить вопрос №${question.orderIndex}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function CorrectOptionMark(): React.ReactElement {
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-gray-900"
      aria-label="Верный ответ"
    >
      <Check size={10} className="text-white" strokeWidth={3} />
    </span>
  );
}
