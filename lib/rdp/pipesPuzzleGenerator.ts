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
/** Сколько раз перегенерируем все поле (укладка + перемешивание). */
const MAX_FIELD_ATTEMPTS = 50;
/**
 * Сила «тяги к цели» при укладке пути: чем больше, тем сильнее путь петляет.
 * Балансирует интересность поля и вероятность непересечения двух путей (сц.2).
 * Повышен (3→6), чтобы DFS чаще порождал извилистые маршруты — иначе высокое
 * требование углов (`MIN_PATH_CORNERS`) почти всегда отбраковывало бы укладку.
 */
const PATH_GOAL_JITTER = 6;
/**
 * Минимум поворотов (углов) в каждом пути. Без него DFS часто кладет прямой
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

/**
 * Минимальная длина (число клеток) каждого пути. Без него DFS с goal-bias
 * кладет короткий маршрут «к ближайшему углу»: поле выглядит разреженным, трубы
 * жмутся к границе двумя блобами (фидбэк заказчика по сц.2).
 *
 * Это нижний порог (floor): DFS с goal-jitter естественно петляет длиннее, и
 * фактическая плотность выходит ~60% (сц.1) / ~65% (сц.2) — поле «гуще» и
 * заметно разбросаннее двух прежних блобов у границы. Длина пути (без учета
 * decoy-обманок, добавленных позже) сохраняется как `pathTileCount` —
 * знаменатель для `computePuzzleProgress` в сц.1.
 *
 * Сознательно НЕ «под завязку»: запас до полного заполнения держит укладку двух
 * вершинно-непересекающихся путей надежной (низкий риск исчерпания попыток —
 * подтверждено прогоном `scripts/rdp-generator-check.ts`).
 */
const MIN_PATH_LENGTH: Record<Scenario, number> = {
  1: 18,
  2: 12,
};

/**
 * Максимальная длина пути. Нужен для сц.1: иначе извилистый путь иногда
 * заполняет почти все поле, не оставляя клеток под decoy-обманки. Предел
 * резервирует пустые клетки. Для сц.2 ограничения нет (обманок там нет).
 */
const MAX_PATH_LENGTH: Record<Scenario, number> = {
  1: 26,
  2: Number.POSITIVE_INFINITY,
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

/** Копия массива в случайном порядке (Fisher–Yates, детерминированно при seed). */
const shuffleArray = <T>(arr: readonly T[], rng: Rng): T[] => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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

  /** Достижима ли цель из `from` через еще не занятые клетки (флуд-BFS). */
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
 * перпендикулярны (не противоположны). Прямой коридор дает 0 углов.
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
 * Каждый путь обязан иметь >= `MIN_PATH_CORNERS` углов и длину в диапазоне
 * [`MIN_PATH_LENGTH`, `MAX_PATH_LENGTH`] — иначе попытка укладки отбрасывается
 * (защита от тривиального коридора, разреженного поля и переполнения, не
 * оставляющего места под decoy). Retry-лимит на укладку; при исчерпании —
 * `throw` (а не зависание).
 */
const layPaths = (scenario: Scenario, rng: Rng): GridPosition[][] => {
  const { gridSize, entries, exits } = SCENARIO_ENDPOINTS[scenario];
  const minCorners = MIN_PATH_CORNERS[scenario];
  const minLength = MIN_PATH_LENGTH[scenario];
  const maxLength = MAX_PATH_LENGTH[scenario];

  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt += 1) {
    const blocked = new Set<string>();
    const paths: GridPosition[][] = [];
    let ok = true;

    for (let i = 0; i < entries.length; i += 1) {
      const path = findPath(gridSize, entries[i], exits[i], blocked, rng);
      if (
        !path ||
        path.length < minLength ||
        path.length > maxLength ||
        countCorners(path) < minCorners
      ) {
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

// --- Decoy-плитки (тупики-обманки) ------------------------------------------

/**
 * Доля оставшихся пустых клеток, заполняемых decoy-«обрубками» (тупиками).
 * Обманки выглядят как трубы, но не ведут к решению. По решению заказчика —
 * только сц.1: сц.2 их не получает (там два пути, поле и так плотное).
 */
const DECOY_FILL_RATIO: Record<Scenario, number> = {
  1: 0.65,
  2: 0,
};

/**
 * Тип+поворот для decoy-клетки. Коннекторы НЕ направлены ни на одну клетку пути
 * (forbidden-направления) — обрубок не «утыкается» в решение. Возвращает `null`,
 * если безопасной ориентации нет (клетка зажата путем со всех сторон).
 *
 * Корректность не зависит от этого правила: плитки пути задают коннекторы только
 * вдоль пути, поэтому путь никогда не указывает на decoy, и взаимного (mutual)
 * ребра путь↔decoy не возникает в принципе. Запрет «в путь» — для аккуратного
 * вида и чистоты проверки достижимости.
 */
const chooseDecoy = (
  pos: GridPosition,
  gridSize: number,
  pathSet: ReadonlySet<string>,
  rng: Rng,
): { type: TileType; rotation: TileRotation } | null => {
  const forbidden = new Set<Direction>();
  for (const dir of ALL_DIRECTIONS) {
    const row = pos.row + DELTA[dir].dr;
    const col = pos.col + DELTA[dir].dc;
    if (inBounds(gridSize, row, col) && pathSet.has(`${row},${col}`)) {
      forbidden.add(dir);
    }
  }

  const types = shuffleArray<TileType>(['STRAIGHT', 'CORNER', 'TEE'], rng);
  for (const type of types) {
    const rotations = shuffleArray(ROTATIONS, rng);
    for (const rotation of rotations) {
      const connectors = TILE_CONNECTORS[type][rotation];
      if (
        connectors &&
        connectors.length > 0 &&
        connectors.every((dir) => !forbidden.has(dir))
      ) {
        return { type, rotation };
      }
    }
  }

  return null;
};

/**
 * Заполняет часть пустых клеток decoy-плитками (только если `DECOY_FILL_RATIO`
 * сценария > 0). Мутирует переданный массив `tiles`. Обманки кликабельны
 * (`isLocked=false`) — игрок крутит их наравне с настоящими трубами.
 */
const placeDecoys = (
  tiles: Tile[],
  gridSize: number,
  scenario: Scenario,
  pathSet: ReadonlySet<string>,
  rng: Rng,
): void => {
  const ratio = DECOY_FILL_RATIO[scenario];
  if (ratio <= 0) return;

  const emptyPositions: GridPosition[] = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      if (!pathSet.has(`${row},${col}`)) {
        emptyPositions.push({ row, col });
      }
    }
  }

  const target = Math.floor(emptyPositions.length * ratio);
  const order = shuffleArray(emptyPositions, rng);
  let placed = 0;

  for (const pos of order) {
    if (placed >= target) break;
    const choice = chooseDecoy(pos, gridSize, pathSet, rng);
    if (!choice) continue;

    const tile = tiles[pos.row * gridSize + pos.col];
    tile.type = choice.type;
    tile.rotation = choice.rotation;
    tile.isLocked = false;
    placed += 1;
  }
};

// --- Сборка решенного поля --------------------------------------------------

/**
 * Решенное поле с правильными ориентациями (`checkSolution` = `true`).
 *
 * Внутренний хелпер для тестируемости. В рабочем флоу напрямую НЕ отдается
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
        // outward фиксирован по роли (entry→N, exit→S), а НЕ OPPOSITE(inward):
        // UI всегда рисует маркер-точку у верхнего края тайла для entry и у
        // нижнего для exit (PipesPuzzle.tsx, `-top-1.5`/`-bottom-1.5`) — вне
        // зависимости от того, в какую сторону путь уходит от угла. При
        // OPPOSITE(inward) путь, уходящий от угла вбок (E/W), давал
        // горизонтальный outward-коннектор, который визуально не совпадал с
        // точкой над/под тайлом — первый сегмент казался «не выходящим» из
        // точки и провоцировал игрока покрутить его, хотя тайл заблокирован.
        const inwardNeighbor = prev ?? next;
        const inward = directionBetween(cell, inwardNeighbor);
        const outward: Direction = prev ? 'S' : 'N';
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

  // Тупики-обманки на части пустых клеток (изолированы от пути — см. chooseDecoy).
  const pathSet = new Set<string>();
  for (const path of paths) {
    for (const cell of path) {
      pathSet.add(posKey(cell));
    }
  }
  placeDecoys(tiles, gridSize, scenario, pathSet, rng);

  return {
    gridSize,
    tiles,
    entries: endpoints.entries.map((p) => ({ ...p })),
    exits: endpoints.exits.map((p) => ({ ...p })),
    pathTileCount: pathSet.size,
  };
};

// --- Перемешивание поворотов ------------------------------------------------

const randomRotation = (rng: Rng): TileRotation =>
  ROTATIONS[Math.floor(rng() * ROTATIONS.length)];

/**
 * Решена ли хотя бы одна пара `entries[i] → exits[i]` по отдельности.
 *
 * `checkSolution` для одной пары проверяет именно ее достижимость, поэтому
 * каждую пару прогоняем независимо. Нужно для сц.2: общий `checkSolution`
 * = `false`, даже когда один путь уже собран, а другой сломан — и тогда поле
 * выглядит наполовину решенным. Здесь же ловим любую отдельно собранную пару.
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
 * симметрию STRAIGHT через фактическую проверку). Это сильнее, чем «все поле
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
 * Генерирует гарантированно решаемое, но НЕ решенное на старте поле пазла.
 *
 * Возвращает `PuzzleField` без поля solution: правильная ориентация —
 * серверный секрет. Решаемость гарантирована построением (перемешивается
 * только `rotation` известного решения).
 *
 * @throws если за `MAX_FIELD_ATTEMPTS` не удалось получить перемешанное
 *   нерешенное поле (на практике не достигается для углов 6×6/7×7).
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
    `generateField: не удалось получить нерешенное поле сценария ${scenario} за ${MAX_FIELD_ATTEMPTS} попыток`,
  );
};
