'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';

import { DecipherSkipConfirmModal } from '@/components/game/decipher/DecipherSkipConfirmModal';

interface DecipherSkipButtonProps {
  onSkip: () => Promise<boolean>;
  disabled: boolean;
}

export function DecipherSkipButton({ onSkip, disabled }: DecipherSkipButtonProps): ReactElement {
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
        className="font-mono text-game-sm uppercase tracking-game-wide text-content-secondary underline-offset-4 transition-colors hover:text-content-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        Пропустить миссию
      </button>

      {confirmOpen ? (
        <DecipherSkipConfirmModal
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
