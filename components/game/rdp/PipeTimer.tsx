'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

const LOW_THRESHOLD_SECONDS = 20;

function computeRemaining(timerStartedAt: string, timerSeconds: number): number {
  const elapsed = Math.floor((Date.now() - new Date(timerStartedAt).getTime()) / 1000);
  return Math.max(0, timerSeconds - elapsed);
}

interface PipeTimerProps {
  timerStartedAt: string;
  timerSeconds: number;
  onExpire: () => void;
}

export function PipeTimer({ timerStartedAt, timerSeconds, onExpire }: PipeTimerProps): ReactElement {
  const [remaining, setRemaining] = useState(() =>
    computeRemaining(timerStartedAt, timerSeconds),
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    setRemaining(computeRemaining(timerStartedAt, timerSeconds));

    const interval = setInterval(() => {
      const rem = computeRemaining(timerStartedAt, timerSeconds);
      setRemaining(rem);

      if (rem <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerStartedAt, timerSeconds, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isLow = remaining <= LOW_THRESHOLD_SECONDS;

  return (
    <div
      className={[
        'font-mono tabular-nums transition-colors',
        isLow ? 'text-semantic-error' : 'text-accent',
      ].join(' ')}
      aria-live="polite"
      aria-label={`Оставшееся время: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
    >
      <span className="text-[1.225rem] font-bold tracking-widest">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
