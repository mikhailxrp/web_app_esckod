'use client';

import { useEffect, useState } from 'react';

import { useChatStore } from '@/store/chatStore';

interface Props {
  onOpen: (alreadySubmitted: boolean) => void;
}

interface AvailabilityData {
  available: boolean;
  alreadySubmitted: boolean;
}

export function FinalReportButton({ onOpen }: Props): React.ReactElement | null {
  const [data, setData] = useState<AvailabilityData | null>(null);
  const detectiveFinished = useChatStore((s) => s.detective.isFinished);

  useEffect(() => {
    async function fetchAvailability(): Promise<void> {
      try {
        const res = await fetch('/api/final-report/availability');
        if (!res.ok) return;
        const json = (await res.json()) as AvailabilityData;
        setData(json);
      } catch (err) {
        console.error('[FinalReportButton] availability fetch failed', err);
      }
    }
    void fetchAvailability();
  }, [detectiveFinished]);

  if (!data || (!data.available && !data.alreadySubmitted)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(data.alreadySubmitted)}
      className="mt-2 w-full rounded-game-lg border border-accent bg-accent/10 px-4 py-2.5 font-mono text-game-sm font-semibold uppercase tracking-widest text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {data.alreadySubmitted ? '[ Просмотр результата ]' : '[ Финальный отчёт ]'}
    </button>
  );
}
