/**
 * Solver пазла-трубопровода RDP-миссии (чистый серверный TS).
 *
 * Проверяет, соединена ли каждая точка входа со своей парной точкой выхода
 * (для сценария 2 — обе пары). Без DOM, без БД, без сетевого слоя.
 *
 * Источник правды для коннекторов плитки — `TILE_CONNECTORS` из `./types`.
 * Публичный API НЕ возвращает «правильную ориентацию» — только boolean.
 */

import type {
  Direction,
  GridPosition,
  PuzzleField,
  Tile,
  TileRotation,
  TileType,
} from './types';
import { TILE_CONNECTORS } from './types';

/** Противоположное направление (для проверки встречных коннекторов). */
const OPPOSITE: Record<Direction, Direction> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
};

/** Смещение (row, col) при движении в направлении. N=верх, E=право, S=низ, W=лево. */
const DELTA: Record<Direction, { dr: number; dc: number }> = {
  N: { dr: -1, dc: 0 },
  E: { dr: 0, dc: 1 },
  S: { dr: 1, dc: 0 },
  W: { dr: 0, dc: -1 },
};

/**
 * Активные направления коннекторов плитки по её `type` + `rotation`.
 * Тонкая обёртка над `TILE_CONNECTORS` — единственный способ читать коннекторы
 * в генераторе и solver'е, чтобы конвенция не дублировалась.
 */
export const getTileConnectors = (
  type: TileType,
  rotation: TileRotation,
): Direction[] => TILE_CONNECTORS[type][rotation] ?? [];

const tileId = (row: number, col: number): string => `r${row}c${col}`;

/**
 * Проверка решения: каждая `entries[i]` достигает своей `exits[i]` через
 * цепочку встречных коннекторов (восток клетки ↔ запад соседа, юг ↔ север).
 *
 * Коннектор, смотрящий за границу сетки, соединением не считается.
 * Для сценария 2 обе пары проверяются независимо; «ложная пара» (entry A
 * достигает только чужого exit) → `false`, т.к. свой exit недостижим.
 */
export const checkSolution = (field: PuzzleField): boolean => {
  const { gridSize, tiles, entries, exits } = field;

  if (entries.length !== exits.length) {
    return false;
  }

  const byId = new Map<string, Tile>();
  for (const tile of tiles) {
    byId.set(tile.id, tile);
  }

  const connectorsAt = (row: number, col: number): Direction[] => {
    const tile = byId.get(tileId(row, col));
    return tile ? getTileConnectors(tile.type, tile.rotation) : [];
  };

  const inBounds = (row: number, col: number): boolean =>
    row >= 0 && row < gridSize && col >= 0 && col < gridSize;

  const reaches = (start: GridPosition, goal: GridPosition): boolean => {
    const visited = new Set<string>([tileId(start.row, start.col)]);
    const stack: GridPosition[] = [start];

    while (stack.length > 0) {
      const current = stack.pop() as GridPosition;
      if (current.row === goal.row && current.col === goal.col) {
        return true;
      }

      for (const dir of connectorsAt(current.row, current.col)) {
        const { dr, dc } = DELTA[dir];
        const nextRow = current.row + dr;
        const nextCol = current.col + dc;

        if (!inBounds(nextRow, nextCol)) {
          continue;
        }
        // Соединение есть только при встречном коннекторе у соседа.
        if (!connectorsAt(nextRow, nextCol).includes(OPPOSITE[dir])) {
          continue;
        }

        const key = tileId(nextRow, nextCol);
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);
        stack.push({ row: nextRow, col: nextCol });
      }
    }

    return false;
  };

  return entries.every((entry, index) => reaches(entry, exits[index]));
};
