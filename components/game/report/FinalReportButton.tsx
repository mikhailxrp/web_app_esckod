"use client";

import { useEffect, useState } from "react";

import { useChatStore } from "@/store/chatStore";

interface Props {
  onOpen: (alreadySubmitted: boolean) => void;
}

interface AvailabilityData {
  available: boolean;
  alreadySubmitted: boolean;
}

export function FinalReportButton({
  onOpen,
}: Props): React.ReactElement | null {
  const [data, setData] = useState<AvailabilityData | null>(null);
  const detectiveFinished = useChatStore((s) => s.detective.isFinished);

  useEffect(() => {
    async function fetchAvailability(): Promise<void> {
      try {
        const res = await fetch("/api/final-report/availability");
        if (!res.ok) return;
        const json = (await res.json()) as AvailabilityData;
        setData(json);
      } catch (err) {
        console.error("[FinalReportButton] availability fetch failed", err);
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
      className="mt-2 flex w-full items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="flex h-[50px] min-w-0 flex-1 items-center justify-center rounded-[14px] bg-accent px-6 font-mono text-[20px] font-normal uppercase tracking-[0.04em] text-bg-primary">
        {data.alreadySubmitted ? "ПРОСМОТР РЕЗУЛЬТАТА" : "ФИНАЛЬНЫЙ ОТЧЕТ"}
      </span>
    </button>
  );
}
