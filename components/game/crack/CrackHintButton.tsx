'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import type { ReactElement } from 'react';
import { HintTooltip } from '@/components/game/ui/HintTooltip';

interface CrackHintButtonProps {
  hintText: string | null;
  disabled?: boolean;
}

export function CrackHintButton({ hintText, disabled = false }: CrackHintButtonProps): ReactElement | null {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  if (!hintText) {
    return null;
  }

  const handleToggle = (): void => {
    if (disabled) return;
    setAnchorRect((prev) => (prev ? null : (buttonRef.current?.getBoundingClientRect() ?? null)));
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label="Правила миссии"
        aria-expanded={anchorRect !== null}
        disabled={disabled}
        className="flex size-7 items-center justify-center rounded-game-sm border border-border transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Image src="/assets/icons/info.svg" alt="" width={16} height={16} aria-hidden="true" />
      </button>

      {anchorRect ? (
        <HintTooltip text={hintText} anchorRect={anchorRect} onClose={() => setAnchorRect(null)} />
      ) : null}
    </div>
  );
}
