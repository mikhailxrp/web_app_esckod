'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: ErrorProps): React.ReactElement {
  useEffect(() => {
    console.error('[AdminError]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-admin-input-text">
          Что-то пошло не так
        </h2>
        <p className="text-sm text-admin-label">
          Произошла ошибка при загрузке страницы. Попробуйте обновить или
          вернитесь на главную.
        </p>
        {error.digest && (
          <p className="text-xs text-admin-placeholder font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-admin-accent text-white text-sm font-medium hover:bg-admin-accent-hover transition-colors"
        >
          Попробовать снова
        </button>
        <Link
          href="/admin"
          className="px-4 py-2 rounded-lg border border-admin-card-border text-sm font-medium text-admin-nav-text hover:bg-admin-nav-hover-bg transition-colors"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
