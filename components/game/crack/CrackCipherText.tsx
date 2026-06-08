"use client";

import { useMemo } from "react";
import type { ReactElement } from "react";

interface CrackCipherTextProps {
  words: string[];
}

const SLOT_SUFFIX = '%@//--PRIMER..)+//&"*/:';
const NOISE_PREFIX = "VECTOR";

function buildCipherText(words: string[]): string {
  const TOTAL_SLOTS = 80;
  const wordPositions = new Map<number, string>();

  if (words.length > 0) {
    const step = Math.max(2, Math.floor(TOTAL_SLOTS / words.length));
    words.forEach((word, i) => {
      const pos = Math.min(i * step + 1, TOTAL_SLOTS - 1);
      wordPositions.set(pos, word);
    });
  }

  const slots: string[] = [];
  let wordIdx = 0;

  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const word = wordPositions.get(i);
    if (word !== undefined) {
      slots.push(`${word}${SLOT_SUFFIX}`);
      wordIdx++;
    } else {
      slots.push(`${NOISE_PREFIX}${SLOT_SUFFIX}`);
    }
  }

  // append any remaining words that didn't fit in TOTAL_SLOTS
  while (wordIdx < words.length) {
    slots.push(`${words[wordIdx]}${SLOT_SUFFIX}`);
    wordIdx++;
  }

  return "[//:" + slots.join("") + '&""';
}

export function CrackCipherText({ words }: CrackCipherTextProps): ReactElement {
  const cipherText = useMemo(() => buildCipherText(words), [words]);

  return (
    <div
      aria-hidden="true"
      className="h-full overflow-hidden rounded-game-sm border border-border bg-bg-secondary p-4"
    >
      <p className="select-none break-all font-mono text-[16px] leading-relaxed text-content-muted">
        {cipherText}
      </p>
    </div>
  );
}
