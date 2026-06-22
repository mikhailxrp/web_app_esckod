'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ReactElement } from 'react';

interface DecipherHintButtonProps {
  hintText: string | null;
  disabled?: boolean;
}

export function DecipherHintButton({ hintText, disabled = false }: DecipherHintButtonProps): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (hintText && !disabled) setOpen((v) => !v);
        }}
        aria-label="Правила миссии"
        aria-expanded={open}
        disabled={disabled}
        className="flex size-7 items-center justify-center rounded-game-sm border border-border transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Image src="/assets/icons/info.svg" alt="" width={16} height={16} aria-hidden="true" />
      </button>

      {open && hintText ? (
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
