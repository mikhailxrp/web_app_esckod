'use client';

interface StatusItem {
  label: string;
  value: string;
}

interface StatusBarProps {
  playerLogin: string;
  progressTotal: number;
  progressCompleted: number;
}

export function StatusBar({
  playerLogin,
  progressTotal,
  progressCompleted,
}: StatusBarProps): React.ReactElement {
  const STATUS_ITEMS: StatusItem[] = [
    { label: 'АГЕНТ', value: playerLogin },
    { label: 'СТАТУС', value: 'АКТИВЕН' },
    { label: 'ДОСТУП', value: 'ПОДКЛЮЧЕНО' },
  ];

  const percent = progressTotal > 0
    ? Math.round((progressCompleted / progressTotal) * 100)
    : 0;

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

      {/* Progress row */}
      <div className="flex items-center gap-3 pt-0.5">
        <span className="w-16 font-mono text-game-sm uppercase tracking-game-wider text-content-secondary">
          ПРОГРЕСС
        </span>
        <span className="font-mono text-game-sm text-content-muted">|</span>
        <div className="flex flex-1 items-center gap-2">
          <div
            className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Прогресс: ${progressCompleted} из ${progressTotal} миссий`}
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="font-mono text-game-sm text-accent tabular-nums">
            {percent}%
          </span>
          <span className="font-mono text-game-xs text-content-muted tabular-nums">
            {progressCompleted}/{progressTotal}
          </span>
        </div>
      </div>
    </div>
  );
}
