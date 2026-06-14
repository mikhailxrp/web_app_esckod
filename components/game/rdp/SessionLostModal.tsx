'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';

// ─── Props ───────────────────────────────────────────────────────────────────

interface SessionLostModalProps {
  nextIp: string;
  onClose: () => void;
  isLoading?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SessionLostModal({
  nextIp,
  onClose,
  isLoading = false,
}: SessionLostModalProps): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(nextIp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Ошибка: два активных сеанса"
      aria-live="assertive"
    >
      {/* Windows 11-style blue card */}
      <div className="w-[460px] max-w-[90%] rounded-2xl bg-[#0067C0] px-10 py-8 shadow-2xl flex flex-col items-center gap-4">
        {/* Error icon */}
        <div
          className="flex size-14 items-center justify-center rounded-full border-2 border-white/80"
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
              d="M5 5l18 18M23 5L5 23"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="font-sans text-xl font-semibold text-white">Ошибка</h2>

        {/* Row: subtitle + details toggle */}
        <div className="flex w-full items-center justify-between">
          <span className="font-sans text-sm text-white/90">Два активных сеанса</span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 font-sans text-sm text-white/90 hover:text-white transition-colors"
            aria-expanded={expanded}
            aria-controls="session-details"
          >
            Подробнее
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            >
              <path
                d="M2 4l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Expandable details */}
        {expanded ? (
          <div
            id="session-details"
            className="w-full flex flex-col gap-2"
          >
            {/* Current session IP (placeholder — correctIp current slot is secret) */}
            <div className="flex items-center gap-2 font-sans text-sm text-white/90">
              <span className="w-4 text-center font-mono text-xs opacity-70">1</span>
              <span>IP: 192.168.1.1</span>
              <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 font-sans text-xs text-white">
                Вы
              </span>
            </div>

            {/* Next IP — copyable */}
            <div className="flex items-center gap-2 font-sans text-sm text-white/90">
              <span className="w-4 text-center font-mono text-xs opacity-70">2</span>
              <span>IP: {nextIp}</span>
              <button
                type="button"
                onClick={() => void handleCopy()}
                aria-label="Копировать IP"
                className="ml-1 flex items-center justify-center rounded p-0.5 transition-colors hover:bg-white/20"
              >
                {copied ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 7l3 3 6-6"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ) : null}

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="mt-2 rounded-lg bg-white/20 px-8 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Закрыть и завершить сессию"
        >
          {isLoading ? 'Завершение…' : 'Закрыть'}
        </button>
      </div>
    </div>
  );
}
