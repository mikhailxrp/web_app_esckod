'use client';

import type { ReactElement } from 'react';

import { AttemptRow } from '@/components/game/crack/AttemptRow';
import type { AttemptEntry } from '@/types/crack';

interface AttemptHistoryProps {
  attempts: AttemptEntry[];
  attemptsUsed: number;
  maxAttempts: number;
}

export function AttemptHistory({ attempts, attemptsUsed, maxAttempts }: AttemptHistoryProps): ReactElement {
  if (attempts.length === 0) {
    return <></>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-game-xs text-content-muted" aria-live="polite">
        Попытка {attemptsUsed}/{maxAttempts}
      </p>
      <div role="list" aria-label="История попыток" className="flex flex-col gap-1.5">
        {attempts.map((attempt, index) => (
          <AttemptRow key={index} attempt={attempt} />
        ))}
      </div>
    </div>
  );
}
