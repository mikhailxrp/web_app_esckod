'use client';

import { useState } from 'react';
import { DetectiveHintsModal } from './DetectiveHintsModal';

export function DetectiveHintsButton(): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Подсказка от Детектива"
        data-onboarding-id="hints-button"
        className="inline-flex h-input-height min-w-[140px] items-center justify-center rounded-game-full px-6 font-accent text-game-sm uppercase tracking-game-wide text-accent transition-colors duration-200 hover:bg-accent-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Подсказка
      </button>

      {open && <DetectiveHintsModal onClose={() => setOpen(false)} />}
    </>
  );
}
