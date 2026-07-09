'use client';

import { useState } from 'react';
import { Pencil, Trash2, Loader2, Check, X } from 'lucide-react';
import type { RdpFileItem } from '@/types/admin-files';
import { DeleteFileDialog } from './DeleteFileDialog';

interface FileActionsProps {
  file: RdpFileItem;
  onMutated: () => void;
}

type RowState = 'idle' | 'renaming' | 'saving';

export function FileActions({
  file,
  onMutated,
}: FileActionsProps): React.ReactElement {
  const [rowState, setRowState] = useState<RowState>('idle');
  const [renameValue, setRenameValue] = useState(file.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  function startRename(): void {
    setRenameValue(file.name);
    setRenameError(null);
    setRowState('renaming');
  }

  function cancelRename(): void {
    setRenameValue(file.name);
    setRenameError(null);
    setRowState('idle');
  }

  async function saveRename(): Promise<void> {
    const trimmed = renameValue.trim();
    if (!trimmed) return;

    setRenameError(null);
    setRowState('saving');

    try {
      const response = await fetch(`/api/admin/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string; message?: string };
        setRenameError(data.message ?? data.error ?? 'Ошибка при переименовании');
        setRowState('renaming');
        return;
      }

      setRowState('idle');
      onMutated();
    } catch {
      setRenameError('Не удалось выполнить запрос. Проверьте соединение.');
      setRowState('renaming');
    }
  }

  const isSaving = rowState === 'saving';
  const isRenaming = rowState === 'renaming' || isSaving;

  return (
    <>
      <div className="flex items-center justify-between gap-3 py-2">
        {isRenaming ? (
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                disabled={isSaving}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveRename();
                  if (e.key === 'Escape') cancelRename();
                }}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <button
                type="button"
                onClick={() => void saveRename()}
                disabled={isSaving || renameValue.trim().length === 0}
                className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-40 dark:hover:bg-green-950/30"
                aria-label="Сохранить имя"
              >
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
              </button>
              <button
                type="button"
                onClick={cancelRename}
                disabled={isSaving}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label="Отмена"
              >
                <X size={14} />
              </button>
            </div>
            {renameError && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {renameError}
              </p>
            )}
          </div>
        ) : (
          <>
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
              {file.name}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={startRename}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label={`Переименовать файл ${file.name}`}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                aria-label={`Удалить файл ${file.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      {showDeleteDialog && (
        <DeleteFileDialog
          file={file}
          onDeleted={() => {
            setShowDeleteDialog(false);
            onMutated();
          }}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </>
  );
}
