# Модуль: Миссия «Взлом сайта» (missions-crack)

> Wordle-механика угадывания пароля по 5 буквам с цветовой индикацией позиций.
> Связанные файлы: `.docs/database.md` (модели `MissionSlot`, `MissionProgress`, `CrackSession`), `.docs/modules/chats.md` (TRIGGER `crack_completed:<slotKey>`), `.docs/modules/logs.md` (шаблоны логов).

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Launch (запуск миссии через форму)](#launch-запуск-миссии-через-форму)
3. [Архитектурные решения](#архитектурные-решения)
4. [Игровая механика](#игровая-механика)
5. [Алгоритм генерации поля](#алгоритм-генерации-поля)
6. [Жизненный цикл CrackSession](#жизненный-цикл-cracksession)
7. [Логика попытки (attempt)](#логика-попытки-attempt)
8. [Логика завершения (complete)](#логика-завершения-complete)
9. [Логика пропуска (skip)](#логика-пропуска-skip)
10. [Защита от обхода](#защита-от-обхода)
11. [API-эндпоинты](#api-эндпоинты)
12. [UI миссии](#ui-миссии)
13. [Файлы, которые создаются](#файлы-которые-создаются)
14. [Серверные правила](#серверные-правила)
15. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Цели модуля

После завершения этого модуля:
- Игрок открывает плашку **Взлом сайта** на dashboard, вводит в форму запуска URL + login. Сервер ищет активный слот `CRACK_*` по точному совпадению `targetUrl + targetEmail`. При совпадении — открывается мини-игра соответствующего слота. При несовпадении — лог ошибки доступа (`crack_launch_failed`), попытки запуска не ограничены
- Открытая плашка — видит модалку с полем
- Поле содержит 25-30 русских слов по 5 букв на сетке (приблизительно 5×5 или 5×6)
- Угадывает целевое слово за заданное число попыток (default 6)
- При успехе видит пароль (`MissionSlot.resultPassword`) и копирует его для входа на сторонний сайт
- При провале (исчерпаны попытки) — поле **пересоздаётся**, попытки обнуляются, играет снова
- Прохождение пишется в `MissionProgress.completed=true` и триггерит следующую сцену

**Не входит в модуль:**
- Контент словника — захардкожен в `constants/wordList5letters.ts`, расширяется заказчиком через PR
- Дизайн поля — верстается на Tailwind по ходу фазы
- Админка для CRUD слотов — это `admin.md`
- Список всех 5-буквенных слов для генерации поля — захардкожен в `constants/wordList5letters.ts` (расширяется заказчиком)

---

## Launch (запуск миссии через форму)

### `POST /api/missions/crack/launch`

**Auth:** Player only

**Rate limit:** 30 / мин на `userId` (защита от brute force)

**Body (Zod):**
```typescript
{ targetUrl: z.string().url(), targetEmail: z.string().min(1) }
```

**Алгоритм:**
1. Поиск слота: `MissionSlot.findFirst({ where: { missionType: 'CRACK', isActive: true, targetUrl, targetEmail } })`
2. Если не нашёл → `writeLog('crack_launch_failed', { targetUrl, targetEmail })` → 400 `INVALID_LAUNCH_DATA`
3. Если нашёл → вернуть `{ slotKey, isCompleted: progress?.completed ?? false }`

**Response 200:**
```json
{ "slotKey": "CRACK_P2", "isCompleted": false }
```

**Response 400:**
```json
{ "error": "INVALID_LAUNCH_DATA" }
```

**Response 429:** rate limit exceeded.

**Что НЕ возвращается:** список доступных слотов или намёк на правильность одного из полей — иначе игрок может перебором узнать слоты.

---

## Архитектурные решения

### 1. Wordle-механика, а не «угадай слово вслепую»

**Игровой опыт:** игрок видит **готовый набор слов** и должен выбрать правильное. После каждой попытки — цветовая подсветка букв в выбранном слове относительно `targetWord`. Это даёт обучение через попытки и держит игрока в напряжении.

**Альтернатива «свободный ввод 5-буквенного слова»** — отвергнута: проще для разработчика, но скучнее, и не объясняет, почему «25-30 слов на сетке» в визуальном дизайне (это часть стилистики «лог сканирования»).

### 2. Серверное состояние сессии

`CrackSession` — серверная таблица с:
- `targetWord` — целевое слово, случайно выбранное из `wordList5letters` при создании сессии
- `maxAttempts` — копия лимита попыток
- `wordList` — массив слов на поле
- `attemptsUsed` — сколько попыток сделал
- `attempts` — массив `[{ word, positions: [...] }]` для рендера истории

**Почему сервер, а не клиент:**
- Клиент не должен знать `targetWord` (DevTools покажет — игра сломана)
- Состояние мигрирует между устройствами
- Защита от обхода: даже если игрок что-то модифицирует на клиенте — сервер всё равно проверит

### 3. Параметры на старте сессии

При создании сессии:
- `targetWord` — выбирается случайно из `wordList5letters` (`randomFrom(wordList5letters)`)
- `maxAttempts` — копируется из `MissionSlot.crackMaxAttempts`

Дальше сессия живёт со своими значениями. Если админ изменит `crackMaxAttempts` посреди игры — у игрока с активной сессией лимит **не меняется**. Новые значения применяются только к **новым** сессиям.

**`targetWord` НЕ хранится в `MissionSlot`.** Слово определяется в момент старта каждой сессии — это означает, что разные игроки (и каждая новая сессия после провала) угадывают разное слово. Это сделано намеренно: игрок не может «подсмотреть» слово у другого игрока, а повторная попытка не воспринимается как «тот же пазл».

### 4. Бесконечные попытки через пересоздание поля

Когда `attemptsUsed >= maxAttempts` и слово не угадано — сессия **пересоздаётся**:
- Новый `wordList` (другой набор слов)
- `attemptsUsed = 0`
- `attempts = []`
- `targetWord` — выбирается новое случайное слово из `wordList5letters`
- `maxAttempts` — НЕ меняется (берётся из существующей сессии)

Игрок продолжает с новой попыткой. Это даёт «бесконечные попытки», но с опытом «надо начинать заново», что мотивирует пробовать другую тактику.

### 5. `metadata` для CRACK — пустая

В `MissionProgress.metadata` для Crack ничего не хранится — всё в `CrackSession`. После завершения миссии сессия удаляется (она больше не нужна).

См. `database.md` → `MissionProgress`, `CrackSession`.

### 6. Защита `/complete` через проверку attempts

Проблема: если есть отдельный эндпоинт `/complete`, игрок через DevTools может вызвать его без прохождения миссии.

Решение: `/complete` проверяет, что **последняя успешная попытка действительно содержала `targetWord`**. Подробности в [Защита от обхода](#защита-от-обхода).

### 7. Промежуточные логи не пишутся

Попытки 1..N (без угадывания) **не пишутся** в `OperationLog`. Это излишний шум. В логи попадает только:
- При провале N+1 попытки (поле пересоздано) — `crack_attempt_failed`
- При успехе — `crack_access_granted` + `mission_completed_overview`

См. `logs.md` → серверное правило 8.

### 8. Запуск миссии через форму с полями (Mission Launcher)

На dashboard у игрока одна плашка «Взлом сайта». При клике открывается форма с двумя полями: `URL сайта` и `Логин`. POST на эндпоинт `/api/missions/crack/launch { targetUrl, targetEmail }`. Сервер ищет активный слот по точному совпадению **обоих** полей (`MissionSlot.targetUrl === targetUrl AND MissionSlot.targetEmail === targetEmail AND isActive=true AND missionType=CRACK`). При совпадении — возвращает `slotKey` и открывает мини-игру. При несовпадении — пишет лог `crack_launch_failed` и возвращает 400.

### 9. Бесконечные попытки запуска не считаются попытками миссии

Каждая неудачная попытка ввода URL+login пишет отдельный лог `crack_launch_failed`. Эти попытки **НЕ инкрементируют** `MissionProgress.metadata.failedSessionsCount` — счётчик пропуска относится только к собственно мини-игре (Wordle).

### 10. Skip после 2 проваленных сессий

После 2 пересозданий поля (т.е. 2 раза подряд исчерпал `maxAttempts` без угадывания) — клиент показывает кнопку «Пропустить». При нажатии → `POST /api/missions/crack/<slotKey>/skip`. Сервер пишет `MissionProgress.completed=true, metadata.skipped=true`, удаляет `CrackSession`, пишет **те же логи**, что при успехе (`crack_access_granted` + `mission_completed_overview`), вызывает `advanceTriggerListeners('crack_completed:<slotKey>')`. Триггеры срабатывают как при честном прохождении.

---

## Игровая механика

### Поле

- 25-30 слов на сетке
- Все слова — русские, ровно 5 букв
- Включает `targetWord` + 24-29 «отвлекающих»
- Сетка визуально похожа на «список процессов» / «лог сканирования» — стилистика хакерского интерфейса

**Конкретный размер сетки** определяется в админке (хотя на старте используем фикс 30 слов = 5×6).

### Попытка

Игрок кликает по одному из слов на поле → это его «попытка». На сервер уходит `POST /api/missions/crack/[slotKey]/attempt` с `{ word: "выбранное слово" }`.

Сервер сравнивает с `targetWord` и возвращает массив позиций:

```typescript
type LetterStatus = 'correct' | 'wrong-position' | 'absent';
type AttemptResult = {
  word: string;
  positions: LetterStatus[]; // массив длины 5
  attemptsUsed: number;
  isCorrect: boolean;
  isFailed: boolean; // true если attemptsUsed достиг maxAttempts
};
```

**Логика расчёта позиций** (классический Wordle):
- `correct` — буква стоит на правильной позиции
- `wrong-position` — буква есть в `targetWord`, но на другой позиции
- `absent` — буквы нет в `targetWord`

**Edge case дублирующихся букв:** если в `targetWord = "АГЕНТ"` (только одна "Е"), а игрок ввёл "ЕЕЛКА" — первая Е будет помечена как `correct` (если совпадает с позицией), вторая Е — как `absent`. Алгоритм:

```typescript
function compareWords(target: string, attempt: string): LetterStatus[] {
  const result: LetterStatus[] = new Array(5).fill('absent');
  const targetChars = target.split('');

  // 1-й проход: точные совпадения
  for (let i = 0; i < 5; i++) {
    if (attempt[i] === targetChars[i]) {
      result[i] = 'correct';
      targetChars[i] = ''; // помечаем как использованную
    }
  }

  // 2-й проход: совпадения на другой позиции
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const idx = targetChars.indexOf(attempt[i]);
    if (idx !== -1) {
      result[i] = 'wrong-position';
      targetChars[idx] = ''; // помечаем как использованную
    }
  }

  return result;
}
```

### Цвета на UI

Цвета верстаются на Tailwind по ходу фазы:
- `correct` — зелёный (`bg-green-500`)
- `wrong-position` — жёлтый (`bg-yellow-500`)
- `absent` — серый (`bg-gray-600`)

### Лимит попыток

- Default: 6 (default в схеме `MissionSlot.crackMaxAttempts`)
- Range: 3..10 (валидация в админке)
- Параметр копируется в `CrackSession.maxAttempts` на старте сессии

### Подсказка к миссии

`MissionSlot.hintText` — текст под знаком «?» в углу модалки миссии. Показывает правила Crack: «Угадайте слово за N попыток. Цвета означают...».

См. `admin.md` → раздел mission-slots.

---

## Алгоритм генерации поля

### Входные данные

- `wordPool` — список всех 5-буквенных слов (`constants/wordList5letters.ts`)

Функция сама случайно выбирает `targetWord` из `wordPool` и возвращает его вместе со списком слов для поля.

### Цель

Сгенерировать `targetWord` (случайно) и массив 25-30 слов, который содержит `targetWord` и набор отвлекающих слов с разной степенью «похожести» на target. Идея: чтобы игрок мог использовать предыдущие попытки для сужения круга.

### Распределение слов по группам

Делим отвлекающие слова на группы по числу букв, совпадающих с `targetWord` на правильных позициях:

| Группа | Совпадений | Количество слов |
|---|---|---|
| 4 совпадения | 4 буквы на месте | 1 (≈3% от поля) |
| 3 совпадения | 3 буквы на месте | 4 (≈14%) |
| 2 совпадения | 2 буквы на месте | 8 (≈28%) |
| 1 совпадение | 1 буква на месте | 10 (≈34%) |
| 0 совпадений | ни одной | 6 (≈21%) |
| **Цель + всего** | — | **30 слов** (1 target + 29 отвлекающих) |

**Почему такое распределение:** игрок должен видеть «прогрессию» в своих попытках. Если поле слишком близкое к target — слишком легко. Если слишком далёкое — нет интуиции.

### Алгоритм

```typescript
// lib/crackFieldGenerator.ts
import { wordList5letters } from '@/constants/wordList5letters';

const DISTRIBUTION = [
  { matches: 4, count: 1 },
  { matches: 3, count: 4 },
  { matches: 2, count: 8 },
  { matches: 1, count: 10 },
  { matches: 0, count: 6 },
];

export function generateCrackField(): { targetWord: string; wordList: string[] } {
  // Случайно выбираем целевое слово из всего словника
  const targetWord = wordList5letters[Math.floor(Math.random() * wordList5letters.length)];
  const candidates = wordList5letters.filter(w => w !== targetWord);

  // Группируем кандидатов по числу совпадений с target
  const groups: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  for (const word of candidates) {
    const matches = countPositionalMatches(word, targetWord);
    if (matches in groups) groups[matches].push(word);
  }

  // Выбираем нужное количество из каждой группы
  const field: string[] = [targetWord];

  for (const { matches, count } of DISTRIBUTION) {
    const pool = groups[matches];
    const picked = sampleRandom(pool, count);
    field.push(...picked);

    // Edge case: если в группе меньше слов, чем нужно — берём что есть, логируем warning
    if (picked.length < count) {
      console.warn(
        `[CrackFieldGenerator] target=${targetWord}, нужно ${count} слов с ${matches} совпадениями, нашлось ${picked.length}`
      );
    }
  }

  return { targetWord, wordList: shuffleArray(field) };
}

function countPositionalMatches(a: string, b: string): number {
  let count = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) count++;
  }
  return count;
}

function sampleRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
```

### Edge cases

1. **Не хватает слов в группе:** берём что есть, логируем warning. Поле может оказаться меньше 30 слов — это допустимо (игра не сломается).

2. **Повторный выбор одного слова:** теоретически возможно, но при словнике 200+ слов вероятность крайне мала. Если нужна гарантия уникальности в рамках одной игровой сессии — можно передавать `excludeWords: string[]` в функцию (например, слова из прошлых сессий игрока). На старте — не реализуем.

3. **Словник слишком мал** (< 30 слов всего): возвращаем что есть. Это аномалия настройки — заказчик должен расширить словник.

### Расширение словника

`constants/wordList5letters.ts` — массив строк. На старте — 200-300 слов (зависит от того, что предоставит заказчик). Расширение — через PR в код.

**Альтернатива через БД** (отдельная таблица `WordPool`) — overhead для нашего случая. Если заказчик попросит редактировать словник через админку — добавим.

---

## Жизненный цикл CrackSession

```
[Игрок открыл слот впервые]
   GET /api/missions/crack/[slotKey]
   ↓
   Сервер: создаёт CrackSession при первом обращении (targetWord, maxAttempts, wordList, attemptsUsed=0)
   ↓
[Игрок делает попытку]
   POST /api/missions/crack/<slotKey>/attempt { word }
   ↓
   Сервер: сравнивает с targetWord, обновляет attemptsUsed, attempts
   ↓
[Возможные исходы]
   ├─ Угадал → клиент видит positions=[correct,correct,...] → /complete
   ├─ Не угадал, attemptsUsed < maxAttempts → ждём следующей попытки
   └─ Не угадал, attemptsUsed === maxAttempts → провал → /attempt пересоздаёт сессию
                                                        + пишет лог crack_attempt_failed
                                                        + инкрементирует MissionProgress.metadata.failedSessionsCount (UPSERT)
                                                        → если failedSessionsCount >= 2 → клиент видит кнопку «Пропустить» (canSkip=true в ответе)

[Игрок нажал «Пропустить» (при failedSessionsCount >= 2)]
   POST /api/missions/crack/<slotKey>/skip
   ↓
   Транзакция:
   - UPDATE MissionProgress: completed=true, completedAt=now, metadata.skipped=true
   - DELETE CrackSession
   - INSERT OperationLog (crack_access_granted)
   - INSERT OperationLog (mission_completed_overview)
   ↓
   advanceTriggerListeners(userId, 'crack_completed:<slotKey>')

[Угадал → /complete]
   POST /api/missions/crack/<slotKey>/complete
   ↓
   Сервер: проверяет (последняя attempt в attempts === targetWord)
   ↓
   Транзакция:
   - INSERT/UPDATE MissionProgress(completed=true)
   - DELETE CrackSession
   - INSERT OperationLog (crack_access_granted)
   - INSERT OperationLog (mission_completed_overview)
   ↓
   advanceTriggerListeners(userId, 'crack_completed:<slotKey>')
```

### Состояния клиента

При открытии модалки клиент дёргает `GET /api/missions/crack/<slotKey>` — возвращает либо состояние существующей сессии, либо начинает новую.

```json
// Response 200 (есть активная сессия)
{
  "isActive": true,
  "wordList": ["слово1", ...],
  "attemptsUsed": 2,
  "attempts": [
    { "word": "слово1", "positions": ["absent", "wrong-position", "correct", "absent", "absent"] },
    { "word": "слово2", "positions": [...] }
  ],
  "maxAttempts": 6
}

// Response 200 (миссия уже пройдена)
{
  "isCompleted": true,
  "resultPassword": "XYZ123",
  "targetUrl": "https://p2.com",
  "targetEmail": "admin@p2.com"
}
```

После прохождения — миссия снова открывается, но в режиме «уже пройдено» с теми же контентами (пароль, URL, email). Это нужно, чтобы игрок мог в любой момент вернуться и подсмотреть пароль.

---

## Логика попытки (attempt)

### `POST /api/missions/crack/[slotKey]/attempt`

**Auth:** Player only

**Body (Zod):**
```typescript
const attemptSchema = z.object({
  word: z.string().min(5).max(5),
});
```

**Алгоритм:**
```typescript
async function handleAttempt(userId: string, slotKey: string, word: string) {
  // 1. Найти слот
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: { id: true, missionType: true, isActive: true }
  });
  if (!slot || !slot.isActive || slot.missionType !== 'CRACK') {
    return error(404, 'SLOT_NOT_FOUND');
  }

  // 2. Найти сессию
  const session = await prisma.crackSession.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } }
  });
  if (!session) return error(400, 'NO_ACTIVE_SESSION');

  // 3. Проверить, что слово есть в wordList сессии
  const wordList = session.wordList as string[];
  if (!wordList.includes(word)) {
    return error(400, 'WORD_NOT_IN_FIELD');
  }

  // 4. Сравнить с targetWord
  const positions = compareWords(session.targetWord, word);
  const isCorrect = positions.every(p => p === 'correct');

  // 5. Записать попытку
  const newAttempts = [...(session.attempts as any[]), { word, positions }];
  const newAttemptsUsed = session.attemptsUsed + 1;

  // 6. Решаем: продолжаем, выиграли или провалились?
  if (isCorrect) {
    // Просто обновляем сессию — /complete сделает остальное
    await prisma.crackSession.update({
      where: { id: session.id },
      data: { attemptsUsed: newAttemptsUsed, attempts: newAttempts }
    });
    return { isCorrect: true, isFailed: false, attemptsUsed: newAttemptsUsed, positions };
  }

  if (newAttemptsUsed >= session.maxAttempts) {
    // Провал — пересоздаём сессию, логируем, инкрементируем failedSessionsCount
    const { targetWord: newTargetWord, wordList: newWordList } = generateCrackField();

    await prisma.crackSession.update({
      where: { id: session.id },
      data: {
        targetWord: newTargetWord,  // новое случайное слово при пересоздании
        wordList: newWordList,
        attemptsUsed: 0,
        attempts: [],
        // maxAttempts НЕ меняется
      }
    });

    await writeLog({
      userId,
      templateKey: 'crack_attempt_failed',
      params: {
        targetUrl: slot.targetUrl ?? '—',
        targetEmail: slot.targetEmail ?? '—',
      },
      type: 'ERROR',
    });

    // Инкрементируем failedSessionsCount в MissionProgress
    const progress = await prisma.missionProgress.upsert({
      where: { userId_slotId: { userId, slotId: slot.id } },
      create: { userId, slotId: slot.id, completed: false, metadata: { failedSessionsCount: 1, skipped: false } },
      update: {
        metadata: {
          // merge: инкрементируем счётчик
          failedSessionsCount: ((existingProgress?.metadata as any)?.failedSessionsCount ?? 0) + 1,
          skipped: false,
        }
      },
    });

    const failedSessionsCount = (progress.metadata as any)?.failedSessionsCount ?? 0;

    return {
      isCorrect: false,
      isFailed: true,
      attemptsUsed: 0,
      positions,
      newWordList, // клиент пересоздаёт UI
      canSkip: failedSessionsCount >= 2, // подсказка клиенту: показывать ли кнопку «Пропустить»
    };
  }

  // Обычная неудачная попытка
  await prisma.crackSession.update({
    where: { id: session.id },
    data: { attemptsUsed: newAttemptsUsed, attempts: newAttempts }
  });

  return { isCorrect: false, isFailed: false, attemptsUsed: newAttemptsUsed, positions };
}
```

**Response 200:**
```json
{
  "isCorrect": false,
  "isFailed": false,
  "attemptsUsed": 2,
  "positions": ["correct", "absent", "wrong-position", "absent", "absent"]
}
```

или при провале:
```json
{
  "isCorrect": false,
  "isFailed": true,
  "attemptsUsed": 0,
  "positions": [...],
  "newWordList": ["новое_слово1", "новое_слово2", ...],
  "canSkip": true
}
```

`canSkip: true` — если `failedSessionsCount >= 2` после этого провала. Клиент показывает кнопку «Пропустить».

или при успехе (но `/complete` ещё не вызван):
```json
{
  "isCorrect": true,
  "isFailed": false,
  "attemptsUsed": 3,
  "positions": ["correct", "correct", "correct", "correct", "correct"]
}
```

После получения `isCorrect: true` клиент **сразу** вызывает `/complete`.

---

## Логика завершения (complete)

### `POST /api/missions/crack/[slotKey]/complete`

**Auth:** Player only

**Body:** пустой

**Алгоритм:**
```typescript
async function handleComplete(userId: string, slotKey: string) {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: {
      id: true, missionType: true, isActive: true, displayName: true,
      targetUrl: true, resultPassword: true,
    }
  });
  if (!slot || !slot.isActive || slot.missionType !== 'CRACK') {
    return error(404, 'SLOT_NOT_FOUND');
  }

  const session = await prisma.crackSession.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } }
  });
  if (!session) return error(400, 'NO_ACTIVE_SESSION');

  // Проверка: последняя попытка содержит targetWord
  const attempts = session.attempts as Array<{ word: string }>;
  const lastAttempt = attempts[attempts.length - 1];
  if (!lastAttempt || lastAttempt.word !== session.targetWord) {
    return error(400, 'NOT_SOLVED');
  }

  // Транзакция: прогресс + удаление сессии + логи
  const techMessage = renderLogMessage('crack_access_granted', {
    targetUrl: slot.targetUrl ?? '—',
    resultPassword: slot.resultPassword ?? '—',
  });
  const overviewMessage = renderLogMessage('mission_completed_overview', {
    displayName: slot.displayName,
  });

  await prisma.$transaction([
    prisma.missionProgress.upsert({
      where: { userId_slotId: { userId, slotId: slot.id } },
      create: { userId, slotId: slot.id, completed: true, completedAt: new Date() },
      update: { completed: true, completedAt: new Date() },
    }),
    prisma.crackSession.delete({
      where: { userId_slotId: { userId, slotId: slot.id } }
    }),
    prisma.operationLog.create({
      data: { userId, type: 'SUCCESS', message: techMessage }
    }),
    prisma.operationLog.create({
      data: { userId, type: 'SUCCESS', message: overviewMessage }
    }),
  ]);

  // Триггер чата — ВНУТРИ транзакции, с передачей tx (см. серверное правило 7)
  // await advanceTriggerListeners(tx, userId, `crack_completed:${slotKey}`);

  return {
    success: true,
    resultPassword: slot.resultPassword,
    targetUrl: slot.targetUrl,
    targetEmail: slot.targetEmail,
  };
}
```

**Response 200:**
```json
{
  "success": true,
  "resultPassword": "XYZ123",
  "targetUrl": "https://p2.com",
  "targetEmail": "admin@p2.com"
}
```

**Response 400:**
- `NOT_SOLVED` — последняя попытка не содержит `targetWord`. Защита от прямого вызова `/complete`.

---

## Логика пропуска (skip)

### `POST /api/missions/crack/[slotKey]/skip`

**Auth:** Player only

**Body:** пустой

**Алгоритм:**
1. Найти слот: проверить существование, `isActive=true`, `missionType=CRACK`.
2. Найти `MissionProgress` игрока для этого слота.
3. Проверить: `MissionProgress.metadata.failedSessionsCount >= 2`. Если нет — 400 `CANNOT_SKIP`.
4. Транзакция:
   - UPDATE `MissionProgress`: `completed=true, completedAt=now, metadata.skipped=true`
   - DELETE `CrackSession`
   - INSERT `OperationLog` `crack_access_granted` (те же params, что при успехе)
   - INSERT `OperationLog` `mission_completed_overview`
5. Внутри транзакции (с `tx`): `advanceTriggerListeners(tx, userId, 'crack_completed:<slotKey>')`
6. Возврат: `{ success: true, resultPassword, targetUrl, targetEmail }` (как у `/complete`)

**Response 200:**
```json
{
  "success": true,
  "resultPassword": "XYZ123",
  "targetUrl": "https://p2.com",
  "targetEmail": "admin@p2.com"
}
```

**Response 400:**
- `CANNOT_SKIP` — `failedSessionsCount < 2`. Защита от прямого вызова через DevTools.
- `SLOT_NOT_FOUND` — слот не найден или не активен.

---

## Защита от обхода

### Атака

Игрок открывает DevTools → видит сетевые запросы → понимает, что есть `/complete` → вызывает его напрямую через `fetch` без прохождения миссии.

### Защита

`/complete` проверяет, что **в `CrackSession.attempts` последняя запись содержит `word === targetWord`**.

Это означает:
- Игрок прошёл через `/attempt` хотя бы один раз с правильным словом
- `/attempt` валидирует, что слово есть в `wordList` (нельзя угадать через подбор алфавита)
- `targetWord` хранится только на сервере — клиент не может его узнать через DevTools (если только не дебажить ответы `/attempt`, что уже не «обход», а «нашёл правильный ответ»)

### Защита словника

В `/attempt` проверка `wordList.includes(word)` — игрок не может прислать произвольное слово. Только то, что на поле.

Если игрок через DevTools прислал слово, которого нет в `wordList` — 400 `WORD_NOT_IN_FIELD`. Защита от перебора алфавита.

### Защита от подмены `wordList` на клиенте

Клиент может через DevTools изменить локальный массив `wordList` и кликнуть по элементу, которого там нет. Но `/attempt` сравнивает `word` с серверной копией `wordList` из `CrackSession.wordList`. Серверная копия — единственный источник правды.

---

## API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/api/missions/crack/launch` | Запуск миссии через форму URL+login (rate limit 30/мин) |
| GET | `/api/missions/crack/[slotKey]` | Текущее состояние миссии |
| POST | `/api/missions/crack/[slotKey]/attempt` | Сделать попытку |
| POST | `/api/missions/crack/[slotKey]/complete` | Завершить миссию (после правильной попытки) |
| POST | `/api/missions/crack/[slotKey]/skip` | Пропуск миссии (доступен при `failedSessionsCount >= 2`) |

### `GET /api/missions/crack/[slotKey]`

Возвращает либо состояние существующей сессии, либо создаёт новую и возвращает её состояние.

**Алгоритм:**
```typescript
async function getCrackState(userId: string, slotKey: string) {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: { /* все нужные поля */ }
  });
  if (!slot || !slot.isActive || slot.missionType !== 'CRACK') return error(404);

  // Проверка: миссия уже пройдена?
  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } }
  });
  if (progress?.completed) {
    return {
      isCompleted: true,
      resultPassword: slot.resultPassword,
      targetUrl: slot.targetUrl,
      targetEmail: slot.targetEmail,
      hintText: slot.hintText,
    };
  }

  // Активная сессия?
  let session = await prisma.crackSession.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } }
  });

  if (!session) {
    // Создаём новую — targetWord выбирается случайно из wordList5letters
    const { targetWord, wordList } = generateCrackField();
    session = await prisma.crackSession.create({
      data: {
        userId,
        slotId: slot.id,
        targetWord,
        maxAttempts: slot.crackMaxAttempts ?? 6,
        wordList,
        attemptsUsed: 0,
        attempts: [],
      }
    });
  }

  return {
    isActive: true,
    isCompleted: false,
    wordList: session.wordList,
    attemptsUsed: session.attemptsUsed,
    attempts: session.attempts,
    maxAttempts: session.maxAttempts,
    hintText: slot.hintText,
    targetUrl: slot.targetUrl,
    targetEmail: slot.targetEmail,
  };
}
```

**Response 200 (активная сессия):**
```json
{
  "isActive": true,
  "isCompleted": false,
  "wordList": ["..."],
  "attemptsUsed": 2,
  "attempts": [...],
  "maxAttempts": 6,
  "hintText": "Угадайте пароль за 6 попыток...",
  "targetUrl": "https://p2.com",
  "targetEmail": "admin@p2.com"
}
```

**Response 200 (миссия пройдена):**
```json
{
  "isCompleted": true,
  "resultPassword": "XYZ123",
  "targetUrl": "https://p2.com",
  "targetEmail": "admin@p2.com",
  "hintText": "..."
}
```

**Что НЕ возвращается:** `targetWord` (никогда). Хранится только в `CrackSession` на сервере.

---

## UI миссии

### Форма запуска (Mission Launcher)

На dashboard видна плашка «Взлом сайта». При клике открывается модалка `CrackLaunchModal` с двумя полями: `URL сайта` и `Логин`. После нажатия «Подключиться» — `POST /api/missions/crack/launch`.
- При 200 — открывается `CrackModal` для возвращённого `slotKey`.
- При 400 — поля очищаются, под формой показывается «Ошибка доступа. Проверьте данные». Лог уже записан сервером — игрок видит его в истории операций.

### Модалка миссии

При успешном запуске — открывается модалка размером с большую часть экрана. Содержит:

1. **Заголовок:** `MissionSlot.displayName` (например, «Взлом сайта P2 Digital»)
2. **Поле URL и Email:** заглушка целевого сайта (`targetUrl`, `targetEmail`) — игрок видит, к чему он ломает доступ
3. **Сетка слов** (5×6 = 30 ячеек)
4. **История попыток** — список предыдущих попыток с раскраской по позициям
5. **Счётчик:** «Попытка X из Y»
6. **Кнопка «?» (hintText)** — открывает текст подсказки правил

После прохождения — модалка может быть открыта снова, но в режиме «уже пройдено» (показывает `resultPassword` для копирования).

### Поведение при провале

После N-й попытки (последней) клиент получает `isFailed: true, newWordList: [...], canSkip: boolean`. Действия клиента:
1. Показать UI-уведомление «Ошибка доступа. Попытки исчерпаны. Попробуйте снова.»
2. Заменить wordList на новый
3. Очистить историю попыток
4. Сбросить счётчик на «Попытка 1 из N»
5. Если `canSkip: true` — показать кнопку «Пропустить миссию» рядом с полем попыток
6. Игрок может сразу делать следующую попытку

### Кнопка «Пропустить» и модалка подтверждения

При `failedSessionsCount >= 2` (или `canSkip: true` из ответа) в `CrackModal` — отображается кнопка «Пропустить миссию» (`CrackSkipButton`). При нажатии — модалка-предупреждение `CrackSkipConfirmModal`:
> «Миссия будет помечена как пройденная. Это может повлиять на восприятие истории. Продолжить?»

При подтверждении — `POST /api/missions/crack/<slotKey>/skip`. После успеха — модалка переходит в режим «пройдено» (показывает пароль). Отменить пропуск нельзя.

### Подсказка по правилам

Кнопка «?» в углу модалки → попап с текстом из `MissionSlot.hintText`. Заглушка для текста: «Угадайте слово за N попыток. Цвета означают: зелёный — буква на месте, жёлтый — буква есть, но не на месте, серый — буквы нет.»

---

## Файлы, которые создаются

```
app/
└── api/
    └── missions/
        └── crack/
            ├── launch/
            │   └── route.ts                       # POST: запуск миссии через форму URL+login
            └── [slotKey]/
                ├── route.ts                       # GET: состояние миссии
                ├── attempt/
                │   └── route.ts                   # POST: попытка
                ├── complete/
                │   └── route.ts                   # POST: завершение
                └── skip/
                    └── route.ts                   # POST: пропуск миссии

components/
└── game/
    └── crack/
        ├── CrackLaunchModal.tsx                   # Client Component, форма URL+login
        ├── CrackModal.tsx                         # Client Component, модалка миссии
        ├── CrackSkipButton.tsx                    # Client Component, кнопка «Пропустить» внутри CrackModal
        ├── CrackSkipConfirmModal.tsx              # Client Component, модалка-предупреждение
        ├── WordGrid.tsx                           # Client Component, сетка слов
        ├── WordCell.tsx                           # Client Component, одна ячейка
        ├── AttemptHistory.tsx                     # Client Component, история попыток
        ├── AttemptRow.tsx                         # Client Component, одна попытка с цветом
        ├── CrackHintButton.tsx                    # Client Component, кнопка «?»
        └── CrackCompletedView.tsx                 # Client Component, показ resultPassword

lib/
├── crackFieldGenerator.ts                         # generateCrackField(): { targetWord, wordList }
└── crack/
    ├── compareWords.ts                            # compareWords(target, attempt) — Wordle-логика
    └── launch.ts                                  # серверная логика поиска слота по URL+login

constants/
└── wordList5letters.ts                            # массив строк (200-300 слов на старте)
```

---

## Серверные правила

1. **`targetWord` НИКОГДА не возвращается клиенту.** Ни в `/api/missions/crack/[slotKey]` (GET), ни в `/attempt`, ни в `/complete`. Хранится только в `CrackSession` на сервере. В `MissionSlot` этого поля нет.

2. **`/complete` проверяет последнюю успешную попытку** в `CrackSession.attempts`. Без этой проверки эндпоинт можно вызвать через DevTools.

3. **`/attempt` проверяет, что слово в `wordList`** серверной копии (не клиентской). Защита от перебора.

4. **`crackMaxAttempts` копируется в `CrackSession.maxAttempts` на старте.** Изменения в `MissionSlot` посреди игры не влияют на активные сессии.

5. **Промежуточные попытки (1..N-1) НЕ пишутся в OperationLog.** Только провал (после пересоздания) и успех. См. `logs.md` правило 8.

6. **При успехе пишутся ДВА лога подряд** в одной транзакции: `crack_access_granted` (технический) + `mission_completed_overview` (обзорный).

7. **`advanceTriggerListeners(tx, userId, code)` вызывается ВНУТРИ транзакции** `/complete` и `/skip`, получая транзакционный клиент `tx`. Это соответствует реализации Phase 7 (`lib/chat/triggers.ts`) и гарантирует атомарность: продвижение чат-триггера и фиксация прогресса либо проходят вместе, либо откатываются вместе.

8. **Сессия удаляется при `/complete`.** Хранить пройденные сессии бессмысленно — `MissionProgress.completed=true` достаточно.

9. **`generateCrackField()` случайна по всем параметрам.** И `targetWord`, и набор отвлекающих слов выбираются через `Math.random()`. При каждом создании или пересоздании сессии — другое слово и другое поле. Это намеренно: игрок не может «запомнить» слово между сессиями.

10. **`metadata` для `MissionProgress` Crack** содержит `failedSessionsCount` и `skipped`. Основное состояние сессии — в `CrackSession`.

11. **Launch-эндпоинт не возвращает информацию о том, какое из полей (URL/login) неверное** — это исключает перебор. Возвращается только общий 400 `INVALID_LAUNCH_DATA`.

12. **Skip пишет ТЕ ЖЕ логи и вызывает ТЕ ЖЕ триггеры, что при честном прохождении.** Различие только в `MissionProgress.metadata.skipped=true` (для внутренней аналитики).

13. **`metadata.failedSessionsCount` инкрементируется при пересоздании сессии (провал).** Не сбрасывается между сессиями. Сохраняется до `/complete` или `/skip`.

14. **Optimistic locking только на `/attempt`** (`CrackSession.version`). `/attempt` принимает `expectedVersion` в теле, возвращает обновлённую `version`; при несовпадении — HTTP 409. `/complete` и `/skip` **идемпотентны** и `expectedVersion` НЕ принимают: повторный вызов уже пройденной миссии возвращает тот же успех (бизнес-защита — «последняя попытка === targetWord» для `/complete` и `failedSessionsCount >= 2` для `/skip`). См. `.docs/modules/concurrency.md`.

---

## Связи с другими модулями

- **`database.md`** — модели `MissionSlot`, `MissionProgress`, `CrackSession` описаны там; здесь только применение.
- **`concurrency.md`** — все mutate-эндпоинты используют optimistic locking. Поля `version` на `CrackSession` и `MissionProgress` инкрементируются при UPDATE.
- **`chats.md`** — после `/complete` или `/skip` вызывается `advanceTriggerListeners(userId, 'crack_completed:<slotKey>')`. См. секцию «Активация триггеров».
- **`logs.md`** — используются шаблоны `crack_attempt_failed`, `crack_access_granted`, `crack_launch_failed`, `mission_completed_overview`. `crack_launch_failed` пишется при неудачной попытке запуска через Mission Launcher (несовпадение URL/login).
- **`onboarding.md`** — плашка Crack-миссии имеет `data-onboarding-id="mission-tiles"` (общий для всех плашек миссий).
- **`restart.md`** — DELETE всех `CrackSession` и `MissionProgress` (включая `metadata.failedSessionsCount`, `metadata.skipped`) игрока.
- **`admin.md`** — раздел mission-slots: CRUD слотов CRACK с полями `targetWord`, `targetUrl`, `targetEmail`, `resultPassword`, `crackMaxAttempts`, `hintText`. Поля `targetUrl + targetEmail` используются как **уникальный ключ запуска** — admin.md предупреждает о дубликатах.
- **`final-report.md`** — индикатор «миссия пройдена» в двойном триггере (все активные миссии должны быть `completed=true`).
- **Данные формы запуска (URL/login) НЕ возвращаются клиенту в виде списка валидных значений** — только подтверждение совпадения через `slotKey`.
