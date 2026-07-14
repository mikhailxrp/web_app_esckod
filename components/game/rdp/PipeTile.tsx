'use client';

import { useRef, useState } from 'react';
import type { ReactElement } from 'react';

import type { Tile, TileType } from '@/lib/rdp/types';
import { HintTooltip } from '@/components/game/ui/HintTooltip';

/**
 * SVG-пути для каждого типа плитки при rotation=0.
 * CSS `transform: rotate(Ndeg)` используется для анимации поворота.
 *
 * Геометрия (viewBox 0 0 100 100):
 *   Центр = (50, 50)
 *   N-грань = (50, 0)   E-грань = (100, 50)
 *   S-грань = (50, 100)  W-грань = (0, 50)
 *
 * Трубы — линии от центра к серединам граней + дуги на углах.
 * strokeLinejoin="round" обеспечивает плавные соединения.
 */
const PIPE_PATH: Record<TileType, string> = {
  // Прямая: N→S (вертикальная полоса)
  STRAIGHT: 'M 50 0 L 50 100',
  // Угол: N→E (через центр)
  CORNER: 'M 50 0 L 50 50 L 100 50',
  // Тройник: E+S+W (горизонталь + вниз)
  TEE: 'M 0 50 L 100 50 M 50 50 L 50 100',
  // Крест: N+E+S+W
  CROSS: 'M 50 0 L 50 100 M 0 50 L 100 50',
  EMPTY: '',
};

const STROKE_WIDTH = 14;
const CENTER_R = 7;

/** Роль зафиксированной плитки на границе поля. */
export type EndpointRole = 'entry' | 'exit';

export interface PipeEndpoint {
  role: EndpointRole;
  /** Индекс линии (entries[i] ↔ exits[i]): 0 — линия 1, 1 — линия 2 (сц.2). */
  pairIndex: number;
}

/**
 * Цвет линии задается индексом пары: пара 0 — accent (teal), пара 1 — белый
 * (без рамки вокруг клетки). Классы статичные (purge-safe) — никакой
 * динамической интерполяции имен классов Tailwind.
 */
interface PairStyle {
  stroke: string;
  border: string;
  marker: string;
}

const PAIR_STYLES: readonly PairStyle[] = [
  { stroke: 'text-accent', border: 'border-accent', marker: 'text-accent' },
  { stroke: 'text-white', border: '', marker: 'text-white' },
];

const roleLabel: Record<EndpointRole, string> = {
  entry: 'входа',
  exit: 'выхода',
};

/** Пояснение по клику на зафиксированную точку входа/выхода — она не крутится. */
const LOCKED_ENDPOINT_HINT: Record<EndpointRole, string> = {
  entry: 'Точка закреплена — с неё начинается труба.',
  exit: 'Точка закреплена — сюда должна прийти труба.',
};

interface PipeTileProps {
  tile: Tile;
  onRotate: () => void;
  disabled: boolean;
  /** Если плитка — точка входа/выхода, подсвечивается цветом линии. */
  endpoint?: PipeEndpoint;
  /**
   * Маркеры входа/выхода — белые залитые точки (для сц.1, где линия одна и
   * цветовое кодирование пар не нужно). Иначе — цвет линии + форма по роли.
   */
  whiteMarker?: boolean;
}

export function PipeTile({
  tile,
  onRotate,
  disabled,
  endpoint,
  whiteMarker = false,
}: PipeTileProps): ReactElement {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [lockedHintRect, setLockedHintRect] = useState<DOMRect | null>(null);

  const isClickable = !tile.isLocked && !disabled && tile.type !== 'EMPTY';
  // Закрепленная точка входа/выхода — не крутится, но клик поясняет почему
  // (иначе выглядит как баг: игрок жмет на первый квадрат, ничего не происходит).
  const isLockedEndpoint = tile.isLocked && Boolean(endpoint);
  const path = PIPE_PATH[tile.type];

  const pairStyle = endpoint
    ? (PAIR_STYLES[endpoint.pairIndex] ?? PAIR_STYLES[0])
    : null;

  // Цвет трубы: эндпоинт — по линии, иначе teal (locked ярче, обычная — тусклее).
  const strokeColorClass = pairStyle
    ? pairStyle.stroke
    : tile.isLocked
      ? 'text-accent'
      : 'text-accent/80';

  const ariaLabel = endpoint
    ? `Точка ${roleLabel[endpoint.role]} линии ${endpoint.pairIndex + 1}`
    : `Плитка ${tile.id}, тип ${tile.type}, поворот ${tile.rotation}°`;

  const handleClick = (): void => {
    if (isClickable) {
      onRotate();
      return;
    }
    if (isLockedEndpoint) {
      setLockedHintRect((prev) => (prev ? null : (buttonRef.current?.getBoundingClientRect() ?? null)));
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={isClickable || isLockedEndpoint ? handleClick : undefined}
        disabled={!isClickable && !isLockedEndpoint}
        aria-label={ariaLabel}
        aria-disabled={(tile.isLocked && !isLockedEndpoint) || disabled || tile.type === 'EMPTY'}
        className={[
          'relative flex h-full w-full items-center justify-center rounded-sm border',
          'border-white/10 bg-bg-secondary/60',
          isClickable
            ? 'cursor-pointer transition-colors hover:border-accent/50 hover:bg-bg-card'
            : isLockedEndpoint
              ? 'cursor-not-allowed'
              : 'cursor-default',
          tile.isLocked && !pairStyle ? 'border-accent/30 bg-bg-card' : '',
          pairStyle ? `${pairStyle.border} bg-bg-card` : '',
          tile.type === 'EMPTY' ? 'opacity-20' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {path ? (
          <div
            className="absolute inset-0 transition-transform duration-200 ease-in-out"
            style={{ transform: `rotate(${tile.rotation}deg)` }}
          >
            <svg
              viewBox="0 0 100 100"
              width="100%"
              height="100%"
              aria-hidden="true"
              overflow="visible"
            >
              <path
                d={path}
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className={strokeColorClass}
              />
              {/* Центральный узел для визуального соединения */}
              <circle
                cx={50}
                cy={50}
                r={CENTER_R}
                fill="currentColor"
                className={strokeColorClass}
              />
            </svg>
          </div>
        ) : null}

        {/*
          Маркер точки — всегда залитый кружок (вход и выход). whiteMarker (сц.1):
          белый. Иначе (сц.2): цвет = линия (пара 0 — teal, пара 1 — белый).
          Роль вход/выход различается позицией (сверху/снизу).
        */}
        {endpoint && pairStyle ? (
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none absolute left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full',
              endpoint.role === 'entry' ? '-top-1.5' : '-bottom-1.5',
              whiteMarker ? 'bg-white' : `bg-current ${pairStyle.marker}`,
            ].join(' ')}
          />
        ) : null}
      </button>

      {lockedHintRect && endpoint ? (
        <HintTooltip
          text={LOCKED_ENDPOINT_HINT[endpoint.role]}
          anchorRect={lockedHintRect}
          onClose={() => setLockedHintRect(null)}
        />
      ) : null}
    </>
  );
}
