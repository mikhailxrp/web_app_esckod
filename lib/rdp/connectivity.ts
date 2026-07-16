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
 * Соединена ли конкретная пара вход→выход через цепочку встречных коннекторов.
 * BFS от входа; учитываются только взаимные стыки (как в серверном solver'е).
 * Зеркало `checkSolution` для одной пары — корректно при наличии decoy-обманок
 * (мусор не входит в компоненту входа, т.к. путь не указывает на него).
 */
function isPairConnected(
  field: PuzzleField,
  entry: { row: number; col: number },
  exit: { row: number; col: number },
): boolean {
  const startTile = tileAt(field, entry.row, entry.col);
  if (!startTile || startTile.type === 'EMPTY') return false;

  const visited = new Set<string>([startTile.id]);
  const queue: Array<{ row: number; col: number }> = [entry];

  let head = 0;
  while (head < queue.length) {
    const { row, col } = queue[head++];
    if (row === exit.row && col === exit.col) return true;

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

  return false;
}

/**
 * Вычисляет прогресс связности пазла (0..1).
 *
 * Метрика зависит от числа линий:
 * - 1 линия (сц.1, может содержать decoy-обманки) — доля клеток пути (непустые
 *   плитки), достижимых BFS от входа, среди `pathTileCount` — суммарной длины
 *   «настоящего» пути без decoy-обманок (обманки в этот путь не входят, см.
 *   `pipesPuzzleGenerator.ts`). Если `pathTileCount` не задан (старое
 *   сохраненное поле или demo-фикстура без него) — используем факт соединения
 *   пары: 0 или 1.
 * - ≥2 линий (сц.2, без обманок) — плавная метрика: доля достижимых непустых
 *   плиток (все непустые плитки лежат на путях).
 */
export function computePuzzleProgress(field: PuzzleField): number {
  const pairs = field.entries.length;
  if (pairs === 0) return 1;

  if (pairs === 1) {
    if (!field.pathTileCount) {
      return isPairConnected(field, field.entries[0], field.exits[0]) ? 1 : 0;
    }

    const reachable = bfsReachable(field);
    return Math.min(1, reachable.size / field.pathTileCount);
  }

  const nonEmpty = field.tiles.filter((t) => t.type !== 'EMPTY');
  if (nonEmpty.length === 0) return 1;

  const reachable = bfsReachable(field);
  return reachable.size / nonEmpty.length;
}

/**
 * Возвращает true, если КАЖДАЯ пара вход→выход соединена (зеркало серверного
 * `checkSolution`). Не опирается на «все непустые плитки на пути» — поэтому
 * корректно при наличии decoy-обманок (сц.1).
 */
export function isLocallySolved(field: PuzzleField): boolean {
  if (field.entries.length === 0 || field.entries.length !== field.exits.length) {
    return false;
  }

  return field.entries.every((entry, index) =>
    isPairConnected(field, entry, field.exits[index]),
  );
}
