'use client';

import { useEffect, useState } from 'react';

type HintState = 'loading' | 'active' | 'finished' | 'error';

interface HintData {
  text: string;
  orderIndex: number;
}

interface ApiResponse {
  isFinished: boolean;
  hint?: HintData;
  canGoBack: boolean;
}

interface DetectiveHintsModalProps {
  onClose: () => void;
}

export function DetectiveHintsModal({ onClose }: DetectiveHintsModalProps): React.ReactElement {
  const [state, setState] = useState<HintState>('loading');
  const [hint, setHint] = useState<HintData | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  const applyResponse = (data: ApiResponse): void => {
    setCanGoBack(data.canGoBack);
    if (data.isFinished) {
      setState('finished');
    } else if (data.hint) {
      setHint(data.hint);
      setState('active');
    }
  };

  const loadCurrent = async (): Promise<void> => {
    try {
      const res = await fetch('/api/hints/current');
      if (!res.ok) {
        console.error('Hint API error (current):', res.status, await res.text());
        setState('error');
        return;
      }
      applyResponse((await res.json()) as ApiResponse);
    } catch (err) {
      console.error('Network error (current):', err);
      setState('error');
    }
  };

  const handleAdvance = async (): Promise<void> => {
    setState('loading');
    try {
      const res = await fetch('/api/hints/advance', { method: 'POST' });
      if (!res.ok) {
        console.error('Hint API error (advance):', res.status, await res.text());
        setState('error');
        return;
      }
      applyResponse((await res.json()) as ApiResponse);
    } catch (err) {
      console.error('Network error (advance):', err);
      setState('error');
    }
  };

  const handleRewind = async (): Promise<void> => {
    setState('loading');
    try {
      const res = await fetch('/api/hints/rewind', { method: 'POST' });
      if (!res.ok) {
        console.error('Hint API error (rewind):', res.status, await res.text());
        setState('error');
        return;
      }
      applyResponse((await res.json()) as ApiResponse);
    } catch (err) {
      console.error('Network error (rewind):', err);
      setState('error');
    }
  };

  useEffect(() => {
    // Async fetch on mount — setState calls inside loadCurrent happen after awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCurrent();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 px-4 animate-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Подсказки Детектива"
    >
      <div className="w-full max-w-md rounded-game-lg border border-border bg-bg-card p-6 shadow-game-glow-sm animate-modal-panel">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Иконка-лампочка */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-accent"
              aria-hidden="true"
            >
              <path d="M9 21h6" />
              <path d="M12 3a6 6 0 0 1 6 6c0 2.22-1.21 4.16-3 5.2V17H9v-2.8C7.21 13.16 6 11.22 6 9a6 6 0 0 1 6-6z" />
            </svg>
            <h2 className="font-accent text-game-sm uppercase tracking-game-wide text-content-primary">
              Подсказка
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex size-7 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-bg-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        </div>

        {/* Loading */}
        {state === 'loading' && (
          <div
            className="flex items-center justify-center py-10"
            role="status"
            aria-label="Загрузка подсказки"
          >
            <span
              className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent"
              aria-hidden="true"
            />
          </div>
        )}

        {/* Active hint */}
        {state === 'active' && hint !== null && (
          <div>
            <p className="mb-1 font-mono text-[13px] uppercase tracking-game-wide text-content-secondary">
              #{hint.orderIndex}
            </p>
            <p className="mb-6 font-mono text-[14px] leading-relaxed text-content-primary">
              {hint.text}
            </p>
            <div className="flex gap-3">
              {canGoBack && (
                <button
                  type="button"
                  onClick={() => void handleRewind()}
                  className="flex-1 rounded-game-full border border-border bg-bg-secondary px-4 py-2.5 font-accent text-game-sm uppercase tracking-game-wide text-content-primary transition-colors hover:border-border-strong hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
                >
                  Назад
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleAdvance()}
                className="flex-1 rounded-game-full bg-accent px-4 py-2.5 font-accent text-game-sm uppercase tracking-game-wide text-content-inverse shadow-game-glow-sm transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
              >
                Далее
              </button>
            </div>
          </div>
        )}

        {/* Finished */}
        {state === 'finished' && (
          <div>
            <p className="mb-6 font-mono text-[14px] leading-relaxed text-content-primary">
              Сдайте финальный отчет, у вас есть вся необходимая информация.
            </p>
            {canGoBack && (
              <button
                type="button"
                onClick={() => void handleRewind()}
                className="flex w-full items-center justify-center gap-2 rounded-game-full border border-border bg-bg-secondary px-4 py-2.5 font-accent text-game-sm uppercase tracking-game-wide text-content-primary transition-colors hover:border-border-strong hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Назад
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div>
            <p className="mb-6 font-mono text-game-sm text-semantic-error" role="alert">
              Не удалось загрузить подсказку. Проверьте соединение.
            </p>
            <button
              type="button"
              onClick={() => { setState('loading'); void loadCurrent(); }}
              className="w-full rounded-game-full bg-accent px-4 py-2.5 font-accent text-game-sm uppercase tracking-game-wide text-content-inverse shadow-game-glow-sm transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
            >
              Повторить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
