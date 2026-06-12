'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { RdpFileItem } from '@/types/admin-files';
import { FolderLockToggle } from './FolderLockToggle';
import { FileActions } from './FileActions';
import { DeleteFolderDialog } from './DeleteFolderDialog';

interface FolderModalProps {
  slotId: string;
  slotName: string;
  folder: string;
  files: RdpFileItem[];
  isLocked: boolean;
  folderPassword: string | null;
  onClose: () => void;
  onMutated: () => void;
}

export function FolderModal({
  slotId,
  slotName,
  folder,
  files,
  isLocked,
  folderPassword,
  onClose,
  onMutated,
}: FolderModalProps): React.ReactElement {
  const [showDeleteFolder, setShowDeleteFolder] = useState(false);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-modal-title"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-xl rounded-2xl bg-white shadow-xl dark:bg-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
            <h2
              id="folder-modal-title"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              Папка: {folder}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Закрыть модалку"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="mb-6 grid grid-cols-2 gap-4">
              {/* Слот миссии */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Слот миссии
                </label>
                <input
                  type="text"
                  value={slotName}
                  disabled
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                />
              </div>

              {/* Наименование */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Наименование
                </label>
                <input
                  type="text"
                  value={folder}
                  disabled
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                />
              </div>

              {/* Зашифрована */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Зашифрована
                </label>
                <FolderLockToggle
                  slotId={slotId}
                  folder={folder}
                  isLocked={isLocked}
                  onMutated={onMutated}
                />
              </div>

              {/* Пароль */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Пароль
                </label>
                <input
                  type="text"
                  value={folderPassword ?? ''}
                  disabled
                  placeholder="Будет прописан после создания миссии"
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 placeholder-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:placeholder-gray-600"
                />
              </div>
            </div>

            {/* Список файлов */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
                Список файлов
              </h3>

              {files.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
                  Файлов нет
                </p>
              ) : (
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                  {files.map((file) => (
                    <div key={file.id} className="px-4">
                      <FileActions file={file} onMutated={onMutated} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setShowDeleteFolder(true)}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
            >
              Удалить папку
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>

      {showDeleteFolder && (
        <DeleteFolderDialog
          slotId={slotId}
          folder={folder}
          fileCount={files.length}
          onDeleted={() => {
            setShowDeleteFolder(false);
            onMutated();
            onClose();
          }}
          onCancel={() => setShowDeleteFolder(false)}
        />
      )}
    </>
  );
}
