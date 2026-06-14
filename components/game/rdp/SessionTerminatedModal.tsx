'use client';

import type { ReactElement } from 'react';

// ─── Props ───────────────────────────────────────────────────────────────────

interface SessionTerminatedModalProps {
  onClose: () => void;
  isLoading?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SessionTerminatedModal({
  onClose,
  isLoading = false,
}: SessionTerminatedModalProps): ReactElement {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Сеанс прерван"
      aria-live="assertive"
    >
      {/* Windows 11-style dark card */}
      <div className="w-[420px] max-w-[90%] rounded-2xl bg-[#1A1A2E] border border-white/10 px-10 py-8 shadow-2xl flex flex-col items-center gap-4">
        {/* Warning icon */}
        <div
          className="flex size-14 items-center justify-center rounded-full border-2 border-yellow-400/80"
          aria-hidden="true"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M14 8v8M14 20v1"
              stroke="#FBBF24"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="font-sans text-xl font-semibold text-white">Сеанс прерван</h2>

        {/* Description */}
        <p className="text-center font-sans text-sm text-white/70 leading-relaxed">
          Удалённое соединение было разорвано администратором системы.
        </p>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="mt-2 rounded-lg bg-white/10 px-8 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Закрыть и завершить сессию"
        >
          {isLoading ? 'Завершение…' : 'Закрыть'}
        </button>
      </div>
    </div>
  );
}
