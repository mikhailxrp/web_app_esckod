'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';

const BLOCKED_CODES = new Set(['USER_BLOCKED', 'KEY_BLOCKED']);

/**
 * Глобальный перехватчик ответов API в игровой зоне.
 *
 * Если любой запрос вернул 403 с кодом блокировки (`USER_BLOCKED` / `KEY_BLOCKED`
 * из `lib/auth-guards.ts` → `requirePlayer`), значит администратор заблокировал
 * игрока или его ключ во время активной сессии. В этом случае выходим из аккаунта
 * (сбрасываем JWT-куку) и уводим на `/login?reason=blocked`, где показывается
 * сообщение «Вас заблокировал администратор».
 *
 * Перехват ставится один раз на всю игровую зону — это покрывает все вызовы
 * `fetch('/api/...')` без правок каждого места.
 */
export function BlockedSessionWatcher(): null {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let handled = false;

    window.fetch = async (
      ...args: Parameters<typeof window.fetch>
    ): Promise<Response> => {
      const response = await originalFetch(...args);

      if (response.status === 403 && !handled) {
        try {
          const data = (await response.clone().json()) as { error?: unknown };

          if (typeof data.error === 'string' && BLOCKED_CODES.has(data.error)) {
            handled = true;
            await signOut({ callbackUrl: '/login?reason=blocked' });
          }
        } catch {
          // Тело не JSON (или уже прочитано) — это не ответ о блокировке.
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
