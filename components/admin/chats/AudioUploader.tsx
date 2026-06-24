'use client';

import { useRef, useState } from 'react';
import { Upload, Trash2, Loader2, Music } from 'lucide-react';
import { MAX_AUDIO_SIZE_BYTES } from '@/lib/validations/admin-chats';

const ACCEPTED_AUDIO_TYPES = 'audio/mpeg,audio/wav,audio/mp3';
const MAX_SIZE_MB = MAX_AUDIO_SIZE_BYTES / (1024 * 1024);

interface AudioUploaderProps {
  scriptId: string;
  initialAudioUrl: string | null;
  onChange: (url: string | null) => void;
}

type UploaderState = 'idle' | 'uploading' | 'deleting';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_FILE_TYPE: 'Недопустимый формат. Разрешены только MP3 и WAV.',
  FILE_TOO_LARGE: `Файл слишком большой. Максимум ${MAX_SIZE_MB} МБ.`,
  S3_ERROR: 'Ошибка хранилища. Попробуйте еще раз.',
  VALIDATION_ERROR: 'Файл не выбран или пустой.',
};

function getErrorMessage(error: string | undefined): string {
  if (!error) return 'Неизвестная ошибка. Попробуйте еще раз.';

  return ERROR_MESSAGES[error] ?? 'Ошибка сервера. Попробуйте еще раз.';
}

export function AudioUploader({
  scriptId,
  initialAudioUrl,
  onChange,
}: AudioUploaderProps): React.ReactElement {
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl);
  const [state, setState] = useState<UploaderState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      setErrorMessage(ERROR_MESSAGES.FILE_TOO_LARGE);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      return;
    }

    void uploadFile(file);
  }

  async function uploadFile(file: File): Promise<void> {
    setErrorMessage(null);
    setState('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/admin/chats/scripts/${scriptId}/audio`, {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as {
        audioUrl?: string;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(getErrorMessage(data.error));

        return;
      }

      const newUrl = (data as { audioUrl: string }).audioUrl ?? null;

      setAudioUrl(newUrl);
      onChange(newUrl);
    } catch {
      setErrorMessage('Не удалось выполнить запрос. Проверьте соединение.');
    } finally {
      setState('idle');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleDelete(): Promise<void> {
    setErrorMessage(null);
    setState('deleting');

    try {
      const response = await fetch(`/api/admin/chats/scripts/${scriptId}/audio`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setErrorMessage(getErrorMessage(data.error));

        return;
      }

      setAudioUrl(null);
      onChange(null);
    } catch {
      setErrorMessage('Не удалось выполнить запрос. Проверьте соединение.');
    } finally {
      setState('idle');
    }
  }

  const isLoading = state !== 'idle';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-center gap-2">
        <Music size={14} className="text-gray-500 dark:text-gray-400" />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Аудио реплики
        </span>
      </div>

      {audioUrl ? (
        <div className="flex flex-col gap-3">
          <audio
            controls
            src={audioUrl}
            className="h-9 w-full"
            aria-label="Превью аудио реплики"
          />
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isLoading}
            aria-label="Удалить аудио"
            className="flex w-fit items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
          >
            {state === 'deleting' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            {state === 'deleting' ? 'Удаление…' : 'Удалить аудио'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <label
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
            aria-label="Выбрать аудиофайл для загрузки"
          >
            {state === 'uploading' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Upload size={12} />
            )}
            {state === 'uploading' ? 'Загрузка…' : 'Загрузить аудио'}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_AUDIO_TYPES}
              onChange={handleFileChange}
              disabled={isLoading}
              className="sr-only"
              aria-hidden="true"
            />
          </label>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            MP3 или WAV, до {MAX_SIZE_MB} МБ
          </span>
        </div>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
