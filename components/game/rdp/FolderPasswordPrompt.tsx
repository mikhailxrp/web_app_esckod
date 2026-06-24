'use client';

import { useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { fetchWithVersion } from '@/lib/api/fetchWithVersion';
import { toast } from '@/components/ui/Toast';
import type { RdpFolderView, RdpUnlockResult } from '@/types/rdp';

// ─── Props ───────────────────────────────────────────────────────────────────

interface FolderPasswordPromptProps {
  folder: RdpFolderView;
  version: number;
  slotKey: string;
  zIndex: number;
  onUnlock: (folderName: string, newVersion: number) => void;
  onClose: () => void;
  onConflict: () => Promise<void>;
}

interface ForgotPasswordInfoProps {
  zIndex: number;
  onClose: () => void;
}

// ─── Forgot Password Info popup ───────────────────────────────────────────────

function ForgotPasswordInfo({ zIndex, onClose }: ForgotPasswordInfoProps): ReactElement {
  return (
    <div
      style={{ zIndex }}
      className="absolute inset-0 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Забыли пароль?"
    >
      <div className="w-80 bg-white border border-gray-300 shadow-2xl">
        {/* Titlebar */}
        <div className="flex items-center bg-gray-100 border-b border-gray-200 px-3 py-1.5">
          <span className="flex-1 font-sans text-sm text-gray-800 font-medium">Забыли пароль?</span>
          <WindowControls onClose={onClose} />
        </div>
        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2 font-sans text-sm text-gray-700">
            <p>Почта, привязанная к данному аккаунту, заблокирована.</p>
            <p>Убедитесь, что у вас есть к ней доступ.</p>
            <p>
              Не передавайте личные данные третьим лицам во избежание потери данных или
              мошеннических операций.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-center px-8 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-sans text-sm rounded transition-colors"
          >
            ОК
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Window control buttons (shared titlebar pattern) ─────────────────────────

interface WindowControlsProps {
  onClose: () => void;
}

function WindowControls({ onClose }: WindowControlsProps): ReactElement {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Свернуть"
        className="flex size-6 items-center justify-center rounded-sm hover:bg-gray-300 text-gray-700"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" aria-hidden="true">
          <path d="M0 0.5h10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Развернуть"
        className="flex size-6 items-center justify-center rounded-sm hover:bg-gray-300 text-gray-700"
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="8" height="8" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="flex size-6 items-center justify-center rounded-sm hover:bg-red-500 hover:text-white text-gray-700"
      >
        <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
          <path
            d="M1 1l7 7M8 1l-7 7"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

// ─── Password Prompt ─────────────────────────────────────────────────────────

export function FolderPasswordPrompt({
  folder,
  version,
  slotKey,
  zIndex,
  onUnlock,
  onClose,
  onConflict,
}: FolderPasswordPromptProps): ReactElement {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (): Promise<void> => {
    if (!password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetchWithVersion(`/api/missions/rdp/${slotKey}/unlock-folder`, {
        body: {
          folderName: folder.folderName,
          password: password.trim(),
          expectedVersion: version,
        },
        onConflict,
      });

      if (res.status === 409) {
        setLoading(false);
        return;
      }

      const data = (await res.json()) as RdpUnlockResult | { error?: string };

      if (res.ok) {
        const result = data as RdpUnlockResult;
        onUnlock(result.folderName, result.version);
        return;
      }

      const errCode = (data as { error?: string }).error;
      if (errCode === 'INVALID_PASSWORD') {
        setError('Неверный пароль');
      } else if (errCode === 'FOLDER_NOT_LOCKED') {
        toast.info('Папка уже разблокирована.');
        onClose();
      } else {
        setError('Ошибка сервера. Попробуйте еще раз.');
      }
    } catch (err) {
      console.error('[FolderPasswordPrompt.handleSubmit]', err);
      setError('Ошибка соединения.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPath = async (): Promise<void> => {
    if (!folder.folderPath) return;
    try {
      await navigator.clipboard.writeText(folder.folderPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  return (
    <>
      <div
        style={{ zIndex }}
        className="absolute inset-0 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-label="Введите пароль"
      >
        <div className="w-80 bg-white border border-gray-300 shadow-2xl">
          {/* Titlebar */}
          <div className="flex items-center bg-gray-100 border-b border-gray-200 px-3 py-1.5">
            <span className="flex-1 font-sans text-sm text-gray-800 font-medium">
              Введите пароль
            </span>
            <WindowControls onClose={onClose} />
          </div>

          {/* Content */}
          <div className="p-5 flex flex-col gap-3">
            <p className="font-sans text-sm text-gray-600">
              Так как вы получаете доступ к конфиденциальным данным, вам нужно подтвердить свой
              пароль.
            </p>

            {/* Input + Submit */}
            <div className="flex gap-2 items-start">
              <div className="flex-1 flex flex-col gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSubmit();
                  }}
                  aria-label="Пароль"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'pwd-error' : undefined}
                  disabled={loading}
                  autoFocus
                  className="w-full border border-gray-300 px-3 py-1.5 font-sans text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
                />
                {error ? (
                  <p id="pwd-error" role="alert" className="font-sans text-xs text-red-500">
                    {error}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading || !password.trim()}
                className="shrink-0 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-sans text-sm rounded-sm transition-colors"
              >
                {loading ? '…' : 'Вход'}
              </button>
            </div>

            {/* Footer links */}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="self-start font-sans text-sm text-blue-600 hover:underline"
              >
                Забыли пароль?
              </button>

              {folder.folderPath ? (
                <div className="flex items-center gap-1.5 font-sans text-sm text-gray-600">
                  <span>Путь:</span>
                  <span
                    className="text-blue-600 truncate max-w-[160px]"
                    title={folder.folderPath}
                  >
                    {folder.folderPath}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyPath()}
                    aria-label="Копировать путь"
                    className="shrink-0 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    {copied ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                        className="text-green-600"
                      >
                        <path
                          d="M2.5 7l3 3 6-6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {showForgot ? (
        <ForgotPasswordInfo zIndex={zIndex + 1} onClose={() => setShowForgot(false)} />
      ) : null}
    </>
  );
}
