'use client';

import { useRef, useState } from 'react';
import { CloudUpload, Loader2 } from 'lucide-react';
import {
  MAX_PDF_SIZE_BYTES,
  ALLOWED_PDF_MIME,
} from '@/lib/validations/admin-files';
import type { RdpSlotData } from '@/types/admin-files';

const MAX_SIZE_MB = MAX_PDF_SIZE_BYTES / (1024 * 1024);
const NEW_FOLDER_VALUE = '__new__';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_FILE_TYPE: 'Только PDF-файлы. Выберите другой файл.',
  FILE_TOO_LARGE: `Файл превышает ${MAX_SIZE_MB} МБ.`,
  FILE_NAME_EXISTS: 'Файл с таким именем уже существует в этой папке.',
  NOT_RDP_SLOT: 'Выбранный слот не является RDP-слотом.',
  S3_ERROR: 'Ошибка хранилища. Попробуйте ещё раз.',
};

function getErrorMessage(error: string | undefined): string {
  if (!error) return 'Неизвестная ошибка. Попробуйте ещё раз.';
  return ERROR_MESSAGES[error] ?? 'Ошибка сервера. Попробуйте ещё раз.';
}

interface FileUploadSectionProps {
  slots: RdpSlotData[];
  onSuccess: () => void;
}

export function FileUploadSection({
  slots,
  onSuccess,
}: FileUploadSectionProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedSlotId, setSelectedSlotId] = useState<string>(
    slots[0]?.id ?? '',
  );
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState<string>('');

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);
  const existingFolders = selectedSlot
    ? [...new Set(selectedSlot.files.map((f) => f.folder))]
    : [];

  const effectiveFolder =
    selectedFolder === NEW_FOLDER_VALUE ? newFolderName.trim() : selectedFolder;

  function handleSlotChange(slotId: string): void {
    setSelectedSlotId(slotId);
    setSelectedFolder('');
    setNewFolderName('');
    setErrorMessage(null);
  }

  function handleFolderChange(value: string): void {
    setSelectedFolder(value);
    setErrorMessage(null);
  }

  function validateFile(file: File): string | null {
    if (!ALLOWED_PDF_MIME.includes(file.type as 'application/pdf')) {
      return ERROR_MESSAGES.INVALID_FILE_TYPE;
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      return ERROR_MESSAGES.FILE_TOO_LARGE;
    }
    return null;
  }

  async function uploadFile(file: File): Promise<void> {
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!selectedSlotId) {
      setErrorMessage('Выберите слот миссии.');
      return;
    }

    if (!effectiveFolder) {
      setErrorMessage('Укажите название папки.');
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('slotId', selectedSlotId);
      formData.append('folder', effectiveFolder);

      const response = await fetch('/api/admin/files', {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErrorMessage(getErrorMessage(data.error));
        return;
      }

      setSelectedFolder('');
      setNewFolderName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onSuccess();
    } catch {
      setErrorMessage('Не удалось выполнить запрос. Проверьте соединение.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileInputChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ): void {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(): void {
    setIsDragOver(false);
  }

  function handleZoneClick(): void {
    if (!isUploading) fileInputRef.current?.click();
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-admin-card-border bg-white p-6 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          RDP-слоты не созданы. Добавьте слот в разделе «Миссии», чтобы загружать файлы.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-admin-card-border bg-white p-6 dark:bg-gray-900">
      <h2 className="mb-5 text-base font-semibold text-gray-900 dark:text-white">
        Загрузить файл
      </h2>

      <div className="mb-5 grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="upload-slot"
            className="text-xs font-medium text-gray-600 dark:text-gray-400"
          >
            Слот миссии
          </label>
          <div className="relative">
            <select
              id="upload-slot"
              value={selectedSlotId}
              onChange={(e) => handleSlotChange(e.target.value)}
              disabled={isUploading}
              className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-8 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              ▾
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="upload-folder"
            className="text-xs font-medium text-gray-600 dark:text-gray-400"
          >
            Папка
          </label>
          <div className="relative">
            <select
              id="upload-folder"
              value={selectedFolder}
              onChange={(e) => handleFolderChange(e.target.value)}
              disabled={isUploading}
              className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-8 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="">Выберите папку...</option>
              {existingFolders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
              <option value={NEW_FOLDER_VALUE}>Новая папка...</option>
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              ▾
            </span>
          </div>
        </div>
      </div>

      {selectedFolder === NEW_FOLDER_VALUE && (
        <div className="mb-5 flex flex-col gap-1.5">
          <label
            htmlFor="new-folder-name"
            className="text-xs font-medium text-gray-600 dark:text-gray-400"
          >
            Название новой папки
          </label>
          <input
            id="new-folder-name"
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            disabled={isUploading}
            placeholder="Например: Документы"
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label="Зона загрузки файла. Нажмите или перетащите PDF."
        onClick={handleZoneClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleZoneClick();
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors',
          isDragOver
            ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/20'
            : 'border-indigo-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-indigo-700 dark:bg-gray-800/50',
          isUploading ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        {isUploading ? (
          <Loader2 size={28} className="animate-spin text-indigo-500" aria-hidden="true" />
        ) : (
          <CloudUpload size={28} className="text-indigo-500" aria-hidden="true" />
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isUploading ? (
            'Загрузка…'
          ) : (
            <>
              <span className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Выберите файл
              </span>
              {' '}или перетащите
            </>
          )}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          PDF, до {MAX_SIZE_MB} МБ
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileInputChange}
          disabled={isUploading}
          className="sr-only"
          aria-hidden="true"
        />
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
