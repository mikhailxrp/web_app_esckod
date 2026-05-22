# Модуль: Миссия «Удалённый доступ» (missions-rdp)

> Самая сложная миссия: ввод IP → пазл-трубопровод → симуляция Windows с PDF → сюжетный триггер → завершение.
> Связанные файлы: `.docs/database.md` (модели `MissionSlot`, `MissionProgress`, `RdpFile`), `.docs/modules/chats.md` (TRIGGER `rdp_completed:<slotKey>`, `rdp_marina_triggered`), `.docs/modules/logs.md` (шаблоны логов), `.docs/modules/missions-decipher.md` (`folderPassword` для разблокировки папок).

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Архитектурные решения](#архитектурные-решения)
3. [Два сценария](#два-сценария)
4. [Жизненный цикл миссии](#жизненный-цикл-миссии)
5. [Шаг 1 — ввод IP (connect)](#шаг-1--ввод-ip-connect)
6. [Шаг 2 — пазл-трубопровод](#шаг-2--пазл-трубопровод)
7. [Шаг 3 — симуляция Windows](#шаг-3--симуляция-windows)
8. [Шаг 4 — сюжетный триггер](#шаг-4--сюжетный-триггер)
9. [Шаг 5 — завершение (complete)](#шаг-5--завершение-complete)
10. [Защита от обхода](#защита-от-обхода)
12. [API-эндпоинты](#api-эндпоинты)
13. [UI миссии](#ui-миссии)
14. [Файлы, которые создаются](#файлы-которые-создаются)
15. [Серверные правила](#серверные-правила)
16. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Цели модуля

После завершения этого модуля:

- Игрок открывает плашку RDP-миссии — видит окно с полем ввода IP
- Сервер находит слот по `correctIp` — игрок не знает заранее, какой это слот (`RDP_VICTOR` или `RDP_MARINA`)
- При правильном IP — открывается **пазл-трубопровод** (упрощённый или нормальный, в зависимости от `rdpScenario`)
- После прохождения пазла — **симуляция Windows** с папками и PDF-файлами
- Игрок изучает файлы, разблокирует запароленные папки паролем из Decipher
- Достигает **сюжетной точки** (автоматический триггер после просмотра всех файлов):
  - Сценарий 1: лог «доступ потерян, два активных сеанса» → миссия завершается
  - Сценарий 2: активация чата Марины + лог
- Миссия фиксируется как пройденная (`MissionProgress.completed=true`), триггерит следующую сцену

**Не входит в модуль:**

- Конкретная реализация генерации поля Pipes — точный алгоритм выбирается на этапе Фазы 7a (см. раздел [Шаг 2 — пазл-трубопровод](#шаг-2--пазл-трубопровод)). На уровне спецификации задана минимально необходимая логика.
- PDF-документы и иконки — предоставляет заказчик, грузятся через админку
- Дизайн «Windows-подобной» симуляции — верстается на Tailwind по ходу фазы

---

## Архитектурные решения

### 1. Игрок вводит IP вслепую — сервер находит слот по `correctIp` (Mission Launcher)

В отличие от Crack и Decipher, где плашка миссии явно соответствует слоту — игрок открывает плашку и сразу видит контент того слота — в RDP **игрок вводит IP, а сервер находит соответствующий слот**.

**Зачем:** атмосфера «реального удалённого доступа». Игрок не знает заранее, к какому компьютеру он подключается — это часть детективной интриги. IP он находит в подсказках, файлах, чате Детектива.

**Как (Mission Launcher):** на dashboard плашка «Удалённый доступ» — одна. При клике открывается окно ввода IP. После ввода — `POST /api/missions/rdp/connect` с `{ip}` (этот эндпоинт является **launch-эндпоинтом**, аналогичным `/launch` для Crack/Decipher) → сервер ищет `MissionSlot` где `correctIp === ip` И `missionType === 'RDP'`. Если нашёл — возвращает `slotKey` и состояние миссии. Если не нашёл — лог `rdp_invalid_ip`, ошибка. **IP не возвращается клиенту в виде списка валидных значений** — только подтверждение совпадения через `slotKey`.

### 2. Пять последовательных шагов

Миссия — это последовательность пяти шагов:

1. **Connect** — ввод IP
2. **Puzzle** — пазл-трубопровод
3. **Files** — симуляция Windows
4. **Trigger** — сюжетная точка
5. **Complete** — финальное завершение

Каждый шаг — отдельный эндпоинт. Все шаги защищены через флаги в `MissionProgress.metadata`:

```json
{
  "puzzleSolved": true,
  "timerExpiredCount": 2,
  "triggerActivated": false
}
```

Шаг N+1 проверяет, что шаг N завершён. Это базовая защита от прямого вызова `/complete` через DevTools.

### 3. Два сценария — разная сложность пазла + разный сюжетный финал

| Параметр                  | Сценарий 1 (`RDP_VICTOR`)        | Сценарий 2 (`RDP_MARINA`)                                 |
| ------------------------- | -------------------------------- | --------------------------------------------------------- |
| `rdpScenario`             | 1                                | 2                                                         |
| Размер сетки (default)    | 6×6                              | 7×7                                                       |
| Таймер                    | Нет                              | 120 сек (default)                                         |
| Количество путей в пазле  | 1                                | 2                                                         |
| Сюжетный триггер          | Лог «доступ потерян, два сеанса» | Активация чата Марины                                     |
| Доступность повтора пазла | Без ограничений (но без таймера) | Бесконечные попытки, после истечения таймера — новое поле |

**Параметры**: `timerSeconds`, `rdpPuzzleGridSize` — настраиваются в `MissionSlot` per-slot. Default'ы из сидера (`database.md` → Сидеры).

### 4. Состояние пазла на сервере

Состояние пазла (расположение плиток, ориентация каждой) хранится **на сервере** в `MissionProgress.metadata.puzzleState`. Каждый поворот плитки — отдельный запрос `POST /api/missions/rdp/[slotKey]/rotate-tile` (или batch — обновление поля).

**Альтернатива «всё на клиенте, проверка только в конце»** — отвергнута: при перезагрузке страницы прогресс терялся бы. Серверное состояние позволяет продолжить пазл с того же места.

**Упрощение:** для MVP можно хранить только **финальное** состояние (после нажатия игрока «Проверить» — отправляется всё поле сразу). Это решается на этапе реализации Фазы 7a.

### 5. Симуляция Windows = список `RdpFile` + поле `folder`

`RdpFile` — таблица с привязкой к `MissionSlot.id`. Поле `folder: String` — виртуальная группировка («Архив», «Документы», «Маркова»). Поле `isLocked: Boolean` — папка запаролена, требует пароль из Decipher.

**Не делаем:** отдельную таблицу папок. Виртуальная группировка достаточна.

**Инвариант:** `isLocked` должен быть **одинаков для всех файлов одной папки одного слота**. Проверяется в админке. См. `database.md` → `RdpFile`.

### 6. Триггер — автоматический по факту изучения всех файлов

В отличие от первого замысла («клик на приманку»), сюжетный триггер срабатывает **автоматически на сервере**, когда игрок просмотрел все файлы во всех когда-либо доступных папках. Это согласуется с ТЗ заказчика: сюжет диктует «после ознакомления с файлами появляется сообщение об ошибке».

Клиент сообщает серверу о каждом закрытии PDF через `POST /file-viewed { fileId }`. Сервер:
1. Записывает `fileId` в `metadata.viewedFileIds`
2. Подсчитывает все доступные файлы: из папок с `isLocked=false` + из папок, которые присутствуют в `metadata.unlockedFolders`
3. Если `viewedFileIds` покрывает все доступные — активирует триггер (`triggerActivated=true`) и выполняет сценарийную логику

**Сценарий 1:** пишет лог «доступ потерян, два активных сеанса». Возвращает `scenarioFinal: 'session_lost'`. После этого игрок может вызвать `/complete`.

**Сценарий 2:** активирует чат Марины (`marinaTriggered=true` + `advanceTriggerListeners(rdp_marina_triggered)`). Возвращает `scenarioFinal: 'session_terminated'`. После этого `/complete`.

После активации в `metadata.triggerActivated=true` — `/complete` это проверяет.

**Защита от пропуска:** игрок не может «обойти» триггер — он сработает, как только все доступные файлы будут отмечены просмотренными. Если игрок не разблокировал запароленную папку, триггер сработает после прочтения только незапароленных. Это допустимое поведение по ТЗ.

### 7. Бесконечные попытки пазла

В сценарии 2 — есть таймер 120 секунд. По истечении — пишется лог `rdp_timer_expired`, инкрементится `metadata.timerExpiredCount`, генерируется **новое** поле пазла, таймер запускается заново. **Не блокирует прохождение** — игрок может пробовать сколько угодно раз.

**Для сценария 2** после **2 истечений таймера** (`metadata.timerExpiredCount >= 2`) клиент показывает кнопку «Пропустить». При нажатии → `POST /api/missions/rdp/<slotKey>/skip`. Сервер пишет `completed=true, metadata.skipped=true`, активирует триггер (`triggerActivated=true`), записывает логи как при честном прохождении сценария 2 (включая `marinaTriggered=true` и `advanceTriggerListeners('rdp_marina_triggered')`). **Для сценария 1 пропуск недоступен** — миссия считается несложной.

В сценарии 1 — таймера нет. Игрок может крутить плитки сколько угодно.

### 8. Окно RDP сценария 1 нельзя закрыть до разблокировки первой запароленной папки

По требованию заказчика: после успешного `connect` на `RDP_VICTOR` (сценарий 1) — модалка миссии **не имеет кнопки «закрыть»**, только кнопку «свернуть» (минимизация в иконку на dashboard). Кнопка «закрыть» появляется только после первой успешной разблокировки папки (`metadata.unlockedFolders.length >= 1`).

Это серверный инвариант — клиент дополнительно скрывает кнопку, но даже если игрок через DevTools закроет модалку, при перезагрузке dashboard кнопка-иконка RDP-Виктора будет видна, пока не разблокирована хотя бы одна папка. Для сценария 2 — обычное поведение, кнопка «закрыть» доступна сразу.

При попытке закрыть через ESC / клик вне модалки (сценарий 1, до разблокировки) — показать тултип «Нужно разблокировать хотя бы одну папку перед закрытием».

### 9. Логирование путей и паролей разблокированных папок

При успешной разблокировке папки в `/unlock-folder` пишется лог `rdp_folder_unlocked` (шаблон в `logs.md`) с подстановкой `{folderPath}`, `{folderPassword}`, `{logSubjectName}`. Это позволяет игроку не возвращаться в RDP-окно для повторного просмотра паролей и путей — они хранятся в `OperationLog`.

---

## Два сценария

### Сценарий 1 — упрощённый (`RDP_VICTOR`, `rdpScenario=1`)

- Размер сетки: 6×6
- Один путь: одна точка входа, одна точка выхода
- Таймера нет
- Сюжетный финал: лог «доступ к {logSubjectName} потерян: обнаружено два активных сеанса»
- `MissionSlot.logSubjectName` = "Виктор"

### Сценарий 2 — нормальный (`RDP_MARINA`, `rdpScenario=2`)

- Размер сетки: 7×7
- Два независимых пути: две пары вход-выход, обе цепочки должны быть соединены
- Таймер: 120 секунд по умолчанию
- При истечении таймера — новое поле, таймер заново
- Сюжетный финал: активация чата Марины
- `MissionSlot.logSubjectName` = "Неизвестно"

---

## Жизненный цикл миссии

```
[Игрок открыл плашку миссии RDP]
   ↓
[Поле ввода IP]
   POST /api/missions/rdp/connect { ip }
   ↓
[IP корректный?]
   ├─ Нет → лог rdp_invalid_ip, ошибка
   └─ Да ↓

[Слот найден, isCompleted?]
   ├─ Да → показать «Миссия пройдена», вернуться в режим просмотра файлов
   └─ Нет ↓

[Загружаем пазл]
   GET /api/missions/rdp/[slotKey]/puzzle-state
   ↓
[Игрок крутит плитки]
   POST /api/missions/rdp/[slotKey]/rotate-tile (или batch при «Проверить»)
   ↓
[Сценарий 2: тикает таймер]
   при истечении → POST /api/missions/rdp/[slotKey]/timer-expired
   → лог rdp_timer_expired, новое поле, новый таймер
   → инкрементирует metadata.timerExpiredCount
   → если timerExpiredCount >= 2 → клиент видит кнопку «Пропустить» (canSkip=true в ответе)
   ↓
[Игрок собрал пазл]
   POST /api/missions/rdp/[slotKey]/check-puzzle
   → если соединение есть → metadata.puzzleSolved=true, лог rdp_puzzle_solved
   ↓
[Симуляция Windows]
   GET /api/missions/rdp/[slotKey]/files
   → список RdpFile с пометкой isLocked для папок
   ↓
[Игрок открывает PDF, изучает]
   PDF загружается прямо из Beget Cloud Storage по url
   ↓
[Запароленная папка]
   POST /api/missions/rdp/[slotKey]/unlock-folder { folder, password }
   → сервер проверяет с MissionSlot.folderPassword (от соответствующего Decipher-слота)
   ↓
[Игрок открывает PDF, читает, закрывает окно с PDF]
   POST /api/missions/rdp/[slotKey]/file-viewed { fileId }
   → сервер записывает fileId в metadata.viewedFileIds
   → сервер проверяет: все ли файлы из всех когда-либо доступных папок просмотрены?
   ↓
[Если ещё не все]
   → возвращает { triggered: false }
   → игрок может открыть следующий файл, разблокировать новую папку, свернуть окно

[Если все доступные файлы просмотрены]
   → сервер автоматически активирует триггер
   → metadata.triggerActivated = true
   ↓
[Сценарий 1: модалка не имеет кнопки «закрыть» до unlockedFolders.length >= 1]

[Сценарий 1]                              [Сценарий 2]
   лог rdp_session_lost                       GameProgress.marinaTriggered=true
   (с {nextIp} из nextRdpSlotKey)             advanceTriggerListeners(rdp_marina_triggered)
   возвращает { triggered: true,             возвращает { triggered: true,
                  scenarioFinal: 'session_lost' }    scenarioFinal: 'session_terminated' }
   ↓                                          ↓
[Клиент рендерит финальное окно ошибки]
   - Сценарий 1: «2 активных сеанса, Новый IP: {nextIp}» (с возможностью копировать IP)
   - Сценарий 2: «Сеанс прерван»
   ↓
[Игрок нажал «Пропустить» (только сценарий 2, timerExpiredCount >= 2)]
   POST /api/missions/rdp/[slotKey]/skip
   ↓
   Транзакция: MissionProgress(completed=true, skipped=true, triggerActivated=true)
             + GameProgress(marinaTriggered=true) + 2 лога
   advanceTriggerListeners(rdp_completed:<slotKey>) + advanceTriggerListeners(rdp_marina_triggered)

[Игрок закрывает финальное окно]
   POST /api/missions/rdp/[slotKey]/complete
   ↓
   Транзакция: MissionProgress(completed=true) + 2 лога
   advanceTriggerListeners(rdp_completed:<slotKey>)
```

---

## Шаг 1 — ввод IP (connect)

### `POST /api/missions/rdp/connect`

**Auth:** Player only

**Body (Zod):**

```typescript
const connectSchema = z.object({
  ip: z.string().regex(/^\d{1,3}(\.\d{1,3}){3}$/, "Неверный формат IP"),
});
```

**Алгоритм:**

```typescript
async function handleConnect(userId: string, ip: string) {
  // 1. Поиск слота по correctIp
  const slot = await prisma.missionSlot.findFirst({
    where: {
      missionType: "RDP",
      correctIp: ip,
      isActive: true,
    },
    select: {
      id: true,
      slotKey: true,
      displayName: true,
      rdpScenario: true,
      timerSeconds: true,
      rdpPuzzleGridSize: true,
      logSubjectName: true,
      hintText: true,
    },
  });

  if (!slot) {
    await writeLog({
      userId,
      templateKey: "rdp_invalid_ip",
      params: { ip },
      type: "ERROR",
    });
    return error(400, "INVALID_IP");
  }

  // 2. Проверить, что миссия не пройдена
  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  return {
    slotKey: slot.slotKey,
    displayName: slot.displayName,
    rdpScenario: slot.rdpScenario,
    isCompleted: progress?.completed ?? false,
    logSubjectName: slot.logSubjectName,
    hintText: slot.hintText,
  };
}
```

**Response 200 (IP корректный):**

```json
{
  "slotKey": "RDP_VICTOR",
  "displayName": "Удалённый доступ к компьютеру Виктора",
  "rdpScenario": 1,
  "isCompleted": false,
  "logSubjectName": "Виктор",
  "hintText": "..."
}
```

**Response 400:**

- `INVALID_IP` — формат IP не валиден или такой IP не привязан ни к одному активному слоту

**Rate limit:** 10 / мин на userId. Защита от перебора всех IP.

---

## Шаг 2 — пазл-трубопровод

### Игровая механика

Игрок видит сетку плиток (6×6 или 7×7). Каждая плитка содержит фрагмент трубопровода:

- Прямая (горизонтальная или вертикальная)
- Угол (4 варианта)
- Тройник (4 варианта)
- Возможно: крестовина

Плитка может быть повёрнута на 0°, 90°, 180°, 270°. Поворот — клик по плитке.

**Цель:** соединить точку входа с точкой выхода (сценарий 1) или две пары вход-выход (сценарий 2).

### Серверная спецификация

На уровне модуля (этой документации) задаётся минимально необходимая логика:

**Поле:**

```typescript
type Tile = {
  id: string; // 'r0c0', 'r0c1', ...
  type: "STRAIGHT" | "CORNER" | "TEE" | "CROSS" | "EMPTY";
  rotation: 0 | 90 | 180 | 270;
  isLocked: boolean; // некоторые плитки могут быть фиксированы (источник, приёмник)
};

type PuzzleField = {
  gridSize: number; // 6 или 7
  tiles: Tile[]; // длина = gridSize * gridSize
  entries: { row: number; col: number }[]; // точки входа
  exits: { row: number; col: number }[]; // точки выхода
};
```

**Проверка решения** — DFS/BFS от каждой `entry` до соответствующего `exit`. Если все пары соединены → `isSolved=true`.

**Точная реализация выбирается в Фазе 7a — Research-таск первым:**

Первый таск Фазы 7a — research-таск (1 рабочий день максимум):

1. Поиск и оценка готовых npm-библиотек:
   - Кандидаты: `pipes-puzzle`, `flow-game-engine`, `react-pipes`, прочие из npm с ключевыми словами «pipe», «flow», «puzzle»
   - Критерии оценки: поддержка кастомного UI, размер бандла, последний релиз < 2 лет, лицензия совместима с MIT
2. Если найдена подходящая либа — задача №2 фазы: интеграция с нашими типами `Tile`/`PuzzleField`
3. Если за 1 день не найдено — переход к собственной реализации:
   - Вариант B: собственный генератор + solver (среднее усилие, ~4-6 дней для junior+/middle)
   - Вариант B обязательно должен пройти ревью архитектурой перед началом работы

**Что важно для спецификации (независимо от варианта):** алгоритм должен генерировать **разрешимое** поле — существует ориентация плиток, при которой все пары входов/выходов соединены. Стандартный приём: сначала строится корректное решение (известная конфигурация), затем плитки случайно поворачиваются с гарантией, что решение остаётся возможным.

**Минимальные требования к выбранному решению:**

- Поддержка сеток 6×6 и 7×7
- Поддержка двух независимых путей (для сценария 2)
- DFS/BFS проверка соединения в `checkSolution(field): boolean`
- Сериализация состояния в JSON (для хранения в `MissionProgress.metadata.puzzleField`)

### Состояние пазла на сервере

Хранится в `MissionProgress.metadata.puzzleField: PuzzleField`. Создаётся при первом обращении игрока к пазлу.

```typescript
// MissionProgress.metadata
{
  "puzzleField": { /* PuzzleField */ },
  "puzzleSolved": false,
  "timerExpiredCount": 0,
  "timerStartedAt": "2026-05-08T12:00:00Z" // только для сценария 2
}
```

### `GET /api/missions/rdp/[slotKey]/puzzle-state`

Возвращает текущее состояние пазла. Если пазла ещё нет — генерирует и сохраняет.

**Response 200:**

```json
{
  "puzzleField": {
    /* PuzzleField */
  },
  "puzzleSolved": false,
  "timerSeconds": 120,
  "timerStartedAt": "2026-05-08T12:00:00Z",
  "timerRemaining": 95
}
```

`timerSeconds`, `timerStartedAt`, `timerRemaining` — только для сценария 2. Для сценария 1 — отсутствуют.

### `POST /api/missions/rdp/[slotKey]/rotate-tile`

**Body:**

```json
{ "tileId": "r0c0" }
```

Сервер обновляет `puzzleField.tiles[i].rotation` (поворот на +90° по модулю 360°). Возвращает обновлённое поле.

**Альтернатива batch:** отправлять всё поле в `/check-puzzle`. Решается на этапе реализации.

### `POST /api/missions/rdp/[slotKey]/check-puzzle`

Сервер проверяет соединение через DFS/BFS. Если все пары соединены:

```typescript
metadata.puzzleSolved = true;
await writeLog({
  userId,
  templateKey: "rdp_puzzle_solved",
  params: { logSubjectName },
  type: "SUCCESS",
});
```

**Response 200:**

```json
{ "isSolved": true }
```

или

```json
{ "isSolved": false }
```

### `POST /api/missions/rdp/[slotKey]/timer-expired`

Только для сценария 2. Вызывается клиентом, когда таймер истёк.

**Алгоритм:**

1. Серверная проверка: реально ли таймер истёк (по `metadata.timerStartedAt`). Защита от досрочного вызова через DevTools.
2. Инкремент `metadata.timerExpiredCount`
3. Генерация **нового** `puzzleField`
4. `metadata.timerStartedAt = new Date()`
5. Лог `rdp_timer_expired`

**Response 200:**

```json
{
  "newPuzzleField": {
    /* PuzzleField */
  },
  "timerStartedAt": "2026-05-08T12:05:00Z",
  "timerSeconds": 120,
  "canSkip": true
}
```

`canSkip: true` — если `timerExpiredCount >= 2` И `rdpScenario === 2` после этого истечения. Клиент показывает кнопку «Пропустить».

---

## Шаг 3 — симуляция Windows

После решения пазла (`metadata.puzzleSolved=true`) клиент дёргает:

### `GET /api/missions/rdp/[slotKey]/files`

**Алгоритм:**

```typescript
async function getFiles(userId: string, slotKey: string) {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    include: { rdpFiles: true },
  });

  // Защита: пазл должен быть решён
  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });
  if (!progress?.metadata?.puzzleSolved) {
    return error(400, "PUZZLE_NOT_SOLVED");
  }

  // Группируем файлы по folder
  const folders = groupBy(slot.rdpFiles, "folder");

  // Для каждой папки определяем isLocked (одинаков для всех файлов в папке)
  const result = Object.entries(folders).map(([folderName, files]) => ({
    folderName,
    isLocked: files[0].isLocked, // инвариант: все файлы папки имеют одинаковый isLocked
    isUnlocked:
      progress.metadata?.unlockedFolders?.includes(folderName) ?? false,
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      url:
        progress.metadata?.unlockedFolders?.includes(folderName) || !f.isLocked
          ? f.url
          : null, // не отдаём ссылку, если папка запаролена и не разблокирована
      size: f.size,
    })),
  }));

  return { folders: result };
}
```

**Response 200:**

```json
{
  "folders": [
    {
      "folderName": "Документы",
      "isLocked": false,
      "isUnlocked": false,
      "files": [
        {
          "id": "f1",
          "name": "report.pdf",
          "url": "https://...",
          "size": 145000
        }
      ]
    },
    {
      "folderName": "Маркова",
      "isLocked": true,
      "isUnlocked": false,
      "files": [
        { "id": "f2", "name": "secret.pdf", "url": null, "size": 89000 }
      ]
    }
  ]
}
```

### `POST /api/missions/rdp/[slotKey]/unlock-folder`

**Body:**

```typescript
const unlockSchema = z.object({
  folderName: z.string().min(1),
  password: z.string().min(1),
});
```

**Алгоритм:**

```typescript
async function unlockFolder(
  userId: string,
  slotKey: string,
  folderName: string,
  password: string,
) {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    include: { rdpFiles: true },
  });
  if (!slot) return error(404, 'SLOT_NOT_FOUND');

  // Поиск Decipher-слота, который явно ссылается на эту папку и этот RDP-слот
  // Связь структурная (FK через unlocksRdpFolder + unlocksRdpSlotKey), без манипуляций со строками
  const matchingSlot = await prisma.missionSlot.findFirst({
    where: {
      missionType: 'DECIPHER',
      isActive: true,
      folderPassword: password,
      unlocksRdpFolder: folderName,
      unlocksRdpSlotKey: slotKey,
    },
    select: { id: true },
  });

  if (!matchingSlot) {
    return error(400, 'INVALID_PASSWORD');
  }

  // Проверка, что эта папка действительно запаролена в данном RDP-слоте
  const folderFiles = slot.rdpFiles.filter((f) => f.folder === folderName);
  if (folderFiles.length === 0) {
    return error(404, "FOLDER_NOT_FOUND");
  }
  if (!folderFiles[0].isLocked) {
    return error(400, "FOLDER_NOT_LOCKED");
  }

  // Записываем в metadata.unlockedFolders
  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });
  const unlockedFolders =
    (progress?.metadata?.unlockedFolders as string[]) ?? [];
  if (!unlockedFolders.includes(folderName)) {
    unlockedFolders.push(folderName);
  }

  await prisma.missionProgress.update({
    where: { userId_slotId: { userId, slotId: slot.id } },
    data: {
      metadata: {
        ...(progress?.metadata as object),
        unlockedFolders,
      },
    },
  });

  // Записываем лог rdp_folder_unlocked — для UX: игрок видит пароль и путь в OperationLog
  const decipherSlot = await prisma.missionSlot.findFirst({
    where: {
      missionType: 'DECIPHER',
      unlocksRdpFolder: folderName,
      unlocksRdpSlotKey: slotKey,
    },
    select: { folderPassword: true, folderPath: true },
  });
  await writeLog({
    userId,
    templateKey: 'rdp_folder_unlocked',
    params: {
      folderPath: decipherSlot?.folderPath ?? folderName,
      folderPassword: decipherSlot?.folderPassword ?? '—',
      logSubjectName: slot.logSubjectName ?? '—',
    },
    type: 'SUCCESS',
  });

  return { success: true, folderName };
}
```

**Response 200:**

```json
{ "success": true, "folderName": "Маркова" }
```

**Response 400:**

- `INVALID_PASSWORD` — пароль не совпадает с `folderPassword` ни одного Decipher-слота, привязанного к этой папке
- `FOLDER_NOT_LOCKED` — папка не запаролена

✅ **Архитектура связи:** связь между RDP-папкой и Decipher-слотом структурная, через два поля в `MissionSlot`:
- `unlocksRdpFolder` — имя папки (равно `RdpFile.folder`)
- `unlocksRdpSlotKey` — `slotKey` целевого RDP-слота

При `/unlock-folder` сервер ищет Decipher-слот по точному совпадению пароля + обоих полей FK. Никаких сравнений по подстрокам или сегментам пути — это исключает ложные срабатывания при похожих именах папок.

**Опциональность полей:** оба поля `unlocksRdpFolder` и `unlocksRdpSlotKey` могут быть `null` (для Decipher-слотов, не связанных с RDP — если такие появятся в будущем).

**`folderPath` сохраняется** как отображаемая строка для копирования игроком в UI («путь к папке»). Это не используется в логике разблокировки.

**Инвариант для админа:** при сохранении Decipher-слота с заполненными `unlocksRdpFolder`/`unlocksRdpSlotKey` админка проверяет существование соответствующего RDP-слота и `RdpFile` с `folder === unlocksRdpFolder, isLocked === true`. Если связь невалидна — баннер-предупреждение, но НЕ блокирует сохранение (см. `admin.md`).

---

## Шаг 4 — сюжетный триггер

Сюжетный триггер срабатывает **автоматически на сервере**, когда игрок просмотрел все файлы во всех когда-либо доступных папках. Игрок не «нажимает на приманку» — триггер вычисляется самим сервером после каждого закрытия PDF.

### Эндпоинт `POST /api/missions/rdp/[slotKey]/file-viewed`

Клиент вызывает этот эндпоинт **при закрытии окна с PDF** (когда игрок закрыл просмотрщик). Сервер запоминает факт просмотра, проверяет «все ли просмотрены», и при необходимости активирует триггер.

**Auth:** Player only

**Body (Zod):**
```typescript
const fileViewedSchema = z.object({
  fileId: z.string().cuid(),
});
```

**Алгоритм:**

```typescript
async function handleFileViewed(userId: string, slotKey: string, fileId: string) {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: {
      id: true, missionType: true, isActive: true,
      rdpScenario: true, logSubjectName: true,
    },
    include: { rdpFiles: true },
  });
  if (!slot || slot.missionType !== 'RDP' || !slot.isActive) {
    return error(404, 'SLOT_NOT_FOUND');
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } }
  });

  // Защита: пазл должен быть решён
  if (!progress?.metadata?.puzzleSolved) {
    return error(400, 'PUZZLE_NOT_SOLVED');
  }

  // Защита: триггер уже активирован — повторно не активируем
  if (progress.metadata?.triggerActivated) {
    return { triggered: true, alreadyTriggered: true };
  }

  // Защита: fileId должен принадлежать этому слоту
  const file = slot.rdpFiles.find(f => f.id === fileId);
  if (!file) {
    return error(404, 'FILE_NOT_FOUND_IN_SLOT');
  }

  // Защита: файл из ещё неразблокированной папки нельзя «просмотреть»
  const unlockedFolders = (progress.metadata?.unlockedFolders as string[]) ?? [];
  if (file.isLocked && !unlockedFolders.includes(file.folder)) {
    return error(400, 'FOLDER_NOT_UNLOCKED');
  }

  // Записываем fileId в viewedFileIds (если ещё не было)
  const viewedFileIds = (progress.metadata?.viewedFileIds as string[]) ?? [];
  const updatedViewed = viewedFileIds.includes(fileId)
    ? viewedFileIds
    : [...viewedFileIds, fileId];

  // Подсчёт всех доступных файлов:
  // - все файлы из папок с isLocked=false
  // - все файлы из папок, которые есть в unlockedFolders
  const accessibleFiles = slot.rdpFiles.filter(f =>
    !f.isLocked || unlockedFolders.includes(f.folder)
  );
  const accessibleFileIds = accessibleFiles.map(f => f.id);

  // Все ли доступные файлы просмотрены?
  const allViewed = accessibleFileIds.every(id => updatedViewed.includes(id));

  if (!allViewed) {
    // Просто обновляем metadata, триггер не активируем
    await prisma.missionProgress.update({
      where: { userId_slotId: { userId, slotId: slot.id } },
      data: {
        metadata: {
          ...(progress.metadata as object),
          viewedFileIds: updatedViewed,
        },
      },
    });
    return { triggered: false };
  }

  // Все файлы просмотрены — активируем триггер
  await prisma.missionProgress.update({
    where: { userId_slotId: { userId, slotId: slot.id } },
    data: {
      metadata: {
        ...(progress.metadata as object),
        viewedFileIds: updatedViewed,
        triggerActivated: true,
      },
    },
  });

  // Сценарийная логика
  if (slot.rdpScenario === 1) {
    // Найти IP следующего RDP-слота через nextRdpSlotKey
    let nextIp = '—';
    if (slot.nextRdpSlotKey) {
      const nextSlot = await prisma.missionSlot.findUnique({
        where: { slotKey: slot.nextRdpSlotKey },
        select: { correctIp: true },
      });
      nextIp = nextSlot?.correctIp ?? '—';
    }

    await writeLog({
      userId,
      templateKey: 'rdp_session_lost',
      params: {
        logSubjectName: slot.logSubjectName ?? 'Неизвестно',
        nextIp,
      },
      type: 'ERROR',
    });
    return { triggered: true, scenarioFinal: 'session_lost', nextIp };
  }

  if (slot.rdpScenario === 2) {
    await prisma.gameProgress.update({
      where: { userId },
      data: { marinaTriggered: true },
    });
    await advanceTriggerListeners(userId, 'rdp_marina_triggered');
    // Лог про активацию Марины не пишется — это сюжетный момент,
    // отражается в чате
    return { triggered: true, scenarioFinal: 'session_terminated' };
  }

  return error(500, 'UNKNOWN_SCENARIO');
}
```

**Response 200 (триггер ещё не активирован):**
```json
{ "triggered": false }
```

**Response 200 (только что активирован, сценарий 1):**
```json
{ "triggered": true, "scenarioFinal": "session_lost" }
```

**Response 200 (только что активирован, сценарий 2):**
```json
{ "triggered": true, "scenarioFinal": "session_terminated" }
```

**Response 200 (повторный вызов после триггера):**
```json
{ "triggered": true, "alreadyTriggered": true }
```

**Response 400:**
- `PUZZLE_NOT_SOLVED` — пазл не пройден
- `FOLDER_NOT_UNLOCKED` — игрок пытается отметить просмотренным файл из ещё запароленной папки

**Response 404:**
- `SLOT_NOT_FOUND`, `FILE_NOT_FOUND_IN_SLOT`

### Поведение клиента

```tsx
const handleClosePdf = async (fileId: string) => {
  setPdfOpen(false); // визуально закрываем PDF

  const res = await fetch(`/api/missions/rdp/${slotKey}/file-viewed`, {
    method: 'POST',
    body: JSON.stringify({ fileId }),
  });
  const data = await res.json();

  if (data.triggered && !data.alreadyTriggered) {
    // Скрываем все файлы из UI (симуляция взлома)
    setFilesHidden(true);

    if (data.scenarioFinal === 'session_lost') {
      // Сценарий 1: показываем модалку «2 активных сеанса» при следующем действии
      setShowSessionLostModal(true);
    } else if (data.scenarioFinal === 'session_terminated') {
      // Сценарий 2: сразу показываем «Сеанс прерван»
      setShowSessionTerminatedModal(true);
    }
  }
};
```

### Логика «следующего действия» в сценарии 1

По ТЗ: после закрытия последнего файла в сценарии 1 — файлы скрываются, и **любое следующее действие** (попытка открыть папку, закрыть окно, кликнуть куда угодно в симуляции) должно показать модалку «2 активных сеанса».

Реализация на клиенте:
- Состояние `triggerActivated` хранится в Zustand-сторе.
- Любой обработчик клика в `WindowsSimulation` проверяет `triggerActivated` — если true и модалка ещё не показана, открывает её.
- В модалке — сообщение «2 активных сеанса», возможность скопировать IP, кнопка «Закрыть».
- После закрытия модалки клиент вызывает `POST /api/missions/rdp/[slotKey]/complete`.

### Логика для сценария 2

Проще — после закрытия последнего файла **сразу** показывается модалка «Сеанс прерван». Никаких дополнительных кликов не требуется. После закрытия — `/complete`.

### Старый эндпоинт `/trigger-error` удалён

Эндпоинт `POST /api/missions/rdp/[slotKey]/trigger-error` **удалён** — его функциональность теперь внутри `/file-viewed`. В прежней документации он был основан на «приманке» (клик на специальный файл), но ТЗ заказчика требует автоматического определения триггера по факту изучения всех файлов.

---

## Шаг 5 — завершение (complete)

### `POST /api/missions/rdp/[slotKey]/complete`

**Алгоритм:**

```typescript
async function handleComplete(userId: string, slotKey: string) {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: { id: true, displayName: true },
  });
  if (!slot) return error(404);

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  // Защита: триггер должен быть активирован
  if (!progress?.metadata?.triggerActivated) {
    return error(400, "TRIGGER_NOT_ACTIVATED");
  }

  const overviewMessage = renderLogMessage("mission_completed_overview", {
    displayName: slot.displayName,
  });
  const techMessage = renderLogMessage("rdp_completed", {});

  await prisma.$transaction([
    prisma.missionProgress.update({
      where: { userId_slotId: { userId, slotId: slot.id } },
      data: { completed: true, completedAt: new Date() },
    }),
    prisma.operationLog.create({
      data: { userId, type: "SUCCESS", message: techMessage },
    }),
    prisma.operationLog.create({
      data: { userId, type: "SUCCESS", message: overviewMessage },
    }),
  ]);

  await advanceTriggerListeners(userId, `rdp_completed:${slotKey}`);

  return { success: true };
}
```

**Response 200:**

```json
{ "success": true }
```

**Response 400:**

- `TRIGGER_NOT_ACTIVATED` — `metadata.triggerActivated` не установлен (игрок не закрыл все доступные файлы или пазл не пройден). Защита от прямого вызова `/complete`.

---

## Шаг 6 — пропуск миссии (skip, только сценарий 2)

### `POST /api/missions/rdp/[slotKey]/skip`

**Auth:** Player only

**Body:** пустой

**Проверки:**
1. Слот существует, активен, `missionType=RDP`.
2. `rdpScenario === 2` — иначе 400 `SKIP_NOT_ALLOWED_SCENARIO_1`.
3. `metadata.timerExpiredCount >= 2` — иначе 400 `CANNOT_SKIP`.

**Транзакция:**
- UPDATE `MissionProgress`: `completed=true, completedAt=now, metadata.skipped=true, metadata.triggerActivated=true`
- UPDATE `GameProgress`: `marinaTriggered=true`
- INSERT `OperationLog` `rdp_completed`
- INSERT `OperationLog` `mission_completed_overview`

**Вне транзакции:**
- `advanceTriggerListeners(userId, 'rdp_completed:<slotKey>')`
- `advanceTriggerListeners(userId, 'rdp_marina_triggered')`

**Response 200:**
```json
{ "success": true, "skipped": true }
```

**Response 400:**
- `SKIP_NOT_ALLOWED_SCENARIO_1` — пропуск недоступен для сценария 1.
- `CANNOT_SKIP` — `timerExpiredCount < 2`. Защита от прямого вызова через DevTools.
- `SLOT_NOT_FOUND` — слот не найден или не активен.

---

## Защита от обхода

### Цепь проверок

Каждый шаг проверяет флаги предыдущих:

| Эндпоинт                                         | Что проверяет                                          |
| ------------------------------------------------ | ------------------------------------------------------ |
| `/connect`                                       | Только формат IP и наличие слота с таким `correctIp`   |
| `/puzzle-state`, `/rotate-tile`, `/check-puzzle` | Слот корректный, пазл не решён (`puzzleSolved=false`)  |
| `/timer-expired`                                 | Реально ли таймер истёк (по `metadata.timerStartedAt`) |
| `/files`, `/unlock-folder`                       | `puzzleSolved=true`                                    |
| `/file-viewed`                                   | `puzzleSolved=true`, `fileId` принадлежит слоту, файл из доступной папки (`!isLocked` или из `unlockedFolders`) |
| `/complete`                                      | `triggerActivated=true`                                |

Если игрок попытается вызвать `/complete` напрямую без прохождения — `metadata.triggerActivated` отсутствует → 400.

### Защита `/timer-expired` от досрочного вызова

```typescript
const elapsedMs =
  Date.now() - new Date(progress.metadata.timerStartedAt).getTime();
const timerMs = (slot.timerSeconds ?? 120) * 1000;
if (elapsedMs < timerMs - 1000) {
  // запас 1 сек на сетевую задержку
  return error(400, "TIMER_NOT_EXPIRED");
}
```

Без этой проверки игрок мог бы через DevTools мгновенно вызвать `/timer-expired` и получить новое поле — что не атака, но обход геймплея.

### `targetUrl`, `correctIp` и т.п. — НЕ возвращаются клиенту до прохождения

`MissionSlot.correctIp` — серверный секрет. Клиент только отправляет ввод, сервер сам ищет совпадение.

После прохождения миссии — `correctIp` всё ещё не нужен клиенту (миссия уже пройдена), не возвращаем.

### Защита `/unlock-folder` от перебора паролей

Rate limit: 10 / мин на (userId, slotKey). Защита от автоперебора паролей. При нормальной игре игрок вводит пароль 1-2 раза.

### Защита `/skip`

`/skip` доступен только для слотов `rdpScenario=2` и только при `timerExpiredCount >= 2`. Прямой вызов через DevTools для сценария 1 → 400 `SKIP_NOT_ALLOWED_SCENARIO_1`. Для сценария 2 при `timerExpiredCount < 2` → 400 `CANNOT_SKIP`.

### Окно RDP сценария 1 — UI-инвариант

Серверной защиты нет. Игрок через DevTools может закрыть модалку, но повторное открытие плашки покажет ту же миссию в текущем состоянии — это нормально. Кнопка «Закрыть» скрыта клиентом до `unlockedFolders.length >= 1`.

---

## API-эндпоинты

| Метод | Путь                                        | Назначение                | Auth   |
| ----- | ------------------------------------------- | ------------------------- | ------ |
| POST  | `/api/missions/rdp/connect`                 | Ввод IP (Mission Launcher) | Player |
| GET   | `/api/missions/rdp/[slotKey]/puzzle-state`  | Состояние пазла           | Player |
| POST  | `/api/missions/rdp/[slotKey]/rotate-tile`   | Поворот плитки            | Player |
| POST  | `/api/missions/rdp/[slotKey]/check-puzzle`  | Проверка решения          | Player |
| POST  | `/api/missions/rdp/[slotKey]/timer-expired` | Таймер истёк (сценарий 2) | Player |
| GET   | `/api/missions/rdp/[slotKey]/files`         | Список папок и файлов     | Player |
| POST  | `/api/missions/rdp/[slotKey]/unlock-folder` | Разблокировка папки       | Player |
| POST  | `/api/missions/rdp/[slotKey]/file-viewed`   | Регистрация просмотра PDF + автоопределение триггера | Player |
| POST  | `/api/missions/rdp/[slotKey]/complete`      | Финальное завершение      | Player |
| POST  | `/api/missions/rdp/[slotKey]/skip`          | Пропуск миссии (только сценарий 2, при `timerExpiredCount >= 2`) | Player |

**Rate limits:**

- `/connect`: 10 / мин на userId
- `/unlock-folder`: 10 / мин на (userId, slotKey)
- Остальные: без специальных лимитов (защита через флаги в `metadata`)

---

## UI миссии

### Модалка миссии — несколько режимов

```tsx
// components/game/rdp/RdpModal.tsx
'use client';

const [stage, setStage] = useState<'connect' | 'puzzle' | 'files' | 'completed'>('connect');

switch (stage) {
  case 'connect':   return <RdpConnect onSuccess={(slotKey) => /* загрузить пазл, setStage('puzzle') */} />;
  case 'puzzle':    return <PipesPuzzle slotKey={slotKey} onSolved={() => setStage('files')} />;
  case 'files':     return <WindowsSimulation slotKey={slotKey} onComplete={() => setStage('completed')} />;
  case 'completed': return <RdpCompletedView />;
}
```

### Стадия 1 — Connect (Mission Launcher)

Поле ввода IP + кнопка «Подключиться» + кнопка «?» (`hintText`). Это форма запуска миссии (Mission Launcher) — аналогично Crack и Decipher. IP задаётся игроком, сервер ищет слот по `correctIp`.

### Стадия 2 — Puzzle

Сетка плиток (6×6 или 7×7). Каждая плитка — кликабельная. При клике — `/rotate-tile`. Над сеткой:

- Сценарий 2: таймер обратного отсчёта
- Сценарий 1: счётчик попыток (опционально)
- Кнопка «Проверить» → `/check-puzzle`

**Для сценария 2:** при `timerExpiredCount >= 2` (из ответа `/timer-expired`) — отображается кнопка «Пропустить миссию» (`RdpSkipButton`). При нажатии → модалка-предупреждение `RdpSkipConfirmModal` → `POST /api/missions/rdp/<slotKey>/skip`.

### Стадия 3 — Files (симуляция Windows)

Дизайн «рабочего стола Windows»:

- Иконки папок (с ключом 🔒 если `isLocked`)
- Двойной клик по папке → раскрытие списка файлов внутри
- Запароленная папка → попап «Введите пароль» → `/unlock-folder`
- Клик по PDF → открывается просмотрщик (встроенный `<iframe>` / `<embed>` или модалка с PDF.js)
- При закрытии просмотрщика клиент вызывает `POST /api/missions/rdp/[slotKey]/file-viewed { fileId }`
- Сервер автоматически отслеживает прогресс просмотра. Когда все доступные файлы просмотрены — возвращает `triggered: true`
- Клиент при `triggered: true`:
  - Сценарий 1: скрывает все файлы из UI, показывает модалку «2 активных сеанса, Новый IP: {nextIp}» (с возможностью копировать IP)
  - Сценарий 2: сразу показывает модалку «Сеанс прерван»
- После закрытия финальной модалки — `POST /complete`

**Сценарий 1 — кнопки закрытия и свёртывания:**
- Кнопка «Свернуть» (`RdpMinimizeButton`) видна **всегда** — сворачивает модалку в иконку на dashboard.
- Кнопка «Закрыть» **скрыта**, пока `metadata.unlockedFolders.length === 0`.
- При попытке закрыть через ESC / клик вне модалки — тултип «Нужно разблокировать хотя бы одну папку перед закрытием».

**Сценарий 2:** кнопка «Закрыть» доступна сразу, поведение стандартное.

### Стадия 4 — Completed

Краткое сообщение «Изучение материалов завершено». Кнопка «Закрыть».

---

## Файлы, которые создаются

```
app/
└── api/
    └── missions/
        └── rdp/
            ├── connect/route.ts                     # POST: ввод IP (Mission Launcher)
            └── [slotKey]/
                ├── puzzle-state/route.ts            # GET
                ├── rotate-tile/route.ts             # POST
                ├── check-puzzle/route.ts            # POST
                ├── timer-expired/route.ts           # POST
                ├── files/route.ts                   # GET
                ├── unlock-folder/route.ts           # POST
                ├── file-viewed/route.ts             # POST: регистрация просмотра + автотриггер
                ├── complete/route.ts                # POST
                └── skip/route.ts                    # POST: пропуск (только сценарий 2)

components/
└── game/
    └── rdp/
        ├── RdpModal.tsx                             # Client Component, главный orchestrator
        ├── RdpConnect.tsx                           # Client Component, ввод IP
        ├── RdpSkipButton.tsx                        # Client Component, кнопка «Пропустить» (сценарий 2)
        ├── RdpSkipConfirmModal.tsx                  # Client Component, модалка-предупреждение
        ├── RdpMinimizeButton.tsx                    # Client Component, кнопка «Свернуть» (сценарий 1)
        ├── PipesPuzzle.tsx                          # Client Component, сетка плиток
        ├── PipeTile.tsx                             # Client Component, одна плитка
        ├── PipeTimer.tsx                            # Client Component, таймер для сценария 2
        ├── WindowsSimulation.tsx                    # Client Component, рабочий стол
        ├── FolderIcon.tsx                           # Client Component, иконка папки
        ├── FolderContent.tsx                        # Client Component, содержимое папки
        ├── FolderPasswordPrompt.tsx                 # Client Component, попап ввода пароля
        ├── PdfViewer.tsx                            # Client Component, просмотр PDF + onClose с вызовом file-viewed
        ├── SessionLostModal.tsx                     # Client Component, «2 активных сеанса» (сценарий 1)
        ├── SessionTerminatedModal.tsx               # Client Component, «Сеанс прерван» (сценарий 2)
        ├── RdpCompletedView.tsx                     # Client Component, финальное сообщение
        └── RdpHintButton.tsx                        # Client Component, кнопка «?»

lib/
└── rdp/
    ├── pipesPuzzleGenerator.ts                      # generateField(gridSize, scenario): PuzzleField
    └── pipesSolver.ts                               # checkSolution(field): boolean — DFS/BFS
```

---

## Серверные правила

1. **`correctIp` НЕ возвращается клиенту** ни на одном эндпоинте. Игрок отправляет IP, сервер ищет.

2. **Цепь защиты через `metadata`:** каждый шаг проверяет флаг предыдущего (`puzzleSolved` → `triggerActivated` → `completed`).

3. **`/timer-expired` проверяет реальность истечения** через `metadata.timerStartedAt`. Защита от досрочного вызова.

4. **`/unlock-folder` проверяет совпадение с Decipher-слотом по структурной FK** — через одновременное равенство трёх полей: `folderPassword === password`, `unlocksRdpFolder === folderName`, `unlocksRdpSlotKey === slotKey`. Никаких сравнений по подстрокам или сегментам пути — связь определяется явными полями FK на уровне БД.

5. **`marinaTriggered` пишется ТОЛЬКО в `/file-viewed` для слотов с `rdpScenario=2`** при автоматической активации триггера (после изучения всех доступных файлов). Никаких других точек записи. См. `chats.md` → серверное правило 4.

6. **Лог `rdp_session_lost` пишется ТОЛЬКО в `/file-viewed` для слотов с `rdpScenario=1`** при автоматической активации триггера.

7. **`/complete` для RDP пишет ДВА лога** в одной транзакции: `rdp_completed` (технический) + `mission_completed_overview` (обзорный).

8. **`advanceTriggerListeners` вызывается ВНЕ транзакции** — side-effect.

9. **При перезапуске игры** — все `MissionProgress` (включая RDP) удаляются. См. `restart.md`.

10. **Bесконечные попытки пазла:** в сценарии 1 — без таймера, игрок крутит плитки сколько угодно. В сценарии 2 — после `/timer-expired` новое поле. Не блокирует прохождение.

11. **Состояние пазла на сервере:** хранится в `metadata.puzzleField`. При reload страницы — восстанавливается.

12. **Точная реализация генерации Pipes** — в Фазе 7a выбирается между npm-библиотекой и собственной реализацией. Обязательное требование: поле должно быть гарантированно решаемым.

13. **Skip доступен только для `rdpScenario=2` и только при `timerExpiredCount >= 2`.** Skip пишет те же логи и вызывает те же триггеры (включая `marinaTriggered`). Различие только в `metadata.skipped=true` (для аналитики).

14. **`rdp_folder_unlocked` пишется при каждой успешной разблокировке папки** в `/unlock-folder` — для UX заказчика: игрок видит пароль и путь в `OperationLog`.

15. **Окно RDP сценария 1 — UI-инвариант.** Кнопка «Закрыть» скрыта до `unlockedFolders.length >= 1`. Серверной защиты нет.

16. **Лог `rdp_session_lost` содержит `{nextIp}`,** полученный через `nextRdpSlotKey → correctIp` следующего RDP-слота. Fallback: `'—'` если `nextRdpSlotKey === null` или следующий слот не найден.

17. **Optimistic locking на `MissionProgress` и `GameProgress`.** Все mutate-эндпоинты (`/rotate-tile`, `/check-puzzle`, `/timer-expired`, `/unlock-folder`, `/file-viewed`, `/complete`, `/skip`) принимают `expectedVersion` в теле, возвращают обновлённую `version` в ответе. При несовпадении — HTTP 409. `/file-viewed` и `/skip` для сценария 2 могут инкрементировать `version` сразу двух таблиц (`MissionProgress` + `GameProgress` при `marinaTriggered=true`). См. `.docs/modules/concurrency.md`.

---

## Связи с другими модулями

- **`database.md`** — модели `MissionSlot` (включая новое поле `nextRdpSlotKey`), `MissionProgress`, `RdpFile`, `GameProgress` описаны там; здесь только применение.
- **`concurrency.md`** — все mutate-эндпоинты используют optimistic locking. Поля `version` на `MissionProgress` и `GameProgress` инкрементируются при UPDATE.
- **`chats.md`** — после `/complete` или `/skip` вызывается `advanceTriggerListeners(userId, 'rdp_completed:<slotKey>')`. Дополнительно: `/file-viewed` и `/skip` для сценария 2 устанавливают `marinaTriggered=true` и вызывают `rdp_marina_triggered`.
- **`logs.md`** — используются шаблоны `rdp_invalid_ip`, `rdp_puzzle_solved`, `rdp_timer_expired`, `rdp_session_lost` (расширен параметром `nextIp`), `rdp_completed`, `rdp_folder_unlocked`, `mission_completed_overview`.
- **`missions-decipher.md`** — `folderPassword` из Decipher-слотов используется для разблокировки папок в RDP. Структурная связь через FK-поля `MissionSlot.unlocksRdpFolder` + `MissionSlot.unlocksRdpSlotKey`.
- **`mobile-block.md`** — общая заглушка перехватывает на уровне корневого layout. Точечной RDP-заглушки больше нет — игрок не дойдёт до открытия RDP-модалки на устройстве, не удовлетворяющем минимальным требованиям экрана.
- **`onboarding.md`** — плашка RDP-миссии имеет `data-onboarding-id="mission-tiles"` (общий для всех плашек).
- **`restart.md`** — DELETE всех `MissionProgress` (включая `metadata.skipped`, RDP-метаданные).
- **`admin.md`** — раздел mission-slots: CRUD слотов RDP с полями `correctIp`, `rdpScenario`, `timerSeconds`, `rdpPuzzleGridSize`, `logSubjectName`, `nextRdpSlotKey`. Раздел files: загрузка PDF в `RdpFile`, привязка к слоту, изменение `isLocked` для папки. `correctIp` используется как **уникальный ключ запуска** через Mission Launcher.
- **`final-report.md`** — индикатор «миссия пройдена» в двойном триггере.
- **`auth.md`** — `lib/rateLimit.ts` переиспользуется для `/connect` и `/unlock-folder`.
- **Данные формы запуска (IP) НЕ возвращаются клиенту в виде списка валидных значений** — только подтверждение совпадения через `slotKey`.
