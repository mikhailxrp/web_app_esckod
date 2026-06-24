'use client';

import type { ReactElement } from 'react';

interface RdpCompletedViewProps {
  displayName: string;
  onClose: () => void;
}

export function RdpCompletedView({ displayName, onClose }: RdpCompletedViewProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-6 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          className="text-accent"
        >
          <circle cx="24" cy="24" r="23" stroke="currentColor" strokeWidth="2" />
          <path
            d="M14 24l7 7 13-13"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h2 className="font-mono text-game-panel uppercase tracking-game-wide text-accent">
          Миссия завершена
        </h2>
      </div>

      <p className="font-mono text-game-sm text-content-secondary">
        {displayName}: сессия удаленного доступа закрыта.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="h-input-height w-full max-w-[200px] rounded-game-full border border-border font-mono text-game-sm uppercase tracking-game-wide text-content-secondary transition-colors hover:border-accent hover:text-accent"
      >
        Закрыть
      </button>
    </div>
  );
}
