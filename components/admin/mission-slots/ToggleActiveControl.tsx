'use client';

import { useState } from 'react';
import type { MissionSlotListItem } from '@/types/admin-mission-slots';

interface ToggleActiveControlProps {
  slot: MissionSlotListItem;
  onToggled: () => void;
  onError: (message: string) => void;
}

export function ToggleActiveControl({
  slot,
  onToggled,
  onError,
}: ToggleActiveControlProps): React.ReactElement {
  const [loading, setLoading] = useState(false);

  async function handleClick(): Promise<void> {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/mission-slots/${slot.id}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !slot.isActive }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string; message?: string };

        if (data.error === 'LAST_ACTIVE_SLOT_OF_TYPE') {
          onError(
            data.message ??
              'Нельзя деактивировать последний активный слот этого типа. Сначала активируйте другой.',
          );
        } else {
          onError(data.message ?? 'Не удалось изменить статус слота');
        }
        return;
      }

      onToggled();
    } catch {
      onError('Не удалось выполнить запрос. Проверьте соединение.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      aria-label={slot.isActive ? 'Деактивировать слот' : 'Активировать слот'}
      className="disabled:opacity-50"
    >
      {slot.isActive ? (
        <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-300 dark:hover:bg-green-900/60">
          Активен
        </span>
      ) : (
        <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">
          Отключен
        </span>
      )}
    </button>
  );
}
