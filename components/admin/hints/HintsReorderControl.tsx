'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { HintListItem } from '@/types/admin-hints';

interface HintsReorderControlProps {
  hint: HintListItem;
  hints: HintListItem[];
  onReordered: () => void;
  onError: (message: string) => void;
}

export function HintsReorderControl({
  hint,
  hints,
  onReordered,
  onError,
}: HintsReorderControlProps): React.ReactElement {
  const [loading, setLoading] = useState(false);

  const index = hints.findIndex((h) => h.id === hint.id);
  const isFirst = index === 0;
  const isLast = index === hints.length - 1;

  async function move(direction: 'up' | 'down'): Promise<void> {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const neighbour = hints[targetIndex];

    if (!neighbour) return;

    setLoading(true);

    try {
      const body: { id: string; newOrderIndex: number }[] = [
        { id: hint.id, newOrderIndex: neighbour.orderIndex },
        { id: neighbour.id, newOrderIndex: hint.orderIndex },
      ];

      const response = await fetch('/api/admin/hints/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        onError(data.message ?? 'Не удалось изменить порядок подсказок');
        return;
      }

      onReordered();
    } catch {
      onError('Не удалось выполнить запрос. Проверьте соединение.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => void move('up')}
        disabled={isFirst || loading}
        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        aria-label="Переместить вверх"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        onClick={() => void move('down')}
        disabled={isLast || loading}
        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        aria-label="Переместить вниз"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}
