'use client';

interface StatusItem {
  label: string;
  value: string;
}

interface StatusBarProps {
  targetName: string;
}

export function StatusBar({ targetName }: StatusBarProps): React.ReactElement {
  const STATUS_ITEMS: StatusItem[] = [
    { label: 'СТАТУС', value: 'АКТИВЕН' },
    { label: 'ЦЕЛЬ', value: targetName },
    { label: 'ДОСТУП', value: 'ПОДКЛЮЧЕНО' },
  ];

  return (
    <div
      className="flex flex-col gap-1 rounded-game-md border border-border bg-bg-secondary px-4 py-3"
      role="status"
      aria-label="Статус соединения"
    >
      {STATUS_ITEMS.map(({ label, value }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-16 font-mono text-game-sm uppercase tracking-game-wider text-content-secondary">
            {label}
          </span>
          <span className="font-mono text-game-sm text-content-muted">|</span>
          <span className="font-mono text-game-sm uppercase tracking-game-wide text-accent">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}
