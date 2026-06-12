'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';

import { RdpSkipConfirmModal } from '@/components/game/rdp/RdpSkipConfirmModal';

interface RdpSkipButtonProps {
  /** Выполняет POST /skip. Возвращает true при успехе. */
  onSkip: () => Promise<boolean>;
  disabled: boolean;
}

export function RdpSkipButton({ onSkip, disabled }: RdpSkipButtonProps): ReactElement {
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
        <RdpSkipConfirmModal
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
