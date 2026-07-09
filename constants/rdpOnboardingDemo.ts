import type { PuzzleField } from '@/lib/rdp/types';

/** Фиксированное поле пазла для онбординга (шаги 19–20), seed=19018 */
export const DEMO_RDP_PUZZLE_FIELD: PuzzleField = {
  gridSize: 6,
  tiles: [
    { id: 'r0c0', type: 'STRAIGHT', rotation: 90, isLocked: true },
    { id: 'r0c1', type: 'STRAIGHT', rotation: 180, isLocked: false },
    { id: 'r0c2', type: 'STRAIGHT', rotation: 90, isLocked: false },
    { id: 'r0c3', type: 'CORNER', rotation: 90, isLocked: false },
    { id: 'r0c4', type: 'TEE', rotation: 180, isLocked: false },
    { id: 'r0c5', type: 'EMPTY', rotation: 0, isLocked: true },
    { id: 'r1c0', type: 'TEE', rotation: 180, isLocked: false },
    { id: 'r1c1', type: 'EMPTY', rotation: 0, isLocked: true },
    { id: 'r1c2', type: 'CORNER', rotation: 270, isLocked: false },
    { id: 'r1c3', type: 'CORNER', rotation: 0, isLocked: false },
    { id: 'r1c4', type: 'EMPTY', rotation: 0, isLocked: true },
    { id: 'r1c5', type: 'TEE', rotation: 180, isLocked: false },
    { id: 'r2c0', type: 'CORNER', rotation: 0, isLocked: false },
    { id: 'r2c1', type: 'CORNER', rotation: 90, isLocked: false },
    { id: 'r2c2', type: 'CORNER', rotation: 270, isLocked: false },
    { id: 'r2c3', type: 'CORNER', rotation: 180, isLocked: false },
    { id: 'r2c4', type: 'EMPTY', rotation: 0, isLocked: true },
    { id: 'r2c5', type: 'STRAIGHT', rotation: 0, isLocked: false },
    { id: 'r3c0', type: 'CORNER', rotation: 180, isLocked: false },
    { id: 'r3c1', type: 'CORNER', rotation: 0, isLocked: false },
    { id: 'r3c2', type: 'EMPTY', rotation: 0, isLocked: true },
    { id: 'r3c3', type: 'EMPTY', rotation: 0, isLocked: true },
    { id: 'r3c4', type: 'TEE', rotation: 180, isLocked: false },
    { id: 'r3c5', type: 'CORNER', rotation: 180, isLocked: false },
    { id: 'r4c0', type: 'STRAIGHT', rotation: 90, isLocked: false },
    { id: 'r4c1', type: 'CORNER', rotation: 90, isLocked: false },
    { id: 'r4c2', type: 'CORNER', rotation: 90, isLocked: false },
    { id: 'r4c3', type: 'CORNER', rotation: 90, isLocked: false },
    { id: 'r4c4', type: 'CORNER', rotation: 270, isLocked: false },
    { id: 'r4c5', type: 'CORNER', rotation: 90, isLocked: false },
    { id: 'r5c0', type: 'CORNER', rotation: 180, isLocked: false },
    { id: 'r5c1', type: 'CORNER', rotation: 0, isLocked: false },
    { id: 'r5c2', type: 'CORNER', rotation: 0, isLocked: false },
    { id: 'r5c3', type: 'STRAIGHT', rotation: 90, isLocked: false },
    { id: 'r5c4', type: 'STRAIGHT', rotation: 90, isLocked: false },
    { id: 'r5c5', type: 'STRAIGHT', rotation: 90, isLocked: true },
  ],
  entries: [{ row: 0, col: 0 }],
  exits: [{ row: 5, col: 5 }],
};

/** Текст инструкции в demo-пазле (шаг 20) */
export const DEMO_RDP_INSTRUCTION_HINT =
  'Проведите непрерывную линию от точки старта до точки финиша, поворачивая сегменты трубопровода.';
