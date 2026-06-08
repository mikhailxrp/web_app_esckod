'use client';

import type { ReactElement } from 'react';

import { toast } from '@/components/ui/Toast';

interface CrackCompletedViewProps {
  resultPassword: string | null;
  targetUrl: string | null;
  targetEmail: string | null;
}

export function CrackCompletedView({
  resultPassword,
  targetUrl,
  targetEmail,
}: CrackCompletedViewProps): ReactElement {
  const handleCopy = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Скопировано в буфер обмена.');
    } catch {
      toast.error('Не удалось скопировать.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-game-base text-semantic-success">
        Доступ получен.
      </p>

      <dl className="flex flex-col gap-3 font-mono text-game-sm">
        {targetUrl ? (
          <div className="flex flex-col gap-1">
            <dt className="text-content-muted">Сайт</dt>
            <dd className="text-content-primary">{targetUrl}</dd>
          </div>
        ) : null}

        {targetEmail ? (
          <div className="flex flex-col gap-1">
            <dt className="text-content-muted">Логин</dt>
            <dd className="text-content-primary">{targetEmail}</dd>
          </div>
        ) : null}

        {resultPassword ? (
          <div className="flex flex-col gap-1">
            <dt className="text-content-muted">Пароль</dt>
            <dd className="flex items-center gap-3">
              <span className="text-content-primary">{resultPassword}</span>
              <button
                type="button"
                onClick={() => handleCopy(resultPassword)}
                className="rounded-game-sm border border-border px-2 py-1 text-game-xs uppercase tracking-game-wide text-content-secondary transition-colors hover:border-accent hover:text-accent"
              >
                Копировать
              </button>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
