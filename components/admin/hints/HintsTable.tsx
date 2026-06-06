'use client';

import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { HintListItem } from '@/types/admin-hints';
import { HintForm } from './HintForm';
import { DeleteHintDialog } from './DeleteHintDialog';
import { HintsReorderControl } from './HintsReorderControl';

interface HintsTableProps {
  initialHints: HintListItem[];
}

const MAX_TEXT_LENGTH = 80;

function truncate(text: string, max = MAX_TEXT_LENGTH): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function HintsTable({ initialHints }: HintsTableProps): React.ReactElement {
  const [hints, setHints] = useState<HintListItem[]>(initialHints);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HintListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HintListItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/admin/hints');

      if (!response.ok) {
        setFetchError('Не удалось обновить список подсказок');
        return;
      }

      const data = (await response.json()) as HintListItem[];
      setHints(data);
      setFetchError(null);
    } catch {
      setFetchError('Не удалось выполнить запрос');
    }
  }, []);

  async function handleToggleActive(hint: HintListItem): Promise<void> {
    setTogglingId(hint.id);
    setActionError(null);

    try {
      const response = await fetch(`/api/admin/hints/${hint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !hint.isActive }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        setActionError(data.message ?? 'Не удалось переключить активность подсказки');
        return;
      }

      await refetch();
    } catch {
      setActionError('Не удалось выполнить запрос. Проверьте соединение.');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-admin-card-border bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-admin-card-border px-4 py-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Порядок выдачи подсказок игроку
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={14} aria-hidden="true" />
            Создать подсказку
          </button>
        </div>

        {fetchError && (
          <div className="border-b border-admin-card-border px-4 py-3">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {fetchError}
            </p>
          </div>
        )}

        {actionError && (
          <div className="border-b border-admin-card-border px-4 py-3">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {actionError}
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-card-border bg-gray-50 dark:bg-gray-800/50">
                <th className="w-16 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  №
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Текст
                </th>
                <th className="w-28 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Активна
                </th>
                <th className="w-24 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Порядок
                </th>
                <th className="w-20 px-4 py-3" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {hints.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                  >
                    Подсказки не найдены. Создайте первую.
                  </td>
                </tr>
              ) : (
                hints.map((hint) => (
                  <HintRow
                    key={hint.id}
                    hint={hint}
                    hints={hints}
                    isToggling={togglingId === hint.id}
                    onEdit={() => setEditTarget(hint)}
                    onDelete={() => setDeleteTarget(hint)}
                    onToggleActive={() => void handleToggleActive(hint)}
                    onReordered={() => void refetch()}
                    onError={(msg) => setActionError(msg)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {hints.length > 0 && (
          <div className="border-t border-admin-card-border px-4 py-2 text-xs text-gray-400 dark:text-gray-500">
            Всего: {hints.length}
          </div>
        )}
      </div>

      {createOpen && (
        <HintForm
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            void refetch();
          }}
        />
      )}

      {editTarget && (
        <HintForm
          mode="edit"
          hint={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            void refetch();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteHintDialog
          hintId={deleteTarget.id}
          hintOrderIndex={deleteTarget.orderIndex}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            void refetch();
          }}
        />
      )}
    </>
  );
}

interface HintRowProps {
  hint: HintListItem;
  hints: HintListItem[];
  isToggling: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onReordered: () => void;
  onError: (message: string) => void;
}

function HintRow({
  hint,
  hints,
  isToggling,
  onEdit,
  onDelete,
  onToggleActive,
  onReordered,
  onError,
}: HintRowProps): React.ReactElement {
  return (
    <tr className="border-b border-admin-card-border last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/40">
      <td className="px-4 py-3 text-center">
        <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300">
          {hint.orderIndex}
        </span>
      </td>
      <td className="max-w-sm px-4 py-3 text-gray-600 dark:text-gray-300">
        {truncate(hint.text)}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          type="button"
          onClick={onToggleActive}
          disabled={isToggling}
          className="disabled:opacity-50"
          aria-label={hint.isActive ? 'Деактивировать подсказку' : 'Активировать подсказку'}
        >
          {hint.isActive ? (
            <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
              Да
            </span>
          ) : (
            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Нет
            </span>
          )}
        </button>
      </td>
      <td className="px-4 py-3 text-center">
        <HintsReorderControl hint={hint} hints={hints} onReordered={onReordered} onError={onError} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label={`Редактировать подсказку №${hint.orderIndex}`}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            aria-label={`Удалить подсказку №${hint.orderIndex}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
