'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteFolderDialogProps {
  slotId: string;
  folder: string;
  fileCount: number;
  onDeleted: () => void;
  onCancel: () => void;
}

export function DeleteFolderDialog({
  slotId,
  folder,
  fileCount,
  onDeleted,
  onCancel,
}: DeleteFolderDialogProps): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/files/folder', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, folder }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string; message?: string };
        setError(data.message ?? data.error ?? 'Ошибка при удалении папки');
        return;
      }

      onDeleted();
    } catch {
      setError('Не удалось выполнить запрос. Проверьте соединение.');
    } finally {
      setLoading(false);
    }
  }

  const filesLabel =
    fileCount === 0
      ? 'без файлов'
      : fileCount === 1
        ? '1 файл'
        : `${fileCount} файл${fileCount < 5 ? 'а' : 'ов'}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-folder-dialog-title"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-200"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>

        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-full bg-red-100 p-2 dark:bg-red-950">
            <AlertTriangle
              size={18}
              className="text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2
              id="delete-folder-dialog-title"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              Удалить папку?
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              «{folder}»
            </p>
          </div>
        </div>

        <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
          Удалить папку «{folder}» и все {filesLabel} в ней? Это действие
          необратимо.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Удаление…' : 'Удалить папку'}
          </button>
        </div>
      </div>
    </div>
  );
}
