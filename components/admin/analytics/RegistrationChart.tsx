'use client';

import { useState } from 'react';

type Period = 'week' | 'month' | 'year';

export type DayData = { label: string; count: number };

interface RegistrationChartProps {
  week: DayData[];
  month: DayData[];
  year: DayData[];
}

const PERIOD_LABELS: Record<Period, string> = {
  week: 'за неделю',
  month: 'за месяц',
  year: 'за год',
};

export function RegistrationChart({ week, month, year }: RegistrationChartProps): React.ReactElement {
  const [period, setPeriod] = useState<Period>('week');

  const data = period === 'week' ? week : period === 'month' ? month : year;
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const BAR_AREA_HEIGHT = 120;
  const LABEL_HEIGHT = 20;
  const CHART_HEIGHT = BAR_AREA_HEIGHT + LABEL_HEIGHT;
  const barWidth = period === 'month' ? 7 : 24;
  const gap = period === 'month' ? 5 : 8;
  const unit = barWidth + gap;
  const totalWidth = data.length * unit;

  const showLabel = (i: number): boolean => {
    if (period === 'week') return true;
    if (period === 'month') return i === 0 || (i + 1) % 5 === 0;
    return true;
  };

  const today = new Date();
  const currentDayIndex = (() => {
    const dow = today.getDay();
    return dow === 0 ? 6 : dow - 1;
  })();
  const currentMonthDay = today.getDate() - 1;
  const currentMonth = today.getMonth();

  const isHighlighted = (i: number): boolean => {
    if (period === 'week') return i === currentDayIndex;
    if (period === 'month') return i === currentMonthDay;
    return i === currentMonth;
  };

  return (
    <div className="p-6 bg-white rounded-xl border border-admin-card-border shadow-admin-card h-full">
      <div className="flex items-start justify-between mb-5">
        <p className="text-[16px] font-semibold text-admin-input-text">Регистрации:</p>
        <div className="flex flex-col gap-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[14px] text-right leading-tight transition-colors ${
                period === p
                  ? 'text-admin-accent font-medium underline underline-offset-2'
                  : 'text-admin-label hover:text-admin-accent'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          width="100%"
          height={CHART_HEIGHT}
          viewBox={`0 0 ${totalWidth} ${CHART_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {data.map((item, i) => {
            const barHeight = maxCount > 0 ? Math.max((item.count / maxCount) * BAR_AREA_HEIGHT, item.count > 0 ? 3 : 0) : 0;
            const x = i * unit;
            const y = BAR_AREA_HEIGHT - barHeight;
            const highlighted = isHighlighted(i);

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 0)}
                  rx={period === 'month' ? 2 : 4}
                  fill={highlighted ? '#6E39CB' : '#C4B5FD'}
                />
                {showLabel(i) && (
                  <text
                    x={x + barWidth / 2}
                    y={CHART_HEIGHT - 2}
                    textAnchor="middle"
                    fontSize={period === 'month' ? 12 : 14}
                    fill="#9CA3AF"
                    fontFamily="system-ui, sans-serif"
                  >
                    {item.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
