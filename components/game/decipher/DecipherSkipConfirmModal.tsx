'use client';

import { useCallback, useEffect } from 'react';
import type { ReactElement } from 'react';

interface DecipherSkipConfirmModalProps {
  busy: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DecipherSkipConfirmModal({
  busy,
  onConfirm,
  onCancel,
}: DecipherSkipConfirmModalProps): ReactElement {
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

  return (
    <div
      className="fixed inset-0 z-toast flex animate-modal-backdrop items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Подтверждение пропуска миссии"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="flex w-full max-w-md animate-modal-panel flex-col gap-4 rounded-game-lg border border-border bg-bg-card p-6 shadow-game-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-accent text-game-sm uppercase tracking-game-wide text-content-primary">
          Пропустить миссию?
        </h2>
        <p className="font-mono text-game-sm text-content-secondary">
          Миссия будет помечена как пройденная. Это может повлиять на восприятие
          истории. Отменить пропуск нельзя. Продолжить?
        </p>

        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-input-height rounded-game-full border border-border px-5 font-mono text-game-sm uppercase tracking-game-wide text-content-secondary transition-colors hover:border-border-strong hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="h-input-height rounded-game-full bg-accent px-5 font-mono text-game-sm uppercase tracking-game-wide text-content-inverse disabled:cursor-not-allowed disabled:opacity-50"
          >
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );
}
