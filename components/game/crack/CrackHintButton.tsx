'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ReactElement } from 'react';
import { HintTooltip } from '@/components/game/ui/HintTooltip';

interface CrackHintButtonProps {
  hintText: string | null;
  disabled?: boolean;
}

export function CrackHintButton({ hintText, disabled = false }: CrackHintButtonProps): ReactElement | null {
  const [open, setOpen] = useState(false);

  if (!hintText) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        aria-label="Правила миссии"
        aria-expanded={open}
        disabled={disabled}
        className="flex size-7 items-center justify-center rounded-game-sm border border-border transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Image src="/assets/icons/info.svg" alt="" width={16} height={16} aria-hidden="true" />
      </button>

      {open ? <HintTooltip text={hintText} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
