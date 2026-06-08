'use client';

import type { ReactElement } from 'react';

import { AttemptRow } from '@/components/game/crack/AttemptRow';
import type { AttemptEntry } from '@/types/crack';

interface AttemptHistoryProps {
  attempts: AttemptEntry[];
}

export function AttemptHistory({ attempts }: AttemptHistoryProps): ReactElement {
  if (attempts.length === 0) {
    return (
      <p className="font-mono text-game-sm text-content-muted">
        Выберите слово на поле, чтобы начать.
      </p>
    );
  }

  return (
    <div role="list" aria-label="История попыток" className="flex flex-col gap-1.5">
      {attempts.map((attempt, index) => (
        <AttemptRow key={index} attempt={attempt} />
      ))}
    </div>
  );
}
