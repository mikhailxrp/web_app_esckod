'use client';

import type { OperationLogEntry } from '@/store/logStore';

const LOG_TYPE_CLASS: Record<OperationLogEntry['type'], string> = {
  SUCCESS: 'text-green-400',
  ERROR: 'text-red-400',
  INFO: 'text-white',
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
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 font-mono text-[15px] leading-[19px] tracking-[0.04em]">
      <span className="tabular-nums text-[#44DFD7]">{timeLabel}</span>
      <span
        className="block h-px w-full bg-[repeating-linear-gradient(to_right,rgba(255,255,255,0.3)_0,rgba(255,255,255,0.3)_10px,transparent_10px,transparent_16px)]"
        aria-hidden="true"
      />
      <span className={`justify-self-end text-right ${LOG_TYPE_CLASS[log.type]}`}>
        {log.message}
      </span>
    </div>
  );
}
