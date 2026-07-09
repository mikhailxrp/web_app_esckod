'use client';

interface StatusItem {
  label: string;
  value: string;
}

interface StatusBarProps {
  playerLogin: string;
}

const STATUS_CONNECTED = 'СОЕДИНЕНО';
const TARGET_SERVER = 'ESC-СЕРВЕР';

const LABEL_CLASS =
  'w-[4.5rem] shrink-0 font-mono text-game-base uppercase text-accent';
const VALUE_CLASS = 'font-mono text-game-base uppercase text-white';
const SEPARATOR_CLASS = 'inline-block h-[14px] w-[2px] shrink-0 bg-accent';
const ROW_CLASS = 'flex items-center gap-2 py-1.5';
const ROW_BORDER_CLASS = 'border-b border-white';

export function StatusBar({ playerLogin }: StatusBarProps): React.ReactElement {
  const STATUS_ITEMS: StatusItem[] = [
    { label: 'СТАТУС', value: STATUS_CONNECTED },
    { label: 'ЦЕЛЬ', value: TARGET_SERVER },
    { label: 'ДОСТУП', value: playerLogin },
  ];

  return (
    <div className="pb-3" role="status" aria-label="Статус соединения">
      {STATUS_ITEMS.map(({ label, value }, index) => (
        <div
          key={label}
          className={`${ROW_CLASS}${index < STATUS_ITEMS.length - 1 ? ` ${ROW_BORDER_CLASS}` : ''}`}
        >
          <span className={LABEL_CLASS}>{label}</span>
          <span className={SEPARATOR_CLASS} aria-hidden="true" />
          <span className={VALUE_CLASS}>{value}</span>
        </div>
      ))}
    </div>
  );
}
