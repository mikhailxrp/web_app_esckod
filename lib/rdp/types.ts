/**
 * Серверные типы и конвенции для пазла-трубопровода RDP-миссии.
 *
 * Только типы и константы — никаких runtime-зависимостей. Этот файл —
 * единственный источник правды для конвенции поворотов (`TILE_CONNECTORS`),
 * используемой и в генераторе (`pipesPuzzleGenerator.ts`, Task 2),
 * и в solver'е (`pipesSolver.ts`, Task 2).
 *
 * Конвенция направлений:
 *   N = верх, E = право, S = низ, W = лево.
 */

export type Direction = 'N' | 'E' | 'S' | 'W';

/** Номер сценария RDP-миссии (1 — один путь 6×6, 2 — два пути 7×7). */
export type Scenario = 1 | 2;

export type TileType = 'STRAIGHT' | 'CORNER' | 'TEE' | 'CROSS' | 'EMPTY';

export type TileRotation = 0 | 90 | 180 | 270;

export interface Tile {
  /** Идентификатор вида 'r{row}c{col}', например 'r0c0'. */
  id: string;
  type: TileType;
  rotation: TileRotation;
  /** Плитки entry/exit фиксированы — не кликабельны и не перемешиваются. */
  isLocked: boolean;
}

export interface GridPosition {
  row: number;
  col: number;
}

export interface PuzzleField {
  /** 6 (сценарий 1) или 7 (сценарий 2). */
  gridSize: number;
  /** Длина массива = gridSize * gridSize. */
  tiles: Tile[];
  /** Точки входа (isLocked=true). */
  entries: GridPosition[];
  /** Точки выхода (isLocked=true). */
  exits: GridPosition[];
}

/**
 * Маппинг (type, rotation) → активные направления коннекторов.
 *
 * Единственный источник правды для генерации и проверки решения.
 * Все 4 поворота заданы для STRAIGHT/CORNER/TEE, чтобы поворот плитки на +90°
 * (`POST /rotate-tile`) всегда имел корректный результат по модулю 360°.
 *
 * Конвенция (см. шапку файла):
 *   STRAIGHT: 0/180 → N+S, 90/270 → E+W
 *   CORNER:   0 → N+E, 90 → E+S, 180 → S+W, 270 → W+N
 *   TEE:      0 → E+S+W, 90 → N+S+W, 180 → N+E+W, 270 → N+E+S
 *
 * CROSS присутствует в union для расширяемости, но НЕ используется в MVP —
 * генератор его не создаёт.
 */
export const TILE_CONNECTORS: Record<
  TileType,
  Partial<Record<TileRotation, Direction[]>>
> = {
  STRAIGHT: {
    0: ['N', 'S'],
    90: ['E', 'W'],
    180: ['N', 'S'],
    270: ['E', 'W'],
  },
  CORNER: {
    0: ['N', 'E'],
    90: ['E', 'S'],
    180: ['S', 'W'],
    270: ['W', 'N'],
  },
  TEE: {
    0: ['E', 'S', 'W'],
    90: ['N', 'S', 'W'],
    180: ['N', 'E', 'W'],
    270: ['N', 'E', 'S'],
  },
  // Не используется в MVP — генератор CROSS не создаёт.
  CROSS: {
    0: ['N', 'E', 'S', 'W'],
    90: ['N', 'E', 'S', 'W'],
    180: ['N', 'E', 'S', 'W'],
    270: ['N', 'E', 'S', 'W'],
  },
  EMPTY: {},
};

/**
 * Зафиксированные координаты entry/exit для обоих сценариев (output Task 1).
 * Блокируют Task 2 — без явных позиций генератор и solver несовместимы.
 *
 * Сценарий 1 (6×6): один путь из верхнего левого угла в нижний правый.
 * Сценарий 2 (7×7): два вершинно-непересекающихся пути — вертикальные коридоры
 *   (верх-лево → низ-лево и верх-право → низ-право).
 *
 * Пары задаются по индексу: entries[i] ↔ exits[i].
 *
 * Почему НЕ «диагонали» (TL→BR и TR→BL): пара диагоналей в 4-связной сетке
 * по теореме Жордана обязана пересечься (общая клетка), а пересечение требует
 * плитки степени 4 (CROSS), которая в MVP не генерируется. Пары
 * TL→BL и TR→BR не чередуются на границе квадрата → вершинно-непересекающиеся
 * пути существуют без CROSS.
 */
export const SCENARIO_ENDPOINTS: Record<
  Scenario,
  { gridSize: number; entries: GridPosition[]; exits: GridPosition[] }
> = {
  1: {
    gridSize: 6,
    entries: [{ row: 0, col: 0 }],
    exits: [{ row: 5, col: 5 }],
  },
  2: {
    gridSize: 7,
    entries: [
      { row: 0, col: 0 },
      { row: 0, col: 6 },
    ],
    exits: [
      { row: 6, col: 0 },
      { row: 6, col: 6 },
    ],
  },
};
