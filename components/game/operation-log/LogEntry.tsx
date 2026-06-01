'use client';

import type { OperationLogEntry } from '@/store/logStore';

const LOG_TYPE_CLASS: Record<OperationLogEntry['type'], string> = {
  SUCCESS: 'text-green-400',
  ERROR: 'text-red-400',
  INFO: 'text-slate-400',
};

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

interface LogEntryProps {
  log: OperationLogEntry;
}

export function LogEntry({ log }: LogEntryProps): React.ReactElement {
  const timeLabel = timeFormatter.format(new Date(log.createdAt));

  return (
    <p className={`font-mono text-game-sm ${LOG_TYPE_CLASS[log.type]}`}>
      <span className="text-content-secondary">[{timeLabel}]</span> {log.message}
    </p>
  );
}
