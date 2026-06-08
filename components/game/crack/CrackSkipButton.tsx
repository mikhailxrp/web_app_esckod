'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';

import { CrackSkipConfirmModal } from '@/components/game/crack/CrackSkipConfirmModal';

interface CrackSkipButtonProps {
  /** Выполняет POST /skip. Возвращает true при успехе (тогда модалка закрывается). */
  onSkip: () => Promise<boolean>;
  disabled: boolean;
}

export function CrackSkipButton({ onSkip, disabled }: CrackSkipButtonProps): ReactElement {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    setBusy(true);
    const success = await onSkip();
    setBusy(false);

    if (success) {
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={disabled}
        className="font-mono text-game-sm uppercase tracking-game-wide text-content-muted underline-offset-4 transition-colors hover:text-content-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        Пропустить миссию
      </button>

      {confirmOpen ? (
        <CrackSkipConfirmModal
          busy={busy}
          onConfirm={handleConfirm}
          onCancel={() => {
            if (!busy) setConfirmOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
