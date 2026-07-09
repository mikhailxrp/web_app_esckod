'use client';

import type { ReactElement } from 'react';

import type { AttemptEntry, LetterStatus } from '@/types/crack';

const STATUS_CLASS: Record<LetterStatus, string> = {
  correct: 'text-semantic-success',
  'wrong-position': 'text-yellow-400',
  absent: 'text-content-muted',
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
    <div role="listitem" className="flex font-mono text-game-base uppercase tracking-widest">
      {letters.map((char, index) => {
        const status = attempt.positions[index] ?? 'absent';

        return (
          <span
            key={index}
            className={STATUS_CLASS[status]}
            aria-label={`${char}: ${STATUS_LABEL[status]}`}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
}
