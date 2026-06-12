/**
 * Клиент-безопасный модуль: вычисление связности пазла-трубопровода.
 * Без импортов server-only. Переиспользует TILE_CONNECTORS из types.ts.
 */

import type { Direction, PuzzleField, Tile, TileRotation } from './types';
import { TILE_CONNECTORS } from './types';

const OPPOSITE: Record<Direction, Direction> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
};

const DELTA: Record<Direction, { dr: number; dc: number }> = {
  N: { dr: -1, dc: 0 },
  S: { dr: 1, dc: 0 },
  E: { dr: 0, dc: 1 },
  W: { dr: 0, dc: -1 },
};

function getConnectors(tile: Tile): Direction[] {
  return TILE_CONNECTORS[tile.type][tile.rotation as TileRotation] ?? [];
}

function tileAt(field: PuzzleField, row: number, col: number): Tile | undefined {
  if (row < 0 || row >= field.gridSize || col < 0 || col >= field.gridSize) return undefined;
  return field.tiles[row * field.gridSize + col];
}

/**
 * BFS от всех entry-плиток по совпадающим коннекторам.
 * Возвращает множество id достижимых непустых плиток.
 */
function bfsReachable(field: PuzzleField): Set<string> {
  const visited = new Set<string>();
  const queue: Array<{ row: number; col: number }> = [];

  for (const entry of field.entries) {
    const tile = tileAt(field, entry.row, entry.col);
    if (tile && tile.type !== 'EMPTY' && !visited.has(tile.id)) {
      visited.add(tile.id);
      queue.push(entry);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const { row, col } = queue[head++];
    const tile = tileAt(field, row, col);
    if (!tile) continue;

    for (const dir of getConnectors(tile)) {
      const { dr, dc } = DELTA[dir];
      const nr = row + dr;
      const nc = col + dc;
      const neighbor = tileAt(field, nr, nc);
      if (!neighbor || neighbor.type === 'EMPTY' || visited.has(neighbor.id)) continue;

      if (getConnectors(neighbor).includes(OPPOSITE[dir])) {
        visited.add(neighbor.id);
        queue.push({ row: nr, col: nc });
      }
    }
  }

  return visited;
}

/**
 * Вычисляет прогресс связности пазла.
 * Метрика: BFS-достижимые непустые плитки / все непустые плитки.
 * Возвращает значение от 0 до 1.
 */
export function computePuzzleProgress(field: PuzzleField): number {
  const nonEmpty = field.tiles.filter((t) => t.type !== 'EMPTY');
  if (nonEmpty.length === 0) return 1;

  const reachable = bfsReachable(field);
  return reachable.size / nonEmpty.length;
}

/**
 * Возвращает true, если все непустые плитки достижимы из entry И все exits достижимы.
 * По инварианту генератора (все непустые плитки — на пути), 100% связность = решено.
 */
export function isLocallySolved(field: PuzzleField): boolean {
  const nonEmpty = field.tiles.filter((t) => t.type !== 'EMPTY');
  if (nonEmpty.length === 0) return false;

  const reachable = bfsReachable(field);

  if (reachable.size !== nonEmpty.length) return false;

  for (const exit of field.exits) {
    const tile = tileAt(field, exit.row, exit.col);
    if (!tile || !reachable.has(tile.id)) return false;
  }

  return true;
}
