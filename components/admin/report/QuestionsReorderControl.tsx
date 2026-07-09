'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { QuestionListItem } from '@/types/admin-report';

interface QuestionsReorderControlProps {
  question: QuestionListItem;
  questions: QuestionListItem[];
  onReordered: () => void;
  onError: (message: string) => void;
}

export function QuestionsReorderControl({
  question,
  questions,
  onReordered,
  onError,
}: QuestionsReorderControlProps): React.ReactElement {
  const [loading, setLoading] = useState(false);

  const index = questions.findIndex((item) => item.id === question.id);
  const isFirst = index === 0;
  const isLast = index === questions.length - 1;

  async function move(direction: 'up' | 'down'): Promise<void> {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const neighbour = questions[targetIndex];

    if (!neighbour) return;

    setLoading(true);

    try {
      const body: { id: string; newOrderIndex: number }[] = [
        { id: question.id, newOrderIndex: neighbour.orderIndex },
        { id: neighbour.id, newOrderIndex: question.orderIndex },
      ];

      const response = await fetch('/api/admin/report/questions/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        onError(data.message ?? 'Не удалось изменить порядок вопросов');
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
        className="rounded p-0.5 text-admin-label hover:bg-admin-nav-hover-bg hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Переместить вверх"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        onClick={() => void move('down')}
        disabled={isLast || loading}
        className="rounded p-0.5 text-admin-label hover:bg-admin-nav-hover-bg hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Переместить вниз"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}
