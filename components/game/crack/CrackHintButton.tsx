'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';

interface CrackHintButtonProps {
  hintText: string | null;
}

export function CrackHintButton({ hintText }: CrackHintButtonProps): ReactElement | null {
  const [open, setOpen] = useState(false);

  if (!hintText) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Правила миссии"
        aria-expanded={open}
        className="flex size-7 items-center justify-center rounded-game-sm border border-border font-mono text-game-sm text-content-secondary transition-colors hover:border-accent hover:text-accent"
      >
        ⓘ
      </button>

      {open ? (
        <div
          role="tooltip"
          className="absolute right-0 top-9 z-card w-64 rounded-game-sm border border-border bg-bg-secondary p-3 font-mono text-game-xs text-content-secondary shadow-game-card"
        >
          {hintText}
        </div>
      ) : null}
    </div>
  );
}
