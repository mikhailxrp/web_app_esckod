'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { LogEntry } from '@/components/game/operation-log/LogEntry';
import { useLogStore } from '@/store/logStore';

export function OperationHistory(): React.ReactElement {
  const logs = useLogStore((state) => state.logs);
  const refreshLogs = useLogStore((state) => state.refreshLogs);

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);

  return (
    <section
      className="flex h-[320px] flex-col rounded-game-lg border border-border px-5 py-4"
      aria-label="История действий"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <Image
          src="/assets/img/icon/history-icon.svg"
          alt=""
          width={24}
          height={24}
          aria-hidden="true"
        />
        <h2 className="font-mono text-game-panel uppercase tracking-game-wide text-accent">
          История действий
        </h2>
      </div>

      <div className="log-scrollbar flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="font-mono text-game-sm text-content-muted" role="status">
            Нет записей
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {logs.map((log) => (
              <li key={log.id}>
                <LogEntry log={log} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
