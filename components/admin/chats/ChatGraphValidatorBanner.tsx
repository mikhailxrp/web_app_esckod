'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { ChatGraphValidationResult } from '@/lib/admin/chatGraphValidator';

const CHAT_TYPE_LABELS = {
  DETECTIVE: 'Детектив',
  MARINA: 'Марина',
} as const;

export function ChatGraphValidatorBanner(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatGraphValidationResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchValidation(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/admin/chats/validate');

        if (!response.ok) {
          throw new Error('VALIDATION_REQUEST_FAILED');
        }

        const data = (await response.json()) as ChatGraphValidationResult;

        if (!cancelled) {
          setResult(data);
        }
      } catch {
        if (!cancelled) {
          setError('Не удалось проверить связность графа. Попробуйте обновить страницу.');
          setResult(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchValidation();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section
        aria-busy="true"
        aria-label="Проверка связности графа"
        className="mb-6 flex items-center gap-3 rounded-xl border border-admin-card-border bg-white px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        role="status"
      >
        <Loader2 size={16} className="animate-spin shrink-0" aria-hidden="true" />
        <span>Проверка связности графа…</span>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-live="polite"
        className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        role="alert"
      >
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>{error}</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section
        aria-live="polite"
        className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        role="alert"
      >
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>Не удалось получить результат проверки графа.</p>
      </section>
    );
  }

  if (result.valid) {
    return (
      <section
        aria-live="polite"
        className="mb-6 flex gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200"
        role="status"
      >
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
        <p>Граф связен — структурных проблем не обнаружено.</p>
      </section>
    );
  }

  return (
    <section
      aria-live="polite"
      className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
      role="alert"
    >
      <div className="mb-3 flex gap-3">
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="font-medium">
          Обнаружены проблемы связности графа ({result.issues.length})
        </p>
      </div>

      <ul className="ml-7 list-disc space-y-2">
        {result.issues.map((issue, index) => {
          const chatLabel = issue.chatType
            ? CHAT_TYPE_LABELS[issue.chatType]
            : null;
          const meta = [issue.type, chatLabel, issue.code].filter(Boolean).join(' · ');

          return (
            <li key={`${issue.type}-${issue.code ?? 'global'}-${index}`}>
              <span className="font-mono text-xs text-red-700 dark:text-red-300">{meta}</span>
              <span className="block">{issue.message}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
