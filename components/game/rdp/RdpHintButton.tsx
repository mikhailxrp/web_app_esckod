'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ReactElement } from 'react';

import { ONBOARDING_TARGETS } from '@/constants/onboardingSteps';
import { HintTooltip } from '@/components/game/ui/HintTooltip';

interface RdpHintButtonProps {
  hintText: string | null;
  disabled?: boolean;
}

export function RdpHintButton({ hintText, disabled = false }: RdpHintButtonProps): ReactElement | null {
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
        data-onboarding-id={ONBOARDING_TARGETS.RDP_INSTRUCTION_BUTTON}
        className="flex size-7 items-center justify-center rounded-game-sm border border-border transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Image src="/assets/icons/info.svg" alt="" width={16} height={16} aria-hidden="true" />
      </button>

      {open ? <HintTooltip text={hintText} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
