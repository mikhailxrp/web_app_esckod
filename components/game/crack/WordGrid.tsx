'use client';

import type { ReactElement } from 'react';

import { WordCell } from '@/components/game/crack/WordCell';

interface WordGridProps {
  words: string[];
  disabled: boolean;
  onSelect: (word: string) => void;
}

export function WordGrid({ words, disabled, onSelect }: WordGridProps): ReactElement {
  return (
    <div
      role="list"
      aria-label="Поле слов"
      className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5"
    >
      {words.map((word, index) => (
        <WordCell
          key={`${word}-${index}`}
          word={word}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
