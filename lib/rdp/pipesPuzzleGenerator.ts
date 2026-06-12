/**
 * Генератор пазла-трубопровода RDP-миссии (чистый серверный TS).
 *
 * Принцип `solvable-by-construction`: строим реальное решение (1 путь для
 * сценария 1 / 2 вершинно-непересекающихся пути для сценария 2), выводим типы
 * плиток из коннекторов, затем перемешиваем только `rotation`. Решение всегда
 * существует — меняется лишь ориентация.
 *
 * Генерируются только STRAIGHT / CORNER / EMPTY. TEE и CROSS не создаются (MVP).
 * Публичный `generateField` НЕ возвращает «правильную ориентацию» — поле
 * приходит уже перемешанным, без поля solution.
 *
 * Без DOM, без БД, без сетевого слоя.
 */

import type {
  Direction,
  GridPosition,
  PuzzleField,
  Scenario,
  Tile,
  TileRotation,
  TileType,
} from './types';
import { SCENARIO_ENDPOINTS, TILE_CONNECTORS } from './types';
import { checkSolution } from './pipesSolver';

// --- Константы (без магических чисел) --------------------------------------

const ROTATIONS: readonly TileRotation[] = [0, 90, 180, 270];

/** Все направления — для перебора соседей. */
const ALL_DIRECTIONS: readonly Direction[] = ['N', 'E', 'S', 'W'];

const OPPOSITE: Record<Direction, Direction> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
};

const DELTA: Record<Direction, { dr: number; dc: number }> = {
  N: { dr: -1, dc: 0 },
  E: { dr: 0, dc: 1 },
  S: { dr: 1, dc: 0 },
  W: { dr: 0, dc: -1 },
};

/** Сколько раз пытаемся проложить набор путей, прежде чем бросить ошибку. */
const MAX_LAYOUT_ATTEMPTS = 400;
/** Бюджет шагов DFS на один поиск пути (защита от патологического backtracking). */
const MAX_PATH_STEPS = 20000;
/** Сколько случайных перемешиваний пробуем, прежде чем перегенерировать поле. */
const MAX_SHUFFLE_ATTEMPTS = 200;
/** Сколько раз перегенерируем всё поле (укладка + перемешивание). */
const MAX_FIELD_ATTEMPTS = 50;
/**
 * Сила «тяги к цели» при укладке пути: чем больше, тем сильнее путь петляет.
 * Балансирует интересность поля и вероятность непересечения двух путей (сц.2).
 * Повышен (3→6), чтобы DFS чаще порождал извилистые маршруты — иначе высокое
 * требование углов (`MIN_PATH_CORNERS`) почти всегда отбраковывало бы укладку.
 */
const PATH_GOAL_JITTER = 6;
/**
 * Минимум поворотов (углов) в каждом пути. Без него DFS часто кладёт прямой
 * коридор (только STRAIGHT-плитки): он собирается тривиально/в один клик, а в
 * сц.2 один из двух путей нередко выглядит «уже собранным». Требование углов
 * заставляет оба пути петлять — обе трубы требуют реальной сборки.
 *
 * Сценарий 2 заметно выше (6): два пути по отдельным «столбцам» выглядели
 * слишком очевидно. Больше углов → маршруты заходят вглубь поля и переплетение
 * читается сложнее (пути остаются вершинно-непересекающимися — это Вариант A,
 * см. примечание в `.docs/phases/phase-14.md`).
 */
const MIN_PATH_CORNERS: Record<Scenario, number> = {
  1: 3,
  2: 6,
};

// --- ГСЧ (детерминизм при заданном seed — желательно) ----------------------

type Rng = () => number;

/** Детерминированный ГСЧ (mulberry32) для воспроизводимых прогонов. */
const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// --- Геометрия плиток -------------------------------------------------------

const tileId = (row: number, col: number): string => `r${row}c${col}`;
const posKey = (pos: GridPosition): string => `${pos.row},${pos.col}`;

const directionBetween = (
  from: GridPosition,
  to: GridPosition,
): Direction => {
  if (to.row === from.row - 1) return 'N';
  if (to.row === from.row + 1) return 'S';
  if (to.col === from.col + 1) return 'E';
  if (to.col === from.col - 1) return 'W';
  throw new Error(`Клетки ${posKey(from)} и ${posKey(to)} не соседние`);
};

const manhattan = (a: GridPosition, b: GridPosition): number =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

/**
 * Тип + поворот плитки по набору активных направлений (ровно 2 коннектора).
 * Любая пара различных направлений — это либо STRAIGHT (противоположные),
 * либо CORNER (перпендикулярные).
 */
const tileForConnectors = (
  dirs: Direction[],
): { type: TileType; rotation: TileRotation } => {
  const want = new Set(dirs);
  const candidates: TileType[] = ['STRAIGHT', 'CORNER'];

  for (const type of candidates) {
    for (const rotation of ROTATIONS) {
      const connectors = TILE_CONNECTORS[type][rotation];
      if (
        connectors &&
        connectors.length === want.size &&
        connectors.every((dir) => want.has(dir))
      ) {
        return { type, rotation };
      }
    }
  }

  throw new Error(`Нет STRAIGHT/CORNER под коннекторы: ${dirs.join(',')}`);
};

// --- Укладка путей (random DFS + goal-bias + backtracking) ------------------

const inBounds = (gridSize: number, row: number, col: number): boolean =>
  row >= 0 && row < gridSize && col >= 0 && col < gridSize;

/**
 * Самонепересекающийся маршрут от `start` к `goal`, обходящий `blocked`.
 * Случайный DFS с тягой к цели (`PATH_GOAL_JITTER`) и backtracking'ом.
 *
 * Ключевая оптимизация — прунинг по связности: если из текущей клетки цель
 * уже недостижима через свободные клетки, ветка отсекается сразу. Без этого
 * DFS экспоненциально перебирает «отрезанные» от цели области на 7×7.
 *
 * Возвращает список клеток пути либо `null` (маршрут не найден или превышен
 * бюджет шагов — вызывающий код делает повторную попытку).
 */
const findPath = (
  gridSize: number,
  start: GridPosition,
  goal: GridPosition,
  blocked: ReadonlySet<string>,
  rng: Rng,
): GridPosition[] | null => {
  const visited = new Set<string>(blocked);
  const path: GridPosition[] = [];
  const goalKey = posKey(goal);
  let steps = 0;

  /** Достижима ли цель из `from` через ещё не занятые клетки (флуд-BFS). */
  const goalReachable = (from: GridPosition): boolean => {
    const seen = new Set<string>([posKey(from)]);
    const queue: GridPosition[] = [from];
    while (queue.length > 0) {
      const cur = queue.shift() as GridPosition;
      if (posKey(cur) === goalKey) {
        return true;
      }
      for (const dir of ALL_DIRECTIONS) {
        const row = cur.row + DELTA[dir].dr;
        const col = cur.col + DELTA[dir].dc;
        if (!inBounds(gridSize, row, col)) continue;
        const key = `${row},${col}`;
        if (seen.has(key)) continue;
        // Проходимы свободные клетки и сама цель.
        if (visited.has(key) && key !== goalKey) continue;
        seen.add(key);
        queue.push({ row, col });
      }
    }
    return false;
  };

  const dfs = (current: GridPosition): boolean => {
    steps += 1;
    if (steps > MAX_PATH_STEPS) {
      return false;
    }

    path.push(current);
    visited.add(posKey(current));

    if (current.row === goal.row && current.col === goal.col) {
      return true;
    }

    if (!goalReachable(current)) {
      path.pop();
      visited.delete(posKey(current));
      return false;
    }

    const candidates = ALL_DIRECTIONS.map((dir) => ({
      row: current.row + DELTA[dir].dr,
      col: current.col + DELTA[dir].dc,
    }))
      .filter(
        (pos) =>
          inBounds(gridSize, pos.row, pos.col) && !visited.has(posKey(pos)),
      )
      .sort(
        (a, b) =>
          manhattan(a, goal) +
          rng() * PATH_GOAL_JITTER -
          (manhattan(b, goal) + rng() * PATH_GOAL_JITTER),
      );

    for (const next of candidates) {
      if (dfs(next)) {
        return true;
      }
    }

    path.pop();
    visited.delete(posKey(current));
    return false;
  };

  return dfs(start) ? path : null;
};

/**
 * Число поворотов пути: внутренние клетки, где входящее и исходящее направления
 * перпендикулярны (не противоположны). Прямой коридор даёт 0 углов.
 */
const countCorners = (path: GridPosition[]): number => {
  let corners = 0;
  for (let index = 1; index < path.length - 1; index += 1) {
    const toPrev = directionBetween(path[index], path[index - 1]);
    const toNext = directionBetween(path[index], path[index + 1]);
    if (OPPOSITE[toPrev] !== toNext) {
      corners += 1;
    }
  }
  return corners;
};

/**
 * Прокладывает все пути сценария вершинно-непересекающимися (для сц.2 — два).
 * Каждый путь обязан иметь >= `MIN_PATH_CORNERS` углов — иначе попытка укладки
 * отбрасывается (защита от тривиального прямого коридора). Retry-лимит на
 * укладку; при исчерпании — `throw` (а не зависание).
 */
const layPaths = (scenario: Scenario, rng: Rng): GridPosition[][] => {
  const { gridSize, entries, exits } = SCENARIO_ENDPOINTS[scenario];
  const minCorners = MIN_PATH_CORNERS[scenario];

  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt += 1) {
    const blocked = new Set<string>();
    const paths: GridPosition[][] = [];
    let ok = true;

    for (let i = 0; i < entries.length; i += 1) {
      const path = findPath(gridSize, entries[i], exits[i], blocked, rng);
      if (!path || countCorners(path) < minCorners) {
        ok = false;
        break;
      }
      for (const cell of path) {
        blocked.add(posKey(cell));
      }
      paths.push(path);
    }

    if (ok) {
      return paths;
    }
  }

  throw new Error(
    `layPaths: не удалось проложить пути сценария ${scenario} за ${MAX_LAYOUT_ATTEMPTS} попыток`,
  );
};

// --- Сборка решённого поля --------------------------------------------------

/**
 * Решённое поле с правильными ориентациями (`checkSolution` = `true`).
 *
 * Внутренний хелпер для тестируемости. В рабочем флоу напрямую НЕ отдаётся
 * клиенту: `generateField` возвращает уже перемешанный результат без solution.
 */
export const buildSolvedField = (
  gridSize: number,
  scenario: Scenario,
  seed?: number,
): PuzzleField => {
  const endpoints = SCENARIO_ENDPOINTS[scenario];
  if (gridSize !== endpoints.gridSize) {
    throw new Error(
      `buildSolvedField: gridSize ${gridSize} не совпадает с эндпоинтами сценария ${scenario} (${endpoints.gridSize})`,
    );
  }

  const rng: Rng = seed === undefined ? Math.random : mulberry32(seed);
  const paths = layPaths(scenario, rng);

  // Все клетки по умолчанию — пустые и заблокированные.
  const tiles: Tile[] = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      tiles.push({
        id: tileId(row, col),
        type: 'EMPTY',
        rotation: 0,
        isLocked: true,
      });
    }
  }
  const tileAt = (pos: GridPosition): Tile =>
    tiles[pos.row * gridSize + pos.col];

  for (const path of paths) {
    for (let index = 0; index < path.length; index += 1) {
      const cell = path[index];
      const prev = path[index - 1];
      const next = path[index + 1];
      const isEndpoint = !prev || !next;

      let dirs: Direction[];
      if (prev && next) {
        // Внутренняя клетка пути: коннекторы к обоим соседям.
        dirs = [directionBetween(cell, prev), directionBetween(cell, next)];
      } else {
        // Endpoint: коннектор к единственному соседу + «наружу» сетки.
        const inwardNeighbor = prev ?? next;
        const inward = directionBetween(cell, inwardNeighbor);
        const outward = OPPOSITE[inward]; // у углового endpoint всегда за границей
        dirs = [inward, outward];
      }

      const { type, rotation } = tileForConnectors(dirs);
      const tile = tileAt(cell);
      tile.type = type;
      tile.rotation = rotation;
      // Endpoint'ы зафиксированы; внутренние клетки пути игрок крутит.
      tile.isLocked = isEndpoint;
    }
  }

  return {
    gridSize,
    tiles,
    entries: endpoints.entries.map((p) => ({ ...p })),
    exits: endpoints.exits.map((p) => ({ ...p })),
  };
};

// --- Перемешивание поворотов ------------------------------------------------

const randomRotation = (rng: Rng): TileRotation =>
  ROTATIONS[Math.floor(rng() * ROTATIONS.length)];

/**
 * Решена ли хотя бы одна пара `entries[i] → exits[i]` по отдельности.
 *
 * `checkSolution` для одной пары проверяет именно её достижимость, поэтому
 * каждую пару прогоняем независимо. Нужно для сц.2: общий `checkSolution`
 * = `false`, даже когда один путь уже собран, а другой сломан — и тогда поле
 * выглядит наполовину решённым. Здесь же ловим любую отдельно собранную пару.
 */
const anyPairSolved = (field: PuzzleField): boolean =>
  field.entries.some((entry, index) =>
    checkSolution({
      ...field,
      entries: [entry],
      exits: [field.exits[index]],
    }),
  );

/**
 * Возвращает копию поля со случайными поворотами не-`isLocked` плиток,
 * гарантируя, что НИ ОДНА пара вход→выход не собрана на старте (учитывая
 * симметрию STRAIGHT через фактическую проверку). Это сильнее, чем «всё поле
 * не решено»: в сц.2 ни одна из двух труб не должна выглядеть уже собранной.
 * `null`, если за лимит попыток сломать не удалось.
 *
 * Внутренний хелпер для тестируемости.
 */
export const shuffleRotations = (
  field: PuzzleField,
  rng: Rng = Math.random,
): PuzzleField | null => {
  for (let attempt = 0; attempt < MAX_SHUFFLE_ATTEMPTS; attempt += 1) {
    const shuffled: PuzzleField = {
      ...field,
      tiles: field.tiles.map((tile) =>
        tile.isLocked ? { ...tile } : { ...tile, rotation: randomRotation(rng) },
      ),
      entries: field.entries.map((p) => ({ ...p })),
      exits: field.exits.map((p) => ({ ...p })),
    };

    if (!anyPairSolved(shuffled)) {
      return shuffled;
    }
  }

  return null;
};

// --- Публичный API ----------------------------------------------------------

/**
 * Генерирует гарантированно решаемое, но НЕ решённое на старте поле пазла.
 *
 * Возвращает `PuzzleField` без поля solution: правильная ориентация —
 * серверный секрет. Решаемость гарантирована построением (перемешивается
 * только `rotation` известного решения).
 *
 * @throws если за `MAX_FIELD_ATTEMPTS` не удалось получить перемешанное
 *   нерешённое поле (на практике не достигается для углов 6×6/7×7).
 */
export const generateField = (
  gridSize: number,
  scenario: Scenario,
  seed?: number,
): PuzzleField => {
  for (let attempt = 0; attempt < MAX_FIELD_ATTEMPTS; attempt += 1) {
    // Разный seed на каждую попытку, чтобы перегенерация давала новое поле.
    const fieldSeed = seed === undefined ? undefined : seed + attempt;
    const rng: Rng =
      fieldSeed === undefined ? Math.random : mulberry32(fieldSeed);

    const solved = buildSolvedField(gridSize, scenario, fieldSeed);
    const shuffled = shuffleRotations(solved, rng);
    if (shuffled) {
      return shuffled;
    }
  }

  throw new Error(
    `generateField: не удалось получить нерешённое поле сценария ${scenario} за ${MAX_FIELD_ATTEMPTS} попыток`,
  );
};
