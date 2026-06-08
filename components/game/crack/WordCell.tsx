'use client';

import type { ReactElement } from 'react';

interface WordCellProps {
  word: string;
  disabled: boolean;
  onSelect: (word: string) => void;
}

export function WordCell({ word, disabled, onSelect }: WordCellProps): ReactElement {
  return (
    <button
      type="button"
      role="listitem"
      disabled={disabled}
      onClick={() => onSelect(word)}
      className="flex h-input-height items-center justify-center rounded-game-sm border border-border bg-bg-input px-2 font-mono text-game-sm uppercase tracking-game-wide text-content-primary transition-colors hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {word}
    </button>
  );
}
