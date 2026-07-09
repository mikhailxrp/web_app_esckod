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

  const TOP_PADDING = 24;
  const BOTTOM_PADDING = 36;
  const BAR_AREA_HEIGHT = 160;
  const CHART_HEIGHT = TOP_PADDING + BAR_AREA_HEIGHT + BOTTOM_PADDING;
  const AXIS_WIDTH = 42;
  const TICK_FONT_SIZE = 14;
  const BARS_AREA_WIDTH = 560;
  const barWidth = period === 'week' ? 36 : period === 'month' ? 10 : 22;
  const gap = data.length > 1 ? (BARS_AREA_WIDTH - data.length * barWidth) / (data.length - 1) : 0;
  const unit = barWidth + gap;
  const barsWidth = BARS_AREA_WIDTH;
  const totalWidth = AXIS_WIDTH + BARS_AREA_WIDTH;
  const BASE_Y_MAX = 30;
  const Y_STEP = 10;
  const chartMax = Math.max(BASE_Y_MAX, Math.ceil(maxCount / Y_STEP) * Y_STEP);
  const yTickValues = [3, 2, 1].map((m) => m * (chartMax / 3));

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
    <div className="p-7 bg-white rounded-xl border border-admin-card-border shadow-admin-card min-h-[300px]">
      <div className="flex items-start gap-8 h-full">
        <div className="w-[150px] shrink-0">
          <p className="text-[16px] font-semibold text-admin-input-text mb-10">Регистрации:</p>
          <div className="flex flex-col gap-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-[14px] text-left leading-tight transition-colors ${
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

        <svg
          width="100%"
          height={CHART_HEIGHT}
          viewBox={`0 0 ${totalWidth} ${CHART_HEIGHT}`}
          preserveAspectRatio="xMinYMin meet"
        >
          {yTickValues.map((tick) => {
            const y = TOP_PADDING + BAR_AREA_HEIGHT - (tick / chartMax) * BAR_AREA_HEIGHT;
            return (
              <g key={tick}>
                <text
                  x={AXIS_WIDTH - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={TICK_FONT_SIZE}
                  fill="#8B8B97"
                  fontFamily="system-ui, sans-serif"
                >
                  {tick}
                </text>
                <line
                  x1={AXIS_WIDTH + 4}
                  y1={y}
                  x2={AXIS_WIDTH + BARS_AREA_WIDTH}
                  y2={y}
                  stroke="#E8E8ED"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {data.map((item, i) => {
            const barHeight = Math.max((item.count / chartMax) * BAR_AREA_HEIGHT, item.count > 0 ? 3 : 0);
            const x = AXIS_WIDTH + i * unit;
            const y = TOP_PADDING + BAR_AREA_HEIGHT - barHeight;
            const highlighted = isHighlighted(i);

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 0)}
                  rx={period === 'month' ? 3 : 8}
                  fill={highlighted ? '#6E39CB' : '#C4B5FD'}
                />
                {showLabel(i) && (
                  <text
                    x={x + barWidth / 2}
                    y={CHART_HEIGHT - 6}
                    textAnchor="middle"
                    fontSize={period === 'month' ? 12 : 14}
                    fill="#8B8B97"
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
