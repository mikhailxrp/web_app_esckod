'use client';

import type { ReactElement } from 'react';

import { RdpSkipButton } from '@/components/game/rdp/RdpSkipButton';

interface RdpAccessDeniedOverlayProps {
  canSkip: boolean;
  busy: boolean;
  onRestart: () => void;
  onSkip: () => Promise<boolean>;
}

export function RdpAccessDeniedOverlay({
  canSkip,
  busy,
  onRestart,
  onSkip,
}: RdpAccessDeniedOverlayProps): ReactElement {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Доступ запрещён"
    >
      <div className="flex flex-col items-center gap-5 rounded-game-lg border border-semantic-error bg-bg-primary p-8 text-center shadow-game-card">
        {/* Иконка ошибки */}
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          fill="none"
          aria-hidden="true"
          className="text-semantic-error"
        >
          <circle cx="22" cy="22" r="21" stroke="currentColor" strokeWidth="2" />
          <path
            d="M22 12v12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="22" cy="31" r="1.5" fill="currentColor" />
        </svg>

        <div className="flex flex-col gap-1">
          <h2 className="font-mono text-game-panel uppercase tracking-game-wide text-semantic-error">
            Доступ запрещён
          </h2>
          <p className="font-mono text-game-sm text-content-muted">
            Таймер истёк. Соединение разорвано.
          </p>
        </div>

        <button
          type="button"
          onClick={onRestart}
          disabled={busy}
          className="h-input-height w-full max-w-[200px] rounded-game-full bg-accent font-mono text-game-sm uppercase tracking-game-wide text-content-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Начать заново
        </button>

        {canSkip ? (
          <div className="flex justify-center">
            <RdpSkipButton onSkip={onSkip} disabled={busy} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
