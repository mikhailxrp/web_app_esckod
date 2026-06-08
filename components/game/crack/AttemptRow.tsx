'use client';

import type { ReactElement } from 'react';

import type { AttemptEntry, LetterStatus } from '@/types/crack';

const STATUS_CLASS: Record<LetterStatus, string> = {
  correct: 'bg-green-600 text-white',
  'wrong-position': 'bg-yellow-500 text-black',
  absent: 'bg-gray-600 text-white',
};

const STATUS_LABEL: Record<LetterStatus, string> = {
  correct: 'буква на месте',
  'wrong-position': 'буква есть, но не на месте',
  absent: 'буквы нет',
};

interface AttemptRowProps {
  attempt: AttemptEntry;
}

export function AttemptRow({ attempt }: AttemptRowProps): ReactElement {
  const letters = attempt.word.split('');

  return (
    <div role="listitem" className="flex gap-1">
      {letters.map((char, index) => {
        const status = attempt.positions[index] ?? 'absent';

        return (
          <span
            key={index}
            className={`flex size-8 items-center justify-center rounded-game-sm font-mono text-game-sm font-bold uppercase ${STATUS_CLASS[status]}`}
            aria-label={`${char}: ${STATUS_LABEL[status]}`}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
}
