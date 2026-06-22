'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { ReactElement } from 'react';

interface CrackCompletedViewProps {
  resultPassword: string | null;
  targetUrl: string | null;
  targetEmail: string | null;
  initialCopied?: boolean;
}

const FIELD_CLASS =
  'h-input-height w-full rounded-game-lg border border-border bg-bg-input px-4 font-mono text-game-base text-content-primary focus:outline-none';

export function CrackCompletedView({
  resultPassword,
  targetUrl,
  targetEmail,
  initialCopied = false,
}: CrackCompletedViewProps): ReactElement {
  const [copied, setCopied] = useState(initialCopied);

  useEffect(() => {
    setCopied(initialCopied);
  }, [initialCopied]);

  const handleCopy = async (): Promise<void> => {
    if (!resultPassword) return;
    try {
      await navigator.clipboard.writeText(resultPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  return (
    <div className="flex flex-col items-center gap-7 px-4 py-6">
      <h2 className="font-mono text-game-lg text-content-primary">
        Доступ предоставлен
      </h2>

      <div className="flex w-full max-w-[400px] flex-col gap-5">
        {targetUrl ? (
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-game-sm text-content-secondary">Ссылка</span>
            <input
              readOnly
              value={targetUrl}
              aria-label="Ссылка на сайт"
              className={FIELD_CLASS}
            />
          </div>
        ) : null}

        {targetEmail ? (
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-game-sm text-content-secondary">Почта</span>
            <input
              readOnly
              value={targetEmail}
              aria-label="Логин"
              className={`${FIELD_CLASS} uppercase`}
            />
          </div>
        ) : null}

        {resultPassword ? (
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-game-sm text-content-secondary">Ключ</span>
            <div className="relative">
              <input
                readOnly
                type="password"
                value={resultPassword}
                aria-label="Пароль"
                className={`${FIELD_CLASS} pr-12`}
              />
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Копировать пароль"
                className="absolute right-3 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-game-sm text-accent transition-colors hover:text-accent/80"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>

              {copied ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-game-sm border border-border bg-bg-secondary px-2 py-1 font-mono text-game-xs text-content-primary shadow-game-card"
                >
                  <span>скопировано</span>
                  <button
                    type="button"
                    onClick={() => setCopied(false)}
                    aria-label="Закрыть"
                    className="flex size-7 items-center justify-center rounded-game-sm border border-border transition-colors hover:border-accent"
                  >
                    <Image src="/assets/icons/close.svg" alt="" width={16} height={16} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
