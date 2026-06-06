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
        className="flex items-center gap-2 rounded-game-md border border-border px-6 py-2.5 font-mono text-game-sm uppercase tracking-game-wide text-content-primary transition-colors hover:border-border-strong hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {/* Иконка вопросительного знака */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
        Подсказка
      </button>

      {open && <DetectiveHintsModal onClose={() => setOpen(false)} />}
    </>
  );
}
