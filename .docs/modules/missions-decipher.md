# Модуль: Миссия «Дешифратор» (missions-decipher)

> Расшифровка зашифрованного слова по одному из двух шифров (Плейфер или Виженер).
> Связанные файлы: `.docs/database.md` (модели `MissionSlot`, `MissionProgress`), `.docs/modules/chats.md` (TRIGGER `decipher_completed:<slotKey>`), `.docs/modules/logs.md` (шаблоны логов).

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Launch (запуск миссии через форму)](#launch-запуск-миссии-через-форму)
3. [Архитектурные решения](#архитектурные-решения)
4. [Шифр Плейфера](#шифр-плейфера)
5. [Шифр Виженера](#шифр-виженера)
6. [Логика попытки (attempt)](#логика-попытки-attempt)
7. [Логика завершения (complete)](#логика-завершения-complete)
8. [Логика пропуска (skip)](#логика-пропуска-skip)
9. [Защита от обхода](#защита-от-обхода)
10. [API-эндпоинты](#api-эндпоинты)
11. [UI миссии](#ui-миссии)
12. [Файлы, которые создаются](#файлы-которые-создаются)
13. [Серверные правила](#серверные-правила)
14. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Цели модуля

После завершения этого модуля:
- Игрок открывает плашку **Дешифратор** на dashboard, вводит в форму путь к папке. Сервер ищет активный слот по точному совпадению `folderPath`. При совпадении — открывается мини-игра. При несовпадении — лог ошибки (`decipher_launch_failed`), попытки запуска не ограничены
- Открытая плашка — видит модалку с зашифрованным словом
- В зависимости от `MissionSlot.cipherType` отображается:
  - **Плейфер:** таблица 6×6 русских букв + ключевое слово над таблицей + зашифрованное слово
  - **Виженер:** числа-позиции над зашифрованным словом + ключ
- Игрок расшифровывает слово вручную (используя визуальные подсказки в UI), вводит ответ
- Сервер проверяет → при правильном ответе ставит `metadata.lastAttemptCorrect=true` и возвращает `folderPassword` + `folderPath`
- Игрок копирует пароль и путь, использует в RDP-миссии
- Лимита попыток нет — пробует, пока не получится

**Не входит в модуль:**
- Реализация шифрования на стороне заказчика (он присылает уже зашифрованное слово + ключ + результат). Сервер только **расшифровывает** при проверке ответа.
- Контент шифров — заглушки в коде, финальные через админку
- Дизайн таблицы Плейфера и UI Виженера — верстается на Tailwind по ходу фазы
- Админка для CRUD слотов — `admin.md`
- Сторонний сайт, к которому открывается доступ через папку — out of scope

---

## Launch (запуск миссии через форму)

### `POST /api/missions/decipher/launch`

**Auth:** Player only

**Rate limit:** 30 / мин на `userId` (защита от brute force)

**Body (Zod):**
```typescript
{ folderPath: z.string().min(1) }
```

**Алгоритм:**
1. Нормализация: `trim()`. **Регистр чувствителен** — `MissionSlot.folderPath` хранится как заказчик задал (например, `"C:\\Users\\Victor\\Шантаж"`).
2. Поиск слота: `MissionSlot.findFirst({ where: { missionType: 'DECIPHER', isActive: true, folderPath } })`
3. Если не нашёл → `writeLog('decipher_launch_failed', { folderPath })` → 400 `INVALID_LAUNCH_DATA`
4. Если нашёл → `{ slotKey, isCompleted: progress?.completed ?? false }`

**Response 200:**
```json
{ "slotKey": "DECIPHER_SHANTAZH", "isCompleted": false }
```

**Response 400:**
```json
{ "error": "INVALID_LAUNCH_DATA" }
```

**Response 429:** rate limit exceeded.

**Что НЕ возвращается:** список доступных слотов или намёк на правильность пути — иначе игрок может перебором узнать слоты.

---

## Архитектурные решения

### 1. Два разных шифра в одном модуле

Плейфер и Виженер — разные шифры по математике и UX, но общий флоу:
1. Игрок видит зашифрованное слово + ключ
2. Расшифровывает в уме (по визуальным подсказкам)
3. Вводит результат в одно поле
4. Сервер проверяет

Поэтому делаем **общий API** (`/attempt`, `/complete`), но разный UI и разные алгоритмы расшифровки на сервере. Логика разделения — поле `MissionSlot.cipherType: 'PLAYFAIR' | 'VIGENERE'`.

### 2. Серверная расшифровка, не клиентская

**Зачем:** клиент через DevTools может посмотреть переменные. Если расшифровка идёт на клиенте — расшифрованное слово (и `folderPassword`) видны в DevTools.

**Решение:** клиент отправляет ответ игрока в `/attempt`. Сервер сам расшифровывает `MissionSlot.encryptedWord` по `MissionSlot.cipherKey` и сравнивает с ответом игрока.

### 3. Лимита попыток нет, но есть skip после 2 провалов

**Почему нет лимита:** в отличие от Crack, в Decipher неправильный ответ — это просто опечатка или ошибка в расшифровке. «Провал» как механика не имеет смысла. Игрок продолжает пробовать, пока не получится.

**Skip:** после **2 неправильных вводов подряд** (`metadata.failedAttemptsCount >= 2`) — клиент показывает кнопку «Пропустить». Счётчик `failedAttemptsCount` **сбрасывается на 0** при правильном вводе (`isCorrect=true`) — если игрок ошибся 1 раз, затем угадал — счётчик обнуляется. Если возникнут проблемы геймплея (игрок застрял) — добавим хинт через `MissionSlot.hintText`.

### 4. Защита `/complete` через `MissionProgress.metadata.lastAttemptCorrect`

**Атака:** игрок через DevTools может вызвать `/complete` без `/attempt`.

**Защита:** при правильном `/attempt` сервер пишет в `MissionProgress.metadata`:
```json
{ "lastAttemptCorrect": true }
```

При `/complete` проверяет наличие этого флага. Без флага → 400.

**После успешного `/complete`** — флаг можно убрать (флаг не нужен дальше). Но проще не трогать — `MissionProgress.completed=true` важнее. См. серверное правило 7.

### 5. `MissionProgress` создаётся при первом `/attempt`, а не при открытии модалки

При первом обращении к `GET /api/missions/decipher/[slotKey]` — `MissionProgress` ещё нет. Запись создаётся при первом `/attempt` (в момент попытки). Это упрощает: нет «ленивого» создания в GET.

UPSERT логика:
```typescript
await prisma.missionProgress.upsert({
  where: { userId_slotId: { userId, slotId } },
  create: { userId, slotId, completed: false, metadata: { lastAttemptCorrect: false } },
  update: { metadata: { ...existing.metadata, lastAttemptCorrect: true } },
});
```

### 6. Сценарии шифров — настраиваются per-slot

В старой документации был жёсткий маппинг: слот `DECIPHER_SHANTAZH` = Плейфер, `DECIPHER_MARKOVA` = Виженер. В нашей архитектуре — `MissionSlot.cipherType` per-slot, админ выбирает при создании. Сидер ставит дефолтные значения, но админ может изменить через UI.

### Структурная связь с RDP-папкой (для разблокировки)

Каждый Decipher-слот, который разблокирует папку в RDP-симуляции, должен содержать два FK-поля:

- `unlocksRdpFolder: String?` — имя папки в RDP-симуляции (равно `RdpFile.folder`), например `"Маркова"`
- `unlocksRdpSlotKey: String?` — `slotKey` RDP-слота, в котором эта папка находится, например `"RDP_VICTOR"`

При обработке `POST /api/missions/rdp/[slotKey]/unlock-folder` сервер ищет Decipher-слот, у которого все три условия совпадают одновременно:
- `folderPassword` равен присланному паролю
- `unlocksRdpFolder` равен имени папки
- `unlocksRdpSlotKey` равен `slotKey` текущей RDP-миссии

Если такого слота нет — возвращается `INVALID_PASSWORD`. Связь явная, без сравнений по подстрокам.

**Поле `folderPath`** остаётся как отображаемая строка для копирования игроком (например, `"C:\\Users\\Victor\\Markova"`) и для подстановки в шаблон лога `decipher_access_granted`. В логике разблокировки оно не участвует.

**Опциональность:** оба FK-поля могут быть `null` для Decipher-слотов, не связанных с RDP. На MVP все Decipher-слоты связаны с RDP.

**Валидация в админке:** при сохранении Decipher-слота с заполненными FK-полями админка проверяет существование соответствующего RDP-слота и запароленной папки. См. `admin.md` → раздел «Слоты миссий».

Это даёт расширяемость: если в будущем заказчик попросит ещё одну Decipher-миссию (например, в продолжении игры) — можно создать слот `DECIPHER_X` с любым из двух шифров.

### 8. Запуск через форму с полем folderPath

На dashboard у игрока одна плашка «Дешифратор». При клике — форма с одним полем: `Путь к папке`. `POST /api/missions/decipher/launch { folderPath }`. Сервер ищет активный слот по точному совпадению `MissionSlot.folderPath`. При несовпадении — лог `decipher_launch_failed` + 400.

### 9. Skip после 2 неправильных вводов

Аналогично Crack: при `metadata.failedAttemptsCount >= 2` → клиент показывает кнопку «Пропустить» → `POST /api/missions/decipher/<slotKey>/skip`. Сервер пишет `completed=true, skipped=true`, пишет логи `decipher_access_granted` + `mission_completed_overview`, вызывает `advanceTriggerListeners('decipher_completed:<slotKey>')`. Триггеры срабатывают как при честном прохождении.

### 7. Промежуточные логи — НЕ пишутся

Неправильные попытки расшифровки **НЕ пишутся** в `OperationLog`. Игрок видит ошибку прямо в UI (поле ввода краснеет + сообщение «Ошибка расшифровки. Попробуйте ещё раз»), дублирование в логах создавало бы шум — при подборе пароля игрок может сделать 10+ попыток, что засорило бы историю операций.

В `OperationLog` для Decipher пишутся только финальные события:
- `decipher_access_granted` — при успешной расшифровке
- `mission_completed_overview` — обзорный лог при `/complete`

Это симметрично с миссией Crack (см. `missions-crack.md`).

---

## Шифр Плейфера

### Принцип

Используется таблица 6×6 русских букв с заданным порядком, основанным на ключевом слове. Сообщение разбивается на пары букв, для каждой пары применяется правило в зависимости от их положения в таблице.

### Русский алфавит — 32 буквы

Стандартный русский алфавит — 33 буквы. Для квадратной таблицы 6×6 = 36 клеток. Делаем:
- **32 буквы** (Е и Ё объединены в одну букву Е, как в большинстве классических вариантов)
- **+ 4 пустые клетки** (заполнители) или используем 33 буквы + 3 пустых.

**Решение:** 32 буквы (Е=Ё) + 4 пустых клетки в конце таблицы. Это упрощает расшифровку — пустые клетки не используются в шифре.

```
Алфавит: А Б В Г Д Е Ж З И Й К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Ъ Ы Ь Э Ю Я
Длина: 32
```

### Построение таблицы из ключа

1. Берём ключевое слово (`MissionSlot.cipherKey`), приводим к верхнему регистру
2. Удаляем повторяющиеся буквы: ключ "ВИКТОР" → "ВИКТОР" (все уникальные)
3. Дописываем оставшиеся буквы алфавита, которых нет в ключе, по порядку
4. Заполняем таблицу 6×6, оставляя последние 4 клетки пустыми

**Пример** (ключ = "ВИКТОР"):

```
Ряд 0: В И К Т О Р
Ряд 1: А Б Г Д Е Ж
Ряд 2: З Й Л М Н П
Ряд 3: С У Ф Х Ц Ч
Ряд 4: Ш Щ Ъ Ы Ь Э
Ряд 5: Ю Я · · · ·
```

### Правила расшифровки пары букв

Зашифрованное сообщение разбивается на пары. Для каждой пары `(C1, C2)`:

1. Найти позиции (ряд, колонка) обеих букв в таблице.
2. Применить правило:
   - **Если буквы в одном ряду:** заменить каждую на букву слева в том же ряду (по циклу: если в колонке 0 → берём колонку 5).
   - **Если буквы в одной колонке:** заменить каждую на букву выше в той же колонке (циклически: если в ряду 0 → берём ряд 5).
   - **Если буквы образуют прямоугольник:** заменить каждую на букву того же ряда, но в колонке другой буквы.

3. Объединить пары → расшифрованное слово.

**Пример расшифровки** (пары: `ВИ`, `КТ`):
- `(В,И)`: В=(0,0), И=(0,1). Один ряд. Сдвиг влево: В→Я (ряд 0 в нашем примере, но при циклическом сдвиге В колонка 0 → переход на колонку 5 = Р). И→В (колонка 0). Это иллюстративный пример; точные пары зависят от реального шифра, который пришлёт заказчик.

### Алгоритм расшифровки на сервере

```typescript
// lib/decipher/playfair.ts
const ALPHABET_RU = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'; // 32 буквы (Е=Ё)
const TABLE_SIZE = 6;

export function buildPlayfairTable(key: string): string[][] {
  // 1. Нормализация ключа: верхний регистр, замена Ё на Е, удаление повторов
  const normalizedKey = key.toUpperCase().replace(/Ё/g, 'Е');
  const seen = new Set<string>();
  const tableChars: string[] = [];

  for (const ch of normalizedKey) {
    if (ALPHABET_RU.includes(ch) && !seen.has(ch)) {
      seen.add(ch);
      tableChars.push(ch);
    }
  }

  // 2. Дописываем оставшиеся буквы алфавита
  for (const ch of ALPHABET_RU) {
    if (!seen.has(ch)) {
      seen.add(ch);
      tableChars.push(ch);
    }
  }

  // 3. Заполняем таблицу 6×6 (последние 4 клетки — пустые)
  const table: string[][] = [];
  for (let row = 0; row < TABLE_SIZE; row++) {
    const rowChars: string[] = [];
    for (let col = 0; col < TABLE_SIZE; col++) {
      const idx = row * TABLE_SIZE + col;
      rowChars.push(idx < tableChars.length ? tableChars[idx] : ''); // пустая клетка
    }
    table.push(rowChars);
  }

  return table;
}

export function decipherPlayfair(encryptedWord: string, key: string): string {
  const table = buildPlayfairTable(key);
  const cleaned = encryptedWord.toUpperCase().replace(/Ё/g, 'Е');

  // Разбиваем на пары
  if (cleaned.length % 2 !== 0) {
    throw new Error('PLAYFAIR_ODD_LENGTH'); // длина должна быть чётной
  }

  let result = '';
  for (let i = 0; i < cleaned.length; i += 2) {
    const c1 = cleaned[i];
    const c2 = cleaned[i + 1];
    const [r1, col1] = findInTable(table, c1);
    const [r2, col2] = findInTable(table, c2);

    if (r1 === r2) {
      // Один ряд — сдвиг влево (циклически)
      const newCol1 = (col1 - 1 + TABLE_SIZE) % TABLE_SIZE;
      const newCol2 = (col2 - 1 + TABLE_SIZE) % TABLE_SIZE;
      // Защита от попадания на пустую ячейку (буквы Ю/Я в последнем ряду)
      if (table[r1][newCol1] === '' || table[r2][newCol2] === '') {
        throw new Error('PLAYFAIR_EMPTY_CELL'); // плохой контент слота — см. ограничение ниже
      }
      result += table[r1][newCol1] + table[r2][newCol2];
    } else if (col1 === col2) {
      // Одна колонка — сдвиг вверх (циклически)
      const newR1 = (r1 - 1 + TABLE_SIZE) % TABLE_SIZE;
      const newR2 = (r2 - 1 + TABLE_SIZE) % TABLE_SIZE;
      // Защита от попадания на пустую ячейку
      if (table[newR1][col1] === '' || table[newR2][col2] === '') {
        throw new Error('PLAYFAIR_EMPTY_CELL');
      }
      result += table[newR1][col1] + table[newR2][col2];
    } else {
      // Прямоугольник — буквы в том же ряду, но колонки меняются
      result += table[r1][col2] + table[r2][col1];
    }
  }

  return result;
}

function findInTable(table: string[][], char: string): [number, number] {
  for (let r = 0; r < TABLE_SIZE; r++) {
    for (let c = 0; c < TABLE_SIZE; c++) {
      if (table[r][c] === char) return [r, c];
    }
  }
  throw new Error(`PLAYFAIR_CHAR_NOT_FOUND:${char}`);
}
```

### UI Плейфера

Игрок видит:
1. Таблицу 6×6 (рендерится из `MissionSlot.cipherKey` через `buildPlayfairTable`)
2. Над таблицей — ключевое слово
3. Зашифрованное слово (`MissionSlot.encryptedWord`) — крупно, разбито на пары
4. Поле ввода для расшифрованного слова
5. Кнопка «Подтвердить»

**Где рендерить таблицу — на клиенте или сервере:**
Клиент. Таблица детерминирована по ключу — функцию `buildPlayfairTable` дублируем (или импортируем) на клиенте. Это **не утечка**, потому что ключ и так публичен (показан игроку), а сама расшифровка делается серверно.

```typescript
// lib/decipher/playfair.client.ts (если потребуется отдельная клиентская копия)
// Или импортируем напрямую из lib/decipher/playfair.ts если код изоморфен
```

### Ограничение: буквы Ю и Я в контенте слота

**`encryptedWord` и `cipherKey` для шифра Плейфера не должны содержать буквы Ю и Я.**

Причина: в таблице 6×6 ряд 5 содержит только две буквы (`Ю col=0`, `Я col=1`), остальные 4 ячейки — пустые. При циклическом сдвиге влево:
- `Ю` (col 0) → переходит на col 5 → пустая ячейка → `findInTable` не найдёт → ошибка `PLAYFAIR_EMPTY_CELL`
- `Я` (col 1) → переходит на col 0 — это `Ю`, безопасно. Но `Ю` → col 5 — пустая.

**На уровне кода:** `decipherPlayfair` бросает `PLAYFAIR_EMPTY_CELL` при попадании на пустую ячейку. Сервер в `/api/missions/decipher/[slotKey]/attempt` должен перехватить эту ошибку и вернуть `500 'BAD_SLOT_CONTENT'` (не `400` — это ошибка конфигурации, не ошибка игрока).

**На уровне админки:** при сохранении Decipher-слота с `cipherType === 'PLAYFAIR'` — показывать предупреждение, если `encryptedWord` или `cipherKey` содержат буквы `Ю` или `Я`. Валидация реализуется при разработке Фазы 6 и Фазы 10b.

---

## Шифр Виженера

### Принцип

Над каждой буквой зашифрованного слова стоит число — позиция (от 0 или от 1) в алфавите. Ключ — слово, повторяющееся под зашифрованным. Чтобы расшифровать букву, нужно из её позиции вычесть позицию буквы ключа (по модулю длины алфавита).

### Визуальное представление в UI

```
Зашифрованное слово:    Е  Й  Ы  Ц
Числа над буквами:     [5][9][27][22]
Ключ (повторяется):     В  И  К  Т
```

Игрок видит:
- Зашифрованное слово
- Числа над каждой буквой
- Ключевое слово (`MissionSlot.cipherKey`) под зашифрованным или отдельно
- Должен расшифровать вручную

### Алгоритм расшифровки на сервере

**Соглашение:** позиции букв 0-индексированные (А=0, Б=1, ..., Я=31). 32-буквенный алфавит (Е=Ё, как в Плейфере).

```typescript
// lib/decipher/vigenere.ts
const ALPHABET_RU = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const ALPHABET_LEN = 32;

export function decipherVigenere(encryptedWord: string, key: string): string {
  const cleaned = encryptedWord.toUpperCase().replace(/Ё/g, 'Е');
  const cleanedKey = key.toUpperCase().replace(/Ё/g, 'Е');

  let result = '';
  for (let i = 0; i < cleaned.length; i++) {
    const encIdx = ALPHABET_RU.indexOf(cleaned[i]);
    const keyIdx = ALPHABET_RU.indexOf(cleanedKey[i % cleanedKey.length]);

    if (encIdx === -1 || keyIdx === -1) {
      throw new Error(`VIGENERE_INVALID_CHAR:${cleaned[i]}`);
    }

    const decIdx = (encIdx - keyIdx + ALPHABET_LEN) % ALPHABET_LEN;
    result += ALPHABET_RU[decIdx];
  }

  return result;
}

// Для UI: возвращает массив чисел (позиций) над зашифрованным словом
export function getVigenereDigits(encryptedWord: string): number[] {
  const cleaned = encryptedWord.toUpperCase().replace(/Ё/g, 'Е');
  return cleaned.split('').map(ch => ALPHABET_RU.indexOf(ch));
}
```

### UI Виженера

Игрок видит:
1. Зашифрованное слово крупными буквами
2. Над каждой буквой — её число-позицию (через `getVigenereDigits`)
3. Под зашифрованным словом или отдельно — ключ
4. Поле ввода для расшифрованного слова
5. Кнопка «Подтвердить»

**Допускаются два варианта UI:**
- Числа жёстко рассчитываются на клиенте через `getVigenereDigits` (та же функция, что на сервере)
- Числа приходят с сервера в `GET /api/missions/decipher/[slotKey]` (предпочтительно — меньше дублирования)

Решение: возвращать числа с сервера в GET, чтобы не дублировать функцию на клиенте.

---

## Логика попытки (attempt)

### `POST /api/missions/decipher/[slotKey]/attempt`

**Auth:** Player only

**Body (Zod):**
```typescript
const attemptSchema = z.object({
  decryptedWord: z.string().min(1).max(50),
});
```

**Алгоритм:**
```typescript
async function handleDecipherAttempt(userId: string, slotKey: string, decryptedWord: string) {
  // 1. Найти слот
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: {
      id: true, missionType: true, isActive: true,
      cipherType: true, encryptedWord: true, cipherKey: true,
      folderPath: true,
    }
  });
  if (!slot || !slot.isActive || slot.missionType !== 'DECIPHER') return error(404, 'SLOT_NOT_FOUND');

  // 2. Расшифровать на сервере
  let serverDecrypted: string;
  try {
    if (slot.cipherType === 'PLAYFAIR') {
      serverDecrypted = decipherPlayfair(slot.encryptedWord, slot.cipherKey);
    } else if (slot.cipherType === 'VIGENERE') {
      serverDecrypted = decipherVigenere(slot.encryptedWord, slot.cipherKey);
    } else {
      return error(500, 'INVALID_CIPHER_TYPE');
    }
  } catch (e) {
    return error(500, 'DECIPHER_FAILED'); // плохая настройка слота
  }

  // 3. Сравнить (в верхнем регистре, без пробелов)
  const playerAnswer = decryptedWord.toUpperCase().replace(/Ё/g, 'Е').trim();
  const expected = serverDecrypted.toUpperCase().replace(/Ё/g, 'Е').trim();
  const isCorrect = playerAnswer === expected;

  // 4. UPSERT MissionProgress — обновить lastAttemptCorrect + failedAttemptsCount
  const existingProgress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } }
  });
  const existingMeta = (existingProgress?.metadata as any) ?? {};

  let newFailedAttemptsCount: number;
  if (isCorrect) {
    newFailedAttemptsCount = 0; // сбрасываем при успехе
  } else {
    newFailedAttemptsCount = (existingMeta.failedAttemptsCount ?? 0) + 1;
  }

  const updatedProgress = await prisma.missionProgress.upsert({
    where: { userId_slotId: { userId, slotId: slot.id } },
    create: {
      userId,
      slotId: slot.id,
      completed: false,
      metadata: {
        lastAttemptCorrect: isCorrect,
        failedAttemptsCount: newFailedAttemptsCount,
        skipped: false,
      },
    },
    update: {
      metadata: {
        ...existingMeta,
        lastAttemptCorrect: isCorrect,
        failedAttemptsCount: newFailedAttemptsCount,
      },
    },
  });

  // 5. Возврат результата. Промежуточные неудачные попытки НЕ пишутся в OperationLog
  // (см. архитектурное решение 7) — игрок видит ошибку в UI, дублирование в логах создаст шум.
  const canSkip = newFailedAttemptsCount >= 2;

  if (!isCorrect) {
    return { isCorrect: false, canSkip };
  }

  // Если верно — клиент сам вызовет /complete
  return { isCorrect: true, canSkip: false };
}
```

**Response 200 (правильно):**
```json
{ "isCorrect": true, "canSkip": false }
```

**Response 200 (неправильно):**
```json
{ "isCorrect": false, "canSkip": true }
```

`canSkip: true` — если `failedAttemptsCount >= 2` после этой попытки. Клиент показывает кнопку «Пропустить».

**Что НЕ возвращается:** `serverDecrypted` (никогда — иначе расшифровка через DevTools).

---

## Логика завершения (complete)

### `POST /api/missions/decipher/[slotKey]/complete`

**Auth:** Player only

**Body:** пустой

**Алгоритм:**
```typescript
async function handleDecipherComplete(userId: string, slotKey: string) {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: {
      id: true, missionType: true, isActive: true, displayName: true,
      folderPassword: true, folderPath: true,
    }
  });
  if (!slot || !slot.isActive || slot.missionType !== 'DECIPHER') return error(404, 'SLOT_NOT_FOUND');

  // Проверка флага метаданных
  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } }
  });
  const metadata = progress?.metadata as { lastAttemptCorrect?: boolean } | null;

  if (!metadata?.lastAttemptCorrect) {
    return error(400, 'NOT_SOLVED');
  }

  // Транзакция: прогресс + логи
  const techMessage = renderLogMessage('decipher_access_granted', {
    folderPath: slot.folderPath ?? '—',
    folderPassword: slot.folderPassword ?? '—',
  });
  const overviewMessage = renderLogMessage('mission_completed_overview', {
    displayName: slot.displayName,
  });

  await prisma.$transaction([
    prisma.missionProgress.update({
      where: { userId_slotId: { userId, slotId: slot.id } },
      data: { completed: true, completedAt: new Date() },
      // metadata НЕ меняем — флаг lastAttemptCorrect остаётся
    }),
    prisma.operationLog.create({
      data: { userId, type: 'SUCCESS', message: techMessage }
    }),
    prisma.operationLog.create({
      data: { userId, type: 'SUCCESS', message: overviewMessage }
    }),
  ]);

  await advanceTriggerListeners(userId, `decipher_completed:${slotKey}`);

  return {
    success: true,
    folderPassword: slot.folderPassword,
    folderPath: slot.folderPath,
  };
}
```

**Response 200:**
```json
{
  "success": true,
  "folderPassword": "secret123",
  "folderPath": "C:\\Users\\Victor\\Markova"
}
```

**Response 400:**
- `NOT_SOLVED` — `metadata.lastAttemptCorrect` не установлен. Защита от прямого вызова `/complete`.

---

## Логика пропуска (skip)

### `POST /api/missions/decipher/[slotKey]/skip`

**Auth:** Player only

**Body:** пустой

**Алгоритм:**
1. Найти слот: проверить существование, `isActive=true`, `missionType=DECIPHER`.
2. Найти `MissionProgress` игрока.
3. Проверить: `MissionProgress.metadata.failedAttemptsCount >= 2`. Если нет — 400 `CANNOT_SKIP`.
4. Транзакция:
   - UPDATE `MissionProgress`: `completed=true, completedAt=now, metadata.skipped=true`
   - INSERT `OperationLog` `decipher_access_granted` (те же params, что при успехе)
   - INSERT `OperationLog` `mission_completed_overview`
5. Вне транзакции: `advanceTriggerListeners(userId, 'decipher_completed:<slotKey>')`
6. Возврат: `{ success: true, folderPassword, folderPath }` (как у `/complete`)

**Response 200:**
```json
{
  "success": true,
  "folderPassword": "secret123",
  "folderPath": "C:\\Users\\Victor\\Markova"
}
```

**Response 400:**
- `CANNOT_SKIP` — `failedAttemptsCount < 2`. Защита от прямого вызова через DevTools.
- `SLOT_NOT_FOUND` — слот не найден или не активен.

---

## Защита от обхода

### Атака 1: вызов `/complete` без `/attempt`

Игрок открывает DevTools → видит маршрут `/complete` → вызывает напрямую.

**Защита:** `/complete` проверяет `MissionProgress.metadata.lastAttemptCorrect === true`. Без `/attempt` с правильным ответом — флаг отсутствует, эндпоинт возвращает 400.

### Атака 2: подмена `decryptedWord` в `/attempt`

Игрок может попробовать перебрать варианты через DevTools. Но:
- Лимита попыток нет — это не атака, это нормальная игра
- Угадать слово перебором за разумное время сложно (русские слова, много вариантов)

Защита от автоматизированного перебора: rate limit на `/attempt` — **20 запросов / минуту на (userId, slotKey)**. Этого достаточно для нормальной игры (одна попытка в 3 секунды), но останавливает автоперебор.

### Атака 3: чтение `MissionSlot.cipherKey` или `encryptedWord` через GET

Это **не атака** — оба поля должны быть видны игроку (это часть геймплея). `cipherKey` отображается в UI, `encryptedWord` — тоже. **Расшифрованное слово** (`expected`) — серверный секрет, не возвращается клиенту никогда.

### Атака 4: подмена `cipherType` в БД через SQL-инъекцию

Не применимо — все запросы через Prisma с параметризованными запросами. SQL-инъекций нет.

---

## API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/api/missions/decipher/launch` | Запуск миссии через форму folderPath (rate limit 30/мин) |
| GET | `/api/missions/decipher/[slotKey]` | Состояние миссии |
| POST | `/api/missions/decipher/[slotKey]/attempt` | Попытка расшифровки |
| POST | `/api/missions/decipher/[slotKey]/complete` | Завершение |
| POST | `/api/missions/decipher/[slotKey]/skip` | Пропуск миссии (доступен при `failedAttemptsCount >= 2`) |

### `GET /api/missions/decipher/[slotKey]`

**Алгоритм:**
```typescript
async function getDecipherState(userId: string, slotKey: string) {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: {
      id: true, missionType: true, isActive: true,
      cipherType: true, encryptedWord: true, cipherKey: true,
      folderPassword: true, folderPath: true, hintText: true,
    }
  });
  if (!slot || !slot.isActive || slot.missionType !== 'DECIPHER') return error(404);

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } }
  });

  if (progress?.completed) {
    return {
      isCompleted: true,
      cipherType: slot.cipherType,
      encryptedWord: slot.encryptedWord,
      cipherKey: slot.cipherKey,
      folderPassword: slot.folderPassword,
      folderPath: slot.folderPath,
      hintText: slot.hintText,
    };
  }

  // Активная — формируем данные для UI
  const baseData = {
    isCompleted: false,
    cipherType: slot.cipherType,
    encryptedWord: slot.encryptedWord,
    cipherKey: slot.cipherKey,
    hintText: slot.hintText,
  };

  if (slot.cipherType === 'VIGENERE') {
    return {
      ...baseData,
      vigenereDigits: getVigenereDigits(slot.encryptedWord), // числа над буквами
    };
  }

  // PLAYFAIR
  return {
    ...baseData,
    playfairTable: buildPlayfairTable(slot.cipherKey), // 6×6 матрица букв
  };
}
```

**Response 200 (PLAYFAIR, активная):**
```json
{
  "isCompleted": false,
  "cipherType": "PLAYFAIR",
  "encryptedWord": "ВИКТОР",
  "cipherKey": "АГЕНТ",
  "playfairTable": [
    ["А","Г","Е","Н","Т","Б"],
    ["В","Д","Ж","З","И","Й"],
    ...
  ],
  "hintText": "..."
}
```

**Response 200 (VIGENERE, активная):**
```json
{
  "isCompleted": false,
  "cipherType": "VIGENERE",
  "encryptedWord": "ЕЙЫЦ",
  "cipherKey": "ВИКТ",
  "vigenereDigits": [5, 9, 27, 22],
  "hintText": "..."
}
```

**Response 200 (пройдена):**
```json
{
  "isCompleted": true,
  "cipherType": "PLAYFAIR",
  "encryptedWord": "...",
  "cipherKey": "...",
  "folderPassword": "secret123",
  "folderPath": "C:\\Users\\Victor\\Markova",
  "hintText": "..."
}
```

---

### `POST /api/missions/decipher/[slotKey]/attempt`

**Body:**
```json
{ "decryptedWord": "ИНФОРМАЦИЯ" }
```

**Rate limit:** 20 / мин на ключ `decipher-attempt:{userId}:{slotKey}`.

**Response 200:**
```json
{ "isCorrect": false, "canSkip": true }
```

или

```json
{ "isCorrect": true, "canSkip": false }
```

**Response 429:** rate limit exceeded.

---

### `POST /api/missions/decipher/[slotKey]/complete`

**Body:** пустой

**Response 200:**
```json
{
  "success": true,
  "folderPassword": "secret123",
  "folderPath": "C:\\Users\\Victor\\Markova"
}
```

**Response 400 (`NOT_SOLVED`):** `metadata.lastAttemptCorrect` отсутствует.

---

## UI миссии

### Форма запуска (Mission Launcher)

На dashboard видна плашка «Дешифратор». При клике открывается модалка `DecipherLaunchModal` с одним полем: `Путь к папке`. После нажатия «Расшифровать» — `POST /api/missions/decipher/launch`.
- При 200 — открывается `DecipherModal` для возвращённого `slotKey`.
- При 400 — поле очищается, показывается «Ошибка: путь к папке не распознан». Лог уже записан сервером.

### Модалка миссии

При успешном запуске открывается модалка. Содержит:

1. **Заголовок:** `MissionSlot.displayName`
2. **Зашифрованное слово** — крупно
3. **Визуальная подсказка по шифру:**
   - Для Плейфера — таблица 6×6 с подсветкой пар букв (опционально, на старте без подсветки)
   - Для Виженера — числа над каждой буквой + ключ повторяющийся под буквами
4. **Поле ввода** для расшифрованного слова
5. **Кнопка «Подтвердить»**
6. **Кнопка «?»** (hintText) — показывает правила шифра

### Поведение при правильной попытке

1. Клиент получает `isCorrect: true`
2. Сразу вызывает `/complete`
3. После успешного `/complete` — отображает:
   - Зелёное уведомление «Папка расшифрована!»
   - `folderPath` (скопируется в буфер кликом)
   - `folderPassword` (скопируется в буфер кликом)
   - Кнопка «Закрыть»

### Поведение при неправильной попытке

1. Клиент получает `isCorrect: false, canSkip: boolean`
2. Поле ввода краснеет, показывается «Ошибка расшифровки. Попробуйте ещё раз.»
3. Поле очищается (или оставляется — UX-решение)
4. Если `canSkip: true` — показывается кнопка «Пропустить миссию» (`DecipherSkipButton`)

### Кнопка «Пропустить» и модалка подтверждения

При `canSkip: true` в `DecipherModal` — кнопка «Пропустить миссию» (`DecipherSkipButton`). При нажатии — `DecipherSkipConfirmModal` с предупреждением. При подтверждении — `POST /api/missions/decipher/<slotKey>/skip`. Отменить нельзя.

### Подсказка по правилам

Кнопка «?» открывает модалку с текстом из `MissionSlot.hintText`. Заглушка:
- **Для Плейфера:** «Шифр Плейфера. Используется таблица 6×6 русских букв, построенная на основе ключевого слова. Сообщение разбивается на пары букв...»
- **Для Виженера:** «Шифр Виженера. Числа над каждой буквой — её позиция в алфавите. Чтобы расшифровать, вычтите из позиции зашифрованной буквы позицию буквы ключа...»

Финальные тексты — от заказчика.

---

## Файлы, которые создаются

```
app/
└── api/
    └── missions/
        └── decipher/
            ├── launch/
            │   └── route.ts                          # POST: запуск миссии через folderPath
            └── [slotKey]/
                ├── route.ts                          # GET
                ├── attempt/route.ts                  # POST (rate limit 20/мин)
                ├── complete/route.ts                 # POST
                └── skip/route.ts                     # POST: пропуск миссии

components/
└── game/
    └── decipher/
        ├── DecipherLaunchModal.tsx                   # Client Component, форма folderPath
        ├── DecipherModal.tsx                         # Client Component, общая модалка
        ├── DecipherSkipButton.tsx                    # Client Component, кнопка «Пропустить»
        ├── DecipherSkipConfirmModal.tsx              # Client Component, модалка-предупреждение
        ├── PlayfairView.tsx                          # Client Component, рендер таблицы 6×6
        ├── PlayfairTable.tsx                         # Client Component, сама таблица
        ├── VigenereView.tsx                          # Client Component, числа + ключ
        ├── DecipherInput.tsx                         # Client Component, поле ввода + кнопка
        ├── DecipherCompletedView.tsx                 # Client Component, показ folderPassword
        └── DecipherHintButton.tsx                    # Client Component, кнопка «?»

lib/
└── decipher/
    ├── playfair.ts                                   # buildPlayfairTable, decipherPlayfair
    ├── vigenere.ts                                   # decipherVigenere, getVigenereDigits
    └── launch.ts                                     # серверная логика поиска слота по folderPath

constants/
└── russianAlphabet.ts                                # ALPHABET_RU константа (общая для двух шифров)
```

---

## Серверные правила

1. **Расшифровка — только на сервере.** Клиент НЕ имеет доступа к расшифрованному слову. Сравнение с ответом игрока — только серверное.

2. **Возвращать клиенту только публичные поля:** `cipherType`, `encryptedWord`, `cipherKey`, `playfairTable` или `vigenereDigits`, `hintText`. После прохождения — `folderPassword`, `folderPath`. **Никогда:** расшифрованное слово, `targetWord` (это поле для CRACK, в DECIPHER не используется).

3. **`/complete` проверяет `metadata.lastAttemptCorrect`.** Без флага — 400. См. раздел «Защита от обхода».

4. **Rate limit на `/attempt`** — 20/мин на (userId, slotKey). Защита от автоперебора.

5. **Алфавит — 32 буквы (Е=Ё).** Везде, где используется русский алфавит — приводить Ё к Е через `replace(/Ё/g, 'Е')`. И в ключе, и в зашифрованном слове, и в ответе игрока, и в эталонном расшифрованном.

6. **Сравнение ответа** — case-insensitive, без пробелов: `toUpperCase().replace(/Ё/g, 'Е').trim()`.

7. **Флаг `metadata.lastAttemptCorrect` не очищаем** после `/complete`. Он становится бессмысленным после `completed=true`, но удалять не обязательно. Это упрощает логику.

8. **При повторных попытках после успеха** (если игрок продолжает использовать поле ввода) — `lastAttemptCorrect` может перезаписаться на `false`. Это **не сломает** уже завершённую миссию (`completed=true` важнее). Но защита `/complete` сработает только при `lastAttemptCorrect=true`. Решение: после `/complete` UI блокирует поле ввода (показывается режим «уже пройдено»).

9. **Промежуточные неудачные попытки НЕ пишутся в OperationLog** — игрок видит ошибку прямо в UI (поле краснеет + сообщение). В лог попадают только успешные расшифровки (`decipher_access_granted`) и обзорные логи (`mission_completed_overview`). Это симметрично с Crack.

10. **При успехе пишутся ДВА лога** в одной транзакции: `decipher_access_granted` + `mission_completed_overview`.

11. **`advanceTriggerListeners(tx, …)` вызывается ВНУТРИ транзакции завершения** — как в `lib/crack/service.ts` (решение зафиксировано в `phase-12.md`, правило 5).

12. **Изоморфный код шифров:** функции `buildPlayfairTable`, `getVigenereDigits` могут использоваться и на сервере (для GET), и на клиенте (для UI рендера). Главное — функция расшифровки `decipherPlayfair`/`decipherVigenere` НИКОГДА не используется на клиенте.

13. **`metadata.failedAttemptsCount` инкрементируется при `isCorrect=false`, сбрасывается на 0 при `isCorrect=true`.** Счётчик учитывает только попытки внутри мини-игры, не попытки запуска через Mission Launcher.

14. **Skip пишет те же логи и вызывает те же триггеры, что при честном прохождении.** Различие только в `MissionProgress.metadata.skipped=true` (для внутренней аналитики).

15. **Optimistic locking на `MissionProgress`.** Все mutate-эндпоинты (`/attempt`, `/complete`, `/skip`) принимают `expectedVersion` в теле, возвращают обновлённую `version` в ответе. При несовпадении версий — HTTP 409. См. `.docs/modules/concurrency.md`.

---

## Связи с другими модулями

- **`database.md`** — модели `MissionSlot`, `MissionProgress` описаны там; здесь только применение.
- **`concurrency.md`** — mutate-эндпоинты используют optimistic locking. Поле `version` на `MissionProgress` инкрементируется при UPDATE.
- **`chats.md`** — после `/complete` или `/skip` вызывается `advanceTriggerListeners(userId, 'decipher_completed:<slotKey>')`.
- **`logs.md`** — используются шаблоны `decipher_access_granted`, `decipher_launch_failed`, `mission_completed_overview`. `decipher_launch_failed` пишется при неудачной попытке запуска через Mission Launcher. Промежуточные неудачи расшифровки НЕ пишутся в логи.
- **`missions-rdp.md`** — `folderPassword` из этой миссии используется для разблокировки папки в RDP-симуляции (через `POST /api/missions/rdp/[slotKey]/unlock-folder`). Структурная связь через `MissionSlot.unlocksRdpFolder` + `MissionSlot.unlocksRdpSlotKey`.
- **`onboarding.md`** — плашка Decipher-миссии имеет `data-onboarding-id="mission-tiles"` (общий для всех плашек миссий).
- **`restart.md`** — DELETE всех `MissionProgress` игрока (включая `metadata.failedAttemptsCount`, `metadata.skipped`).
- **`admin.md`** — раздел mission-slots: CRUD слотов DECIPHER с полями `cipherType`, `encryptedWord`, `cipherKey`, `folderPassword`, `folderPath`, `hintText`. Поле `folderPath` используется как **уникальный ключ запуска** — admin.md предупреждает о дубликатах.
- **Данные формы запуска (folderPath) НЕ возвращаются клиенту в виде списка валидных значений** — только подтверждение совпадения через `slotKey`.
- **`final-report.md`** — индикатор «миссия пройдена» в двойном триггере.
- **`auth.md`** — `lib/rateLimit.ts` переиспользуется для лимита на `/attempt`.
