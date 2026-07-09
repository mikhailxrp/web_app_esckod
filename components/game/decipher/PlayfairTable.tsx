'use client';

import type { ReactElement } from 'react';

interface PlayfairTableProps {
  table: string[][];
  onLetterClick?: (letter: string) => void;
}

export function PlayfairTable({ table, onLetterClick }: PlayfairTableProps): ReactElement {
  const visibleRows = table.filter((row) => row.some((cell) => cell !== ''));

  return (
    <div
      role="grid"
      aria-label="Таблица Playfair"
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${table[0]?.length ?? 6}, 60px)` }}
    >
      {visibleRows.map((row, rowIdx) =>
        row.map((letter, colIdx) => {
          const isEmpty = letter === '';
          const key = `${rowIdx}-${colIdx}`;

          if (isEmpty) {
            return (
              <div
                key={key}
                aria-hidden="true"
                className="size-[60px] rounded-game-sm border border-white/30"
              />
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => onLetterClick?.(letter)}
              aria-label={`Буква ${letter}`}
              className="size-[60px] rounded-game-sm border border-white/30 font-mono text-[20px] font-medium text-accent transition-colors hover:bg-white/5 active:scale-95"
            >
              {letter}
            </button>
          );
        }),
      )}
    </div>
  );
}
