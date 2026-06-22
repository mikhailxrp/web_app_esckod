'use client';

import { useState } from 'react';
import { DetectiveHintsModal } from './DetectiveHintsModal';

interface DetectiveHintsButtonProps {
  disabled?: boolean;
}

export function DetectiveHintsButton({ disabled = false }: DetectiveHintsButtonProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(true); }}
        aria-label="Подсказка от Детектива"
        data-onboarding-id="hints-button"
        disabled={disabled}
        className="inline-flex h-input-height min-w-[140px] items-center justify-center rounded-game-full px-6 font-accent text-game-sm uppercase tracking-game-wide text-accent transition-colors duration-200 hover:bg-accent-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Подсказка
      </button>

      {open && <DetectiveHintsModal onClose={() => setOpen(false)} />}
    </>
  );
}
