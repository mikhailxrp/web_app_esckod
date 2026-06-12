'use client';

import type { ReactElement } from 'react';

import type { Tile, TileType } from '@/lib/rdp/types';

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

interface PipeTileProps {
  tile: Tile;
  onRotate: () => void;
  disabled: boolean;
}

export function PipeTile({ tile, onRotate, disabled }: PipeTileProps): ReactElement {
  const isClickable = !tile.isLocked && !disabled && tile.type !== 'EMPTY';
  const path = PIPE_PATH[tile.type];

  return (
    <button
      type="button"
      onClick={isClickable ? onRotate : undefined}
      disabled={!isClickable}
      aria-label={`Плитка ${tile.id}, тип ${tile.type}, поворот ${tile.rotation}°`}
      aria-disabled={tile.isLocked || disabled || tile.type === 'EMPTY'}
      className={[
        'relative flex h-full w-full items-center justify-center rounded-sm border',
        'border-white/10 bg-bg-secondary/60',
        isClickable
          ? 'cursor-pointer transition-colors hover:border-accent/50 hover:bg-bg-card'
          : 'cursor-default',
        tile.isLocked ? 'border-accent/30 bg-bg-card' : '',
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
              className={tile.isLocked ? 'text-accent' : 'text-accent/80'}
            />
            {/* Центральный узел для визуального соединения */}
            <circle
              cx={50}
              cy={50}
              r={CENTER_R}
              fill="currentColor"
              className={tile.isLocked ? 'text-accent' : 'text-accent/80'}
            />
          </svg>
        </div>
      ) : null}
    </button>
  );
}
