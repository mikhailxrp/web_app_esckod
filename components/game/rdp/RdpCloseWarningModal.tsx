'use client';

import { useCallback, useEffect } from 'react';
import type { ReactElement } from 'react';

interface RdpCloseWarningModalProps {
  intent: 'minimize' | 'close';
  fileNames: string[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RdpCloseWarningModal({
  intent,
  fileNames,
  busy,
  onConfirm,
  onCancel,
}: RdpCloseWarningModalProps): ReactElement {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    },
    [busy, onCancel],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const actionLabel = intent === 'minimize' ? 'Свернуть' : 'Закрыть';

  return (
    <div
      className="fixed inset-0 z-toast flex animate-modal-backdrop items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Открытые файлы не закрыты"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="flex w-full max-w-md animate-modal-panel flex-col gap-4 rounded-game-lg border border-border bg-bg-card p-6 shadow-game-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-accent text-game-sm uppercase tracking-game-wide text-content-primary">
          Файл ещё открыт
        </h2>
        <p className="font-mono text-game-sm text-content-secondary">
          Вы открывали файл, но не закрыли его крестиком в его собственном
          окне. При {intent === 'minimize' ? 'сворачивании' : 'закрытии'}{' '}
          окна удалённого доступа он будет автоматически отмечен как
          просмотренный:
        </p>

        <ul className="flex flex-col gap-1 font-mono text-game-sm text-content-primary">
          {fileNames.map((name) => (
            <li key={name} className="truncate">
              — {name}
            </li>
          ))}
        </ul>

        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-input-height rounded-game-full border border-border px-5 font-mono text-game-sm uppercase tracking-game-wide text-content-secondary transition-colors hover:border-border-strong hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Вернуться
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="h-input-height rounded-game-full bg-accent px-5 font-mono text-game-sm uppercase tracking-game-wide text-content-inverse disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? '…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
