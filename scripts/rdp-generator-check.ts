/**
 * Верификация ядра пазла-трубопровода RDP (Phase 14 / Таск 2).
 *
 * Прогоняет генератор и solver по Definition of Done: позитивные сценарии,
 * перемешивание, вершинная непересекаемость путей сц.2, негативы solver'а,
 * JSON round-trip, детерминизм. Остаётся в репо.
 *
 * Запуск: `npx tsx scripts/rdp-generator-check.ts`
 */

import type { Direction, GridPosition, PuzzleField } from '../lib/rdp/types';
import { SCENARIO_ENDPOINTS } from '../lib/rdp/types';
import {
  buildSolvedField,
  generateField,
  shuffleRotations,
} from '../lib/rdp/pipesPuzzleGenerator';
import { checkSolution, getTileConnectors } from '../lib/rdp/pipesSolver';

const RUNS = 1000;

const DELTA: Record<Direction, { dr: number; dc: number }> = {
  N: { dr: -1, dc: 0 },
  E: { dr: 0, dc: 1 },
  S: { dr: 1, dc: 0 },
  W: { dr: 0, dc: -1 },
};
const OPPOSITE: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };

let failures = 0;

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    failures += 1;
    console.error(`  ✗ FAIL: ${message}`);
  }
};

const tileId = (row: number, col: number): string => `r${row}c${col}`;

/** Множество клеток, достижимых от `start` по встречным коннекторам. */
const reachableCells = (field: PuzzleField, start: GridPosition): Set<string> => {
  const byId = new Map(field.tiles.map((t) => [t.id, t]));
  const connectorsAt = (row: number, col: number): Direction[] => {
    const tile = byId.get(tileId(row, col));
    return tile ? getTileConnectors(tile.type, tile.rotation) : [];
  };
  const inBounds = (row: number, col: number): boolean =>
    row >= 0 && row < field.gridSize && col >= 0 && col < field.gridSize;

  const visited = new Set<string>([tileId(start.row, start.col)]);
  const stack: GridPosition[] = [start];
  while (stack.length > 0) {
    const cur = stack.pop() as GridPosition;
    for (const dir of connectorsAt(cur.row, cur.col)) {
      const nr = cur.row + DELTA[dir].dr;
      const nc = cur.col + DELTA[dir].dc;
      if (!inBounds(nr, nc)) continue;
      if (!connectorsAt(nr, nc).includes(OPPOSITE[dir])) continue;
      const key = tileId(nr, nc);
      if (visited.has(key)) continue;
      visited.add(key);
      stack.push({ row: nr, col: nc });
    }
  }
  return visited;
};

const hasSolutionField = (field: PuzzleField): boolean =>
  Object.prototype.hasOwnProperty.call(field, 'solution');

// --- Позитивные сценарии ----------------------------------------------------

console.log(`[1] Решаемость buildSolvedField (${RUNS} прогонов каждый)`);
for (let i = 0; i < RUNS; i += 1) {
  assert(checkSolution(buildSolvedField(6, 1)), `buildSolvedField(6,1) #${i} решаемо`);
  assert(checkSolution(buildSolvedField(7, 2)), `buildSolvedField(7,2) #${i} решаемо (обе пары)`);
}

console.log('[2] Форма generateField (нет solution; tiles.length = gridSize^2)');
for (let i = 0; i < RUNS; i += 1) {
  const f1 = generateField(6, 1);
  const f2 = generateField(7, 2);
  assert(!hasSolutionField(f1), `generateField(6,1) #${i} без поля solution`);
  assert(!hasSolutionField(f2), `generateField(7,2) #${i} без поля solution`);
  assert(f1.tiles.length === 36, `generateField(6,1) #${i} tiles.length=36`);
  assert(f2.tiles.length === 49, `generateField(7,2) #${i} tiles.length=49`);
}

// --- Перемешивание ----------------------------------------------------------

console.log(`[3] generateField на старте НЕ решён (${RUNS} прогонов)`);
for (let i = 0; i < RUNS; i += 1) {
  assert(!checkSolution(generateField(6, 1)), `generateField(6,1) #${i} не решён на старте`);
  assert(!checkSolution(generateField(7, 2)), `generateField(7,2) #${i} не решён на старте`);
}

console.log('[4] Guard симметрии STRAIGHT: поле из «одних прямых» не остаётся решённым');
{
  // Прямой коридор сверху вниз по колонке 0 (6×6): все STRAIGHT, симметрия 0≡180.
  const gridSize = 6;
  const tiles = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const onPath = col === 0;
      tiles.push({
        id: tileId(row, col),
        type: onPath ? ('STRAIGHT' as const) : ('EMPTY' as const),
        rotation: onPath ? (0 as const) : (0 as const),
        isLocked: onPath ? row === 0 || row === gridSize - 1 : true,
      });
    }
  }
  const straightField: PuzzleField = {
    gridSize,
    tiles,
    entries: [{ row: 0, col: 0 }],
    exits: [{ row: 5, col: 0 }],
  };
  assert(checkSolution(straightField), 'straightField (все 0°) решён до перемешивания');
  const shuffled = shuffleRotations(straightField, Math.random);
  assert(shuffled !== null, 'shuffleRotations нашёл нерешённую расстановку прямых');
  if (shuffled) {
    assert(!checkSolution(shuffled), 'перемешанные прямые не остаются решёнными (симметрия учтена)');
  }
}

// --- Сценарий 2: вершинная непересекаемость ---------------------------------

console.log(`[5] Сц.2 — два пути вершинно-непересекающиеся (${RUNS} прогонов)`);
for (let i = 0; i < RUNS; i += 1) {
  const solved = buildSolvedField(7, 2);
  const compA = reachableCells(solved, solved.entries[0]);
  const compB = reachableCells(solved, solved.entries[1]);

  assert(compA.has(tileId(solved.exits[0].row, solved.exits[0].col)), `сц.2 #${i}: путь A соединён`);
  assert(compB.has(tileId(solved.exits[1].row, solved.exits[1].col)), `сц.2 #${i}: путь B соединён`);

  let shared = false;
  for (const cell of compA) {
    if (compB.has(cell)) {
      shared = true;
      break;
    }
  }
  assert(!shared, `сц.2 #${i}: пути не имеют общих клеток`);
}

console.log(
  `[5b] Сц.2 — на старте НИ ОДНА пара не собрана отдельно (${RUNS} прогонов)`,
);
for (let i = 0; i < RUNS; i += 1) {
  const field = generateField(7, 2);
  const compA = reachableCells(field, field.entries[0]);
  const compB = reachableCells(field, field.entries[1]);
  assert(
    !compA.has(tileId(field.exits[0].row, field.exits[0].col)),
    `сц.2 #${i}: путь A не собран на старте`,
  );
  assert(
    !compB.has(tileId(field.exits[1].row, field.exits[1].col)),
    `сц.2 #${i}: путь B не собран на старте`,
  );
}

// --- Негативные сценарии (solver) -------------------------------------------

console.log('[6] Негатив: rotate-all-90 на решённом поле → false');
for (let i = 0; i < 200; i += 1) {
  const solved = buildSolvedField(6, 1);
  const rotated: PuzzleField = {
    ...solved,
    tiles: solved.tiles.map((t) => ({
      ...t,
      rotation: (((t.rotation + 90) % 360) as PuzzleField['tiles'][number]['rotation']),
    })),
  };
  assert(!checkSolution(rotated), `rotate-all-90 #${i} ломает решение`);
}

console.log('[7] Негатив: сц.2 «ложная пара» (entry A ↔ чужой exit) → false');
for (let i = 0; i < 200; i += 1) {
  const solved = buildSolvedField(7, 2);
  const swapped: PuzzleField = {
    ...solved,
    exits: [solved.exits[1], solved.exits[0]],
  };
  assert(!checkSolution(swapped), `ложная пара #${i} → false`);
}

console.log('[8] Негатив (edge): коннектор «в стену» / без встречного — не соединяет');
{
  // 2×2: путь (0,0)→(0,1)→(1,1). Корректное решение.
  const ok: PuzzleField = {
    gridSize: 2,
    tiles: [
      { id: 'r0c0', type: 'STRAIGHT', rotation: 90, isLocked: true }, // E+W: W в стену, E→(0,1)
      { id: 'r0c1', type: 'CORNER', rotation: 180, isLocked: false }, // S+W: W→(0,0), S→(1,1)
      { id: 'r1c0', type: 'EMPTY', rotation: 0, isLocked: true },
      { id: 'r1c1', type: 'STRAIGHT', rotation: 0, isLocked: true }, // N+S: N→(0,1), S в стену
    ],
    entries: [{ row: 0, col: 0 }],
    exits: [{ row: 1, col: 1 }],
  };
  assert(checkSolution(ok), 'edge: корректное 2×2 поле решено');

  // Ломаем entry: STRAIGHT 0° = N+S → N и S обе в стену/в EMPTY, нет связи с (0,1).
  const broken: PuzzleField = {
    ...ok,
    tiles: ok.tiles.map((t) => (t.id === 'r0c0' ? { ...t, rotation: 0 } : t)),
  };
  assert(!checkSolution(broken), 'edge: коннектор в стену не даёт соединения → false');
}

// --- Сериализация -----------------------------------------------------------

console.log('[9] JSON round-trip сохраняет поле без потерь');
for (let i = 0; i < 200; i += 1) {
  const field = generateField(7, 2);
  const clone = JSON.parse(JSON.stringify(field)) as PuzzleField;
  assert(
    JSON.stringify(field) === JSON.stringify(clone),
    `JSON round-trip #${i} без потерь`,
  );
  assert(
    checkSolution(field) === checkSolution(clone),
    `JSON round-trip #${i} сохраняет результат solver`,
  );
}

// --- Детерминизм при seed ---------------------------------------------------

console.log('[10] Детерминизм при заданном seed');
{
  const a = generateField(6, 1, 12345);
  const b = generateField(6, 1, 12345);
  assert(JSON.stringify(a) === JSON.stringify(b), 'один seed → одинаковое поле (сц.1)');

  const c = generateField(7, 2, 777);
  const d = generateField(7, 2, 777);
  assert(JSON.stringify(c) === JSON.stringify(d), 'один seed → одинаковое поле (сц.2)');
}

// --- Гарантия непустого набора кликабельных плиток --------------------------

console.log('[11] Эндпоинты совпадают с SCENARIO_ENDPOINTS; есть кликабельные плитки');
{
  const f1 = generateField(6, 1, 1);
  assert(
    JSON.stringify(f1.entries) === JSON.stringify(SCENARIO_ENDPOINTS[1].entries) &&
      JSON.stringify(f1.exits) === JSON.stringify(SCENARIO_ENDPOINTS[1].exits),
    'сц.1: entries/exits совпадают с SCENARIO_ENDPOINTS',
  );
  assert(
    f1.tiles.some((t) => !t.isLocked),
    'сц.1: есть хотя бы одна не-locked плитка (иначе пазл нечего крутить)',
  );
}

// --- Итог -------------------------------------------------------------------

if (failures === 0) {
  console.log('\nOK — все проверки пройдены');
  process.exitCode = 0;
} else {
  console.error(`\nFAILED — провалено проверок: ${failures}`);
  process.exitCode = 1;
}
