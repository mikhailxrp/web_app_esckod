'use client';

import { useEffect, useState } from 'react';

type HintState = 'loading' | 'active' | 'finished' | 'error';

interface HintData {
  text: string;
  orderIndex: number;
}

interface DetectiveHintsModalProps {
  onClose: () => void;
}

export function DetectiveHintsModal({ onClose }: DetectiveHintsModalProps): React.ReactElement {
  const [state, setState] = useState<HintState>('loading');
  const [hint, setHint] = useState<HintData | null>(null);

  const loadCurrent = async (): Promise<void> => {
    try {
      const res = await fetch('/api/hints/current');
      if (!res.ok) {
        console.error('Hint API error (current):', res.status, await res.text());
        setState('error');
        return;
      }
      const data = (await res.json()) as { isFinished: true } | { isFinished: false; hint: HintData };
      if (data.isFinished) {
        setState('finished');
      } else {
        setHint(data.hint);
        setState('active');
      }
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
      const data = (await res.json()) as { isFinished: true } | { isFinished: false; hint: HintData };
      if (data.isFinished) {
        setState('finished');
      } else {
        setHint(data.hint);
        setState('active');
      }
    } catch (err) {
      console.error('Network error (advance):', err);
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
        <div className="mb-5 flex items-center gap-2">
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
            Детектив
          </h2>
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
            <p className="mb-1 font-mono text-[11px] uppercase tracking-game-wide text-content-secondary">
              Подсказка #{hint.orderIndex}
            </p>
            <p className="mb-6 font-mono text-game-sm leading-relaxed text-content-primary">
              {hint.text}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleAdvance()}
                className="flex-1 rounded-game-full bg-accent px-4 py-2.5 font-accent text-game-sm uppercase tracking-game-wide text-content-inverse shadow-game-glow-sm transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
              >
                Далее
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-game-full border border-border bg-bg-secondary px-4 py-2.5 font-accent text-game-sm uppercase tracking-game-wide text-content-primary transition-colors hover:border-border-strong hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}

        {/* Finished */}
        {state === 'finished' && (
          <div>
            <p className="mb-2 font-accent text-game-sm uppercase tracking-game-wide text-accent">
              Подсказок больше нет
            </p>
            <p className="mb-6 font-mono text-game-sm text-content-muted">
              Вернитесь, когда Детектив подготовит что-то новое.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-game-full border border-border bg-bg-secondary px-4 py-2.5 font-accent text-game-sm uppercase tracking-game-wide text-content-primary transition-colors hover:border-border-strong hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
            >
              Закрыть
            </button>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div>
            <p className="mb-6 font-mono text-game-sm text-semantic-error" role="alert">
              Не удалось загрузить подсказку. Проверьте соединение.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setState('loading'); void loadCurrent(); }}
                className="flex-1 rounded-game-full bg-accent px-4 py-2.5 font-accent text-game-sm uppercase tracking-game-wide text-content-inverse shadow-game-glow-sm transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
              >
                Повторить
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-game-full border border-border bg-bg-secondary px-4 py-2.5 font-accent text-game-sm uppercase tracking-game-wide text-content-primary transition-colors hover:border-border-strong hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
