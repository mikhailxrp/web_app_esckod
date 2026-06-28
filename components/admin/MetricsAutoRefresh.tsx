'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Мягко обновляет серверные данные страницы Метрик через router.refresh()
 * раз в минуту. Пере-рендерит RSC без полной перезагрузки страницы и без
 * сброса клиентского состояния. Работает только при активной вкладке —
 * когда вкладка скрыта, обновления не выполняются, чтобы не нагружать БД.
 */
export function MetricsAutoRefresh(): null {
  const router = useRouter();

  useEffect(() => {
    const tick = (): void => {
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    };

    const id = window.setInterval(tick, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [router]);

  return null;
}
