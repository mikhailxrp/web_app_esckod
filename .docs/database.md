# Database Schema

> Источник правды по схеме БД проекта. Все Prisma-модели, enum'ы, связи, сидеры и критичные транзакции — здесь.
> При расхождениях между этим файлом и любым модулем `.docs/modules/*` — верно то, что в этом файле.

---

## Содержание

1. [Enums](#enums)
2. [Модели — пользователи и доступ](#модели--пользователи-и-доступ)
3. [Модели — игровой прогресс](#модели--игровой-прогресс)
4. [Модели — чаты (граф диалога)](#модели--чаты-граф-диалога)
5. [Модели — миссии и сессии](#модели--миссии-и-сессии)
6. [Модели — финальный отчёт](#модели--финальный-отчёт)
7. [Модели — подсказки Детектива](#модели--подсказки-детектива)
8. [Модели — админка и настройки](#модели--админка-и-настройки)
9. [Схема связей](#схема-связей)
10. [Сидеры](#сидеры)
11. [Критичные транзакции](#критичные-транзакции)
12. [Индексы](#индексы)
13. [Миграции](#миграции)

---

## Enums

Все enum'ы вынесены отдельной секцией для удобства поиска. Используются в нескольких моделях.

```prisma
enum LogType {
  SUCCESS
  ERROR
  INFO
}

enum ChatType {
  DETECTIVE
  MARINA
}

enum ChatAuthor {
  DETECTIVE   // реплика от лица Детектива
  PLAYER      // реплика/выбор от лица игрока
  MARINA      // реплика от лица Марины
  ANONYMOUS   // реплика от неизвестного отправителя
}

enum ConditionType {
  ALWAYS    // безусловный переход (линейный диалог)
  CHOICE    // переход после выбора игрока (conditionValue = value из choices)
  TRIGGER   // переход после серверного события (conditionValue = код события)
}

enum MissionType {
  CRACK
  DECIPHER
  RDP
}

enum CipherType {
  PLAYFAIR
  VIGENERE
}
```

**Почему `CipherType` — настоящий enum, а не строка:** в проектной документации это исторически было `String?` с комментарием «PLAYFAIR VIGENERE». Это ловушка: админ может через UI сохранить строчные `playfair` или с опечаткой — и весь Decipher-флоу для этого слота сломается на сервере. Enum в БД блокирует невалидные значения на уровне записи.

**Зачем `ChatAuthor` отдельно от `ChatType`:** `chatType` определяет, к какому чату относится реплика (ветка Детектива или Марины), а `author` — от чьего лица она показывается в UI этого чата. Это разные оси: внутри чата Марины могут встречаться реплики игрока (`PLAYER`) или анонимного отправителя (`ANONYMOUS`), а не только самой Марины. Игровой рендеринг (Phase 6–7) использует `author` для выравнивания/стилизации «пузырей» сообщений (свои/чужие) и подписи отправителя. Значение по умолчанию — `DETECTIVE`.

---

## Модели — пользователи и доступ

### `User` — игроки

```prisma
model User {
  id                String    @id @default(cuid())
  name              String    // латиница или кириллица + цифры + `_`, минимум 3 символа
  email             String    @unique
  passwordHash      String    // bcrypt-хэш (plain пароль генерируется системой и отправляется по email, в БД не хранится)
  isBlocked         Boolean   @default(false)
  onboardingDone    Boolean   @default(false)
  consentMarketing  Boolean   @default(false)  // необязательный флаг согласия на маркетинг
  consentPolicy     Boolean   @default(false)  // обязательный флаг при регистрации
  createdAt         DateTime  @default(now())

  accessKey         AccessKey @relation(fields: [accessKeyId], references: [id])
  accessKeyId       String

  progress          GameProgress?
  chatState         ChatState?
  operationLogs     OperationLog[]
  missionProgress   MissionProgress[]
  crackSessions     CrackSession[]
  hintProgress      UserHintProgress?

  @@index([accessKeyId])
}
```

**Назначение:** Игроки. Каждый создаётся при регистрации с активацией ключа.

**Ключевые особенности:**

- `passwordHash` хранит ТОЛЬКО bcrypt-хэш. Plain пароль генерируется системой через `lib/password.ts` и отправляется на email через Resend.
- `onboardingDone` **НЕ сбрасывается при перезапуске** — повторный онбординг не нужен.
- `consentMarketing` сохраняется ровно тем значением, которое прислал клиент (дефолт галки определяется на клиенте через `GET /api/settings/registration-defaults`).

---

### `AccessKey` — ключи из коробки

```prisma
model AccessKey {
  id                  String    @id @default(cuid())
  key                 String    @unique  // уникальный ключ из коробки
  isBlocked           Boolean   @default(false)
  maxActivations      Int       @default(5)        // сколько аккаунтов можно создать под этот ключ
  currentActivations  Int       @default(0)        // сколько уже создано
  blockedAt           DateTime?                    // когда заблокирован (для аудита)
  blockReason         String?                      // причина блокировки (опционально)
  createdAt           DateTime  @default(now())

  users               User[]    // один ключ — несколько пользователей в пределах maxActivations
}
```

**Назначение:** Ключи активации из коробки с лимитом регистраций (по умолчанию 5 — для семьи / друзей).

**Логика активаций:**

- При регистрации `currentActivations` инкрементится в транзакции с `INSERT User`. Если `currentActivations >= maxActivations` — регистрация отклоняется.
- При удалении пользователя счётчик НЕ декрементится (защита от обхода лимита через удаление-пересоздание).
- При перезапуске игры (`POST /api/game/restart`) счётчик НЕ декрементится.
- Изменение `maxActivations` постфактум разрешено, но новое значение **не может быть меньше `currentActivations`** (защита в API).
- Блокировка ключа автоматически отключает всех его пользователей (проверяется при логине).

**Защита от race condition:** транзакция регистрации использует `UPDATE ... WHERE currentActivations < maxActivations`. Если UPDATE затронул 0 строк — ROLLBACK. См. раздел [Критичные транзакции](#критичные-транзакции).

---

### `AdminUser` — администраторы

```prisma
model AdminUser {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String    // bcrypt хэш пароля
  createdAt    DateTime  @default(now())
  lastLoginAt  DateTime?
}
```

**Назначение:** Администраторы. **Полностью изолированы от игроков** — отдельная таблица, отдельный auth-флоу, отдельный credentials-провайдер Auth.js v5.

**Защиты в API:**

- Запрет удаления самого себя (admin не может удалить запись со своим `id` из сессии)
- Запрет удаления последнего администратора (защита от полной потери доступа к админке)

**Первый админ** создаётся сидером из `.env` (`ADMIN_INITIAL_EMAIL` + `ADMIN_INITIAL_PASSWORD`) при первом деплое. Дальнейшие — через UI админки. После первого деплоя ENV-переменные удаляются с сервера.

---

## Модели — игровой прогресс

### `GameProgress` — глобальное состояние игры

```prisma
model GameProgress {
  id                String    @id @default(cuid())
  userId            String    @unique

  marinaTriggered      Boolean   @default(false)  // появился чат Марины (единственный источник правды)
  finalReportDone      Boolean   @default(false)
  finalScore           Int?      // процент правильных ответов (только контрольные вопросы)
  finalReportChoice    String?   // UPPERCASE: ACCUSE | PROTECT — выбор концовки
  finalReportAnswers   Json?     // снапшот [{ questionText, selectedLabel, isCorrect, isFinalQuestion }]
  version              Int       @default(0)  // optimistic locking — см. .docs/modules/concurrency.md

  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Назначение:** Хранит ТОЛЬКО глобальное состояние игры одного игрока — то, что не привязано к конкретной миссии.

**Что НЕ хранится здесь** (важное архитектурное решение): прохождение миссий (`crackCompleted`, `decipherCompleted`, `rdpCompleted`) — этих полей НЕТ. Прогресс по каждой миссии — в `MissionProgress` (per-slot). Это даёт повторяемость: один игрок может пройти и `CRACK_P2`, и `CRACK_VUZ`, у каждого слота своя запись.

`**marinaTriggered` — единственный источник правды для видимости чата Марины.\*\* Раньше был дубль в `ChatState.marinaVisible` — удалён.

- Сервер устанавливает `marinaTriggered = true` в `POST /api/missions/rdp/[slotKey]/file-viewed` для слотов с `rdpScenario === 2`, в момент автоматической активации триггера (когда игрок просмотрел все файлы слота). См. `.docs/modules/missions-rdp.md` → раздел «Шаг 4 — сюжетный триггер».
- Клиент при загрузке через `GET /api/progress` получает `marinaTriggered` и решает, рендерить ли чат Марины.

**При перезапуске игры:** UPDATE на дефолты (`marinaTriggered=false`, `finalReportDone=false`, `finalScore=null`, `finalReportChoice=null`, `finalReportAnswers=null`).

---

### `OperationLog` — история операций

```prisma
model OperationLog {
  id        String    @id @default(cuid())
  userId    String
  type      LogType
  message   String    // строго по шаблонам из constants/logTemplates.ts
  createdAt DateTime  @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
}
```

**Назначение:** История операций игрока, видимая в UI игровой зоны (постоянно внизу dashboard).

**Правила записи:**

- Записывается ТОЛЬКО сервером через утилиту `lib/operationLog.ts`. Клиент НЕ имеет публичного API на запись (`POST /api/logs` не существует).
- Шаблоны сообщений — серверная константа `constants/logTemplates.ts`. Клиенту недоступна.
- Параметры (`{targetUrl}`, `{ip}`, `{password}` и т.д.) подставляются сервером из контекста. Клиент НЕ передаёт эти значения.

**Что записывается:**

- Успехи (доступ предоставлен)
- Ошибки ввода данных (неверный IP, неверный логин)
- Сюжетные ошибки (потеря доступа, два активных сеанса)
- Прохождение миссий (обзорные логи)
- Админские коррекции прогресса (с префиксом `[admin]`)

**Что НЕ записывается:**

- Промежуточные ошибки в Crack (попытки 1..N-1 при угадывании слова) — пишется только итог последней попытки при провале (`crack_attempt_failed`, где N = `CrackSession.maxAttempts`) и финал при успехе.

**При перезапуске игры:** все записи игрока удаляются (DELETE), затем добавляется одна новая «Игра начата заново».

---

## Модели — чаты (граф диалога)

Архитектурное решение: диалоги — это **граф**, не линейная последовательность. Реплики (узлы) и переходы между ними (рёбра) — раздельные таблицы.

### `ChatScript` — реплики (узлы графа)

```prisma
model ChatScript {
  id          String      @id @default(cuid())
  chatType    ChatType
  author      ChatAuthor  @default(DETECTIVE)  // от чьего лица показывается реплика (для рендеринга UI чата)
  code        String      @unique  // машинное имя: "detective_greeting", "marina_intro", "ending_protect"
  text        String      // текст реплики
  audioUrl    String?     // ссылка на файл в Beget Cloud Storage
  hasChoices  Boolean     @default(false)  // есть ли варианты ответов игрока
  choices     Json?       // [{ "label": "Юристы", "value": "lawyers" }, ...]
  isStart     Boolean     @default(false)  // entry point чата (одна на chatType)
  isEnd       Boolean     @default(false)  // финальная реплика (после неё чат завершён)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  outgoingTransitions    ChatTransition[] @relation("FromMessage")
  incomingTransitions    ChatTransition[] @relation("ToMessage")
  currentDetectiveStates ChatState[]      @relation("CurrentDetective")
  currentMarinaStates    ChatState[]      @relation("CurrentMarina")

  @@index([chatType])
  @@index([code])
}
```

**Назначение:** Глобальный контент — все реплики обоих чатов (Детектив + Марина). Управляется админом через UI.

**Ключевые поля:**

- `author` — от чьего лица показывается реплика (`DETECTIVE` / `PLAYER` / `MARINA` / `ANONYMOUS`). Независим от `chatType`: внутри одного чата могут чередоваться реплики разных авторов. Используется только для рендеринга UI чата (выравнивание и стиль «пузыря», подпись отправителя), на логику переходов не влияет. Default — `DETECTIVE`.
- `code` (UNIQUE) — машинное имя для API, логов, отладки. Пример: `"detective_after_p2_crack"` понятнее, чем CUID.
- `choices` — структура `{label, value}`. `label` для UI (видит игрок), `value` для логики переходов (используется в `ChatTransition.conditionValue`). Это позволяет переименовать кнопку без поломки условий переходов.
- `isStart` — точка входа в чат. Сервер при первом обращении к чату ищет реплику с `isStart=true` для нужного `chatType`.
- `isEnd` — конечная точка. После показа сервер автоматически фиксирует `ChatState.{detective,marina}Finished = true`.

**Поведение `isStart` для чата Марины:** реплика существует с момента сидера, но **показывается только после серверного триггера** (`GameProgress.marinaTriggered=true`). Сам факт `isStart=true` не означает «показать сразу».

---

### `ChatTransition` — переходы между репликами (рёбра графа)

```prisma
model ChatTransition {
  id              String        @id @default(cuid())
  fromMessageId   String
  toMessageId     String
  conditionType   ConditionType
  conditionValue  String?       // null для ALWAYS, value из choices для CHOICE, код события для TRIGGER
  priority        Int           @default(0)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  fromMessage     ChatScript    @relation("FromMessage", fields: [fromMessageId], references: [id], onDelete: Cascade)
  toMessage       ChatScript    @relation("ToMessage",   fields: [toMessageId],   references: [id], onDelete: Cascade)

  @@index([fromMessageId])
}
```

**Семантика типов условий:**

| `conditionType` | `conditionValue`                                       | Когда срабатывает                                                             |
| --------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `ALWAYS`        | `null`                                                 | Безусловно после закрытия `fromMessage`. Линейные участки.                    |
| `CHOICE`        | `"lawyers"` (или другое value из `ChatScript.choices`) | Игрок нажал кнопку с этим value в `fromMessage`.                              |
| `TRIGGER`       | `"crack_completed:CRACK_P2"` (код события)             | Произошло названное серверное событие. Реплика `fromMessage` обычно «ждущая». |

**Список TRIGGER-событий** (захардкожен в `constants/chatTriggerEvents.ts`):

- `crack_completed:{slotKey}` — прохождение Crack-слота
- `decipher_completed:{slotKey}` — прохождение Decipher-слота
- `rdp_completed:{slotKey}` — прохождение RDP-слота
- `rdp_marina_triggered` — активация чата Марины (автоактивация в `/file-viewed` для RDP сценария 2)
- `final_choice_made` — игрок сделал финальный выбор в чате Марины

В админке админ выбирает из выпадающего списка — свободный ввод запрещён (защита от опечаток).

`**priority`:\*\* при множественных подходящих переходах сервер берёт первый по убыванию priority. Большинство переходов будут priority=0.

**Инвариант:** для одной `fromMessage` в один момент должен быть выполним ровно один переход. Админка предупреждает о двусмысленности при сохранении.

**Каскад:** при удалении реплики (`onDelete: Cascade`) удаляются все её входящие и исходящие переходы.

---

### `ChatState` — состояние чатов игрока

```prisma
model ChatState {
  id                       String       @id @default(cuid())
  userId                   String       @unique
  currentDetectiveMessageId String?     // FK → ChatScript
  currentMarinaMessageId    String?     // FK → ChatScript
  playerChoices            Json         @default("{}")  // карта { "<replyCode>": "<chosenValue>" }
  finalChoice              String?      // финальный выбор Марины (UPPERCASE: "PROTECT" / "ACCUSE")
  detectiveFinished        Boolean      @default(false)
  marinaFinished           Boolean      @default(false)
  version                  Int          @default(0)  // optimistic locking — см. .docs/modules/concurrency.md
  createdAt                DateTime     @default(now())
  updatedAt                DateTime     @updatedAt

  user                     User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  currentDetectiveMessage  ChatScript?  @relation("CurrentDetective", fields: [currentDetectiveMessageId], references: [id], onDelete: SetNull)
  currentMarinaMessage     ChatScript?  @relation("CurrentMarina",    fields: [currentMarinaMessageId],    references: [id], onDelete: SetNull)
}
```

**Назначение:** Текущее состояние чатов конкретного игрока (1:1 с `User`).

**Ключевые особенности:**

- `currentDetectiveMessageId` / `currentMarinaMessageId` — FK на `ChatScript`. Если админ удалит реплику, на которой остановились игроки — `onDelete: SetNull` обнулит указатель, а не сломает запись. При следующем `/api/chat/advance` сервер увидит `null` и стартует с `isStart`.
- `playerChoices` — JSON-карта `{ "<ChatScript.code>": "<value>" }`. Ключ — код реплики (для понятности при отладке), значение — выбранный `value` из choices.
- `finalChoice` хранится **UPPERCASE** (`PROTECT`, `ACCUSE`). Это конвенция проекта. Должно совпадать с `value` в choices финальной реплики Марины и с `FinalReportContent.finalChoiceValue`.
- `playerChoices` инициализируется пустым объектом (`@default("{}")`) — в коде нет проверок на null.

**При перезапуске игры:** UPDATE — обнуляются все поля (FK в null, choices в `{}`, флаги в false).

---

## Модели — миссии и сессии

### `MissionSlot` — слоты миссий

```prisma
model MissionSlot {
  id            String       @id @default(cuid())
  slotKey       String       @unique  // "CRACK_P2", "CRACK_VUZ", "DECIPHER_SHANTAZH", "DECIPHER_MARKOVA", "RDP_VICTOR", "RDP_MARINA"
  missionType   MissionType
  orderIndex    Int          // в каком порядке слоты появляются игроку (для сортировки)
  isActive      Boolean      @default(true)  // мягкое отключение без удаления
  displayName   String       // человекочитаемое имя для админки и логов: "Взлом сайта P2 Digital"

  // Crack — контент
  targetUrl        String?
  targetEmail      String?
  resultPassword   String?
  // Crack — параметры механики
  crackMaxAttempts Int?      @default(6)  // количество игровых попыток (default 6, диапазон 3..10)

  // Decipher — контент
  cipherType         CipherType?
  encryptedWord      String?
  cipherKey          String?
  folderPassword     String?
  folderPath         String?    // например, "C:\\Users\\Victor\\Markova" — отображаемая строка для копирования игроком и для логов

  // Decipher — структурная связь с RDP-слотом для разблокировки папки
  unlocksRdpFolder   String?    // имя папки в RDP-симуляции (равно RdpFile.folder), которую разблокирует пароль этого слота
  unlocksRdpSlotKey  String?    // slotKey RDP-слота, в котором эта папка находится (например, "RDP_VICTOR")

  // RDP — контент
  correctIp       String?
  rdpScenario     Int?       // 1 (упрощённый, без таймера) | 2 (увеличенный, с таймером, два пути)
  logSubjectName  String?    // имя для лога: "Виктор", "Неизвестно"
  nextRdpSlotKey  String?    // slotKey следующего RDP-слота в сюжетной цепочке (для подстановки в лог rdp_session_lost). Заполняется для rdpScenario=1.
  // RDP — параметры механики
  timerSeconds       Int?    // длительность таймера (только для rdpScenario=2). Default по сидеру: 120, диапазон 30..600
  rdpPuzzleGridSize  Int?    // размер сетки пазла. Default по сценариям: 6 для rdpScenario=1, 7 для rdpScenario=2. Допустимые значения: 6 или 7

  // Общее
  hintText        String?    // текст под знаком "?" внутри миссии (локальная подсказка)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  missionProgresses MissionProgress[]
  crackSessions     CrackSession[]
  rdpFiles          RdpFile[]

  @@index([missionType])
  @@index([isActive])
}
```

**Назначение:** Глобальный контент. Каждый слот = одно конкретное прохождение миссии со своим контентом и параметрами.

**Архитектурное решение — почему слоты, а не одна запись на тип миссии:** игроку нужно проходить миссии повторно (Crack ×2: P2 + ВУЗ; RDP ×2: Виктор + Марина; Decipher ×2: Шантаж + Маркова). Каждое прохождение требует свои параметры. Слоты дают повторяемость + расширяемость через админку без изменений кода.

**Параметры механик per-slot**:

- `crackMaxAttempts` — количество попыток в Wordle. Default 6, диапазон 3..10.
- `timerSeconds` — длительность таймера RDP сценария 2. Default 120, диапазон 30..600.
- `rdpPuzzleGridSize` — размер сетки пазла. Default 6 (сценарий 1) / 7 (сценарий 2), допустимые значения: 6 или 7.

**Структурная связь Decipher → RDP** (для разблокировки папок):

Decipher-слот может явно указывать, какую папку в каком RDP-слоте разблокирует его пароль:

| Поле                | Тип       | Назначение                                                                                                     |
| ------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `unlocksRdpFolder`  | `String?` | Имя папки в RDP-симуляции (должно совпадать с `RdpFile.folder` соответствующего слота). Например, `"Маркова"`. |
| `unlocksRdpSlotKey` | `String?` | `slotKey` RDP-слота, в котором эта папка находится. Например, `"RDP_VICTOR"`.                                  |

**Логика:** при `POST /api/missions/rdp/[slotKey]/unlock-folder { folderName, password }` сервер ищет активный Decipher-слот, у которого ВСЕ ТРИ условия совпадают одновременно:

- `folderPassword === password`
- `unlocksRdpFolder === folderName`
- `unlocksRdpSlotKey === slotKey` (текущей RDP-миссии)

Если такого слота нет — возвращается `INVALID_PASSWORD`. Никаких сравнений по подстрокам или сегментам пути.

**Опциональность полей:** `unlocksRdpFolder` и `unlocksRdpSlotKey` могут быть `null` для Decipher-слотов, не связанных с RDP (если такие появятся в будущем). На MVP оба слота `DECIPHER_SHANTAZH` и `DECIPHER_MARKOVA` имеют связь с RDP-слотами Виктора и Марины соответственно.

**`folderPath` сохраняется** как отображаемая строка для копирования игроком (UI показывает «путь к папке»). Это **не логика**, только отображение.

**Сюжетная цепочка RDP-слотов:** поле `nextRdpSlotKey` указывает, какой RDP-слот следует за текущим. Используется при записи лога `rdp_session_lost` (сценарий 1): сервер делает `findUnique({ where: { slotKey: nextRdpSlotKey } })` и подставляет `correctIp` найденного слота как `{nextIp}` в шаблон.

> **По аналогии с `unlocksRdpSlotKey`:** избегаем дублирования IP. Единый источник правды — `correctIp` целевого слота.
>
> **Опциональность:** `null` для сценария 2 (нет следующего слота). Для сценария 1 поле обязательно для корректного UX — иначе игрок не сможет получить IP для перехода к следующему этапу. Админка показывает баннер-предупреждение при сохранении сценария 1 без `nextRdpSlotKey`.
>
> **Fallback при `null` или отсутствии следующего слота:** лог пишется с `{nextIp}` = `'—'`. Игра не ломается, но сюжетный IP не показывается.

**Инвариант для админки:** при сохранении RDP-слота с `rdpScenario=1` и заполненным `nextRdpSlotKey` — проверить существование слота с `slotKey === nextRdpSlotKey` И `missionType === 'RDP'` И `isActive === true`. Если условие не выполнено — баннер-предупреждение.

**Инвариант для админки:** при сохранении Decipher-слота с заполненными `unlocksRdpFolder` и `unlocksRdpSlotKey` — админка проверяет, что:

1. Существует активный `MissionSlot` с `slotKey === unlocksRdpSlotKey` и `missionType === 'RDP'`
2. В этом RDP-слоте существует `RdpFile` с `folder === unlocksRdpFolder` и `isLocked === true`

Если хотя бы одно условие не выполнено — баннер-предупреждение в админке (НЕ блокирует сохранение, потому что Decipher-слот может создаваться раньше связанного RDP-контента).

Это даёт админу тонкий тюнинг кривой сложности без релизов. Параметры **копируются в активную сессию при старте** — изменение в админке посреди игры не влияет на текущие сессии (см. `CrackSession`).

**Запреты в API:**

- Запрет смены `slotKey` через PATCH (ломает данные у активных игроков)
- Запрет смены `missionType` через PATCH (то же самое)
- Запрет удаления при наличии активных `CrackSession` (правильное действие — деактивация через `isActive=false`)
- Запрет деактивации (`isActive=false`) или удаления слота, если он **единственный активный** в своём `missionType`. Серверная защита в `PATCH /api/admin/mission-slots/[id]` и `DELETE`. Это гарантирует, что плашка на dashboard всегда имеет хотя бы один активный слот для запуска.

**Логика подстановки в логах:** шаблоны логов в `logTemplates.ts` принимают параметр `{logSubjectName}` или `{displayName}`. Для CRACK/DECIPHER `logSubjectName=null`. Для RDP — обязательно заполнено (например, `"Виктор"`, `"Неизвестно"`).

---

### `MissionProgress` — прогресс по слоту

```prisma
model MissionProgress {
  id            String       @id @default(cuid())
  userId        String
  slotId        String
  completed     Boolean      @default(false)
  completedAt   DateTime?
  metadata      Json?        // миссия-специфичное состояние, см. таблицу ниже (CRACK | DECIPHER | RDP)
  version       Int          @default(0)  // optimistic locking — см. .docs/modules/concurrency.md
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  slot          MissionSlot  @relation(fields: [slotId], references: [id], onDelete: Cascade)

  @@unique([userId, slotId])
  @@index([userId])
}
```

**Назначение:** Прогресс игрока по конкретному слоту. UNIQUE на `(userId, slotId)` — одна запись на пару.

**Поле `metadata`** — миссия-специфичное состояние. Содержимое зависит от типа:

### CRACK

```json
{
  "failedSessionsCount": 0,
  "skipped": false
}
```

| Поле                  | Тип       | Когда устанавливается                                                                                | Когда читается                                                        |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `failedSessionsCount` | `number`  | Инкрементируется в `/attempt` при провале N+1 попытки (одновременно с пересозданием `CrackSession`). | UI показывает кнопку «Пропустить» при `failedSessionsCount >= 2`.     |
| `skipped`             | `boolean` | Сервер ставит `true` в `/skip`.                                                                      | UI рендерит «пройдена через пропуск» для аналитики (игроку не виден). |

Основное состояние сессии (слова, попытки) — по-прежнему в отдельной таблице `CrackSession`.

### DECIPHER

```json
{
  "lastAttemptCorrect": true,
  "failedAttemptsCount": 0,
  "skipped": false
}
```

| Поле                  | Тип       | Назначение                                                                                                                                                             |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lastAttemptCorrect`  | `boolean` | Флаг корректной последней попытки расшифровки. Сервер ставит при правильном `attempt`. Без флага `/complete` возвращает 400 — защита от прямого вызова через DevTools. |
| `failedAttemptsCount` | `number`  | Инкрементируется в `/attempt` при `isCorrect=false`. UI показывает кнопку «Пропустить» при `failedAttemptsCount >= 2`. Сбрасывается на `0` при `isCorrect=true`.       |
| `skipped`             | `boolean` | Сервер ставит `true` в `/skip`. UI рендерит «пройдена через пропуск» для аналитики (игроку не виден).                                                                  |

### RDP

```json
{
  "puzzleField": {
    /* PuzzleField */
  },
  "puzzleSolved": false,
  "timerStartedAt": "2026-05-08T12:00:00Z",
  "timerExpiredCount": 0,
  "unlockedFolders": ["Маркова"],
  "viewedFileIds": ["clx1", "clx2"],
  "triggerActivated": false
}
```

| Поле                | Тип                                                     | Когда устанавливается                                                                                               | Когда читается                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `puzzleField`       | `PuzzleField` (JSON-объект)                             | Создаётся при первом обращении к пазлу через `GET /puzzle-state`. Перегенерируется в `/timer-expired` (сценарий 2). | Используется в `/rotate-tile`, `/check-puzzle` для хранения текущей расстановки и поворотов плиток.                                                                                        |
| `puzzleSolved`      | `boolean`                                               | Сервер ставит `true` в `/check-puzzle` при успешном решении пазла.                                                  | Защищает доступ к `/files`, `/unlock-folder`, `/file-viewed` — без `puzzleSolved=true` они возвращают 400.                                                                                 |
| `timerStartedAt`    | `string` (ISO datetime), только для `rdpScenario === 2` | Устанавливается при создании `puzzleField`. Обновляется в `/timer-expired` при перегенерации поля.                  | Используется в `/timer-expired` для проверки реальности истечения таймера (защита от досрочного вызова через DevTools).                                                                    |
| `timerExpiredCount` | `number`, только для `rdpScenario === 2`                | Инкрементится в `/timer-expired` при каждом истечении.                                                              | Не блокирует прохождение — попытки бесконечные. UI показывает кнопку «Пропустить» при `timerExpiredCount >= 2` И `rdpScenario === 2`.                                                      |
| `skipped`           | `boolean`, только для `rdpScenario === 2`               | Сервер ставит `true` в `/skip`. Для сценария 1 пропуск недоступен — поле не используется.                           | UI рендерит финальную модалку «Сеанс прерван» автоматически (как при честном прохождении).                                                                                                 |
| `unlockedFolders`   | `string[]`                                              | Сервер добавляет имя папки в `/unlock-folder` после успешной проверки пароля.                                       | Используется в `/files` (отдаёт ли URL файлов запароленных папок) и в `/file-viewed` (разрешено ли просматривать файл запароленной папки).                                                |
| `viewedFileIds`     | `string[]`                                              | Сервер добавляет `fileId` в `/file-viewed` при каждом закрытии PDF игроком.                                         | Используется в `/file-viewed` для определения «все ли файлы слота (всех папок) просмотрены» — момент автоматической активации сюжетного триггера.                                          |
| `triggerActivated`  | `boolean`                                               | Сервер ставит `true` в `/file-viewed`, когда `viewedFileIds` покрыли все файлы слота (всех папок).                  | Защищает `/complete` — без `triggerActivated=true` финальный эндпоинт возвращает 400. Также используется на клиенте для рендера финальной модалки («2 активных сеанса» / «Сеанс прерван»). |

**Инвариант:** все поля `metadata` для RDP пишутся ТОЛЬКО сервером изнутри игровых эндпоинтов. Клиент НЕ может писать в `metadata` напрямую — это предохранитель защиты от обхода через DevTools (см. `missions-rdp.md` → раздел «Защита от обхода»).

**Постепенное наполнение:** при создании `MissionProgress` для RDP-слота поле `metadata` сначала содержит только `puzzleField`, `puzzleSolved=false`, и (для сценария 2) `timerStartedAt`, `timerExpiredCount=0`. Остальные поля добавляются по мере прохождения миссии:

- `unlockedFolders` появляется при первой успешной разблокировке
- `viewedFileIds` появляется при первом закрытии PDF
- `triggerActivated=true` появляется в момент автоматической активации триггера

⚠️ **Критично:** клиент НЕ должен иметь возможности писать в `metadata` напрямую через какой-либо эндпоинт. Запись только серверная, изнутри attempt/files-эндпоинтов после прохождения проверок. Иначе вся защита `/complete` бессмысленна.

**При перезапуске игры:** все записи игрока удаляются (DELETE).

---

### `CrackSession` — состояние активной сессии Crack

```prisma
model CrackSession {
  id            String       @id @default(cuid())
  userId        String
  slotId        String
  targetWord    String       // загаданное слово — генерируется случайно из wordList5letters при старте сессии, НЕ берётся из MissionSlot
  maxAttempts   Int          @default(6)  // лимит попыток (копия из MissionSlot.crackMaxAttempts на момент старта)
  wordList      Json         // массив 25-30 слов, показываемых игроку
  attemptsUsed  Int          @default(0)  // 0..maxAttempts
  attempts      Json         @default("[]")  // массив попыток: [{ word, positions: [...] }]
  version       Int          @default(0)  // optimistic locking — см. .docs/modules/concurrency.md
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  slot          MissionSlot  @relation(fields: [slotId], references: [id], onDelete: Cascade)

  @@unique([userId, slotId])
  @@index([userId])
}
```

**Назначение:** Активная сессия миссии Crack. UNIQUE на `(userId, slotId)` — одна сессия на пару (игрок, слот). У одного игрока может быть несколько активных сессий одновременно (по одной на каждый Crack-слот).

**Жизненный цикл:**

1. **Создаётся** при первом обращении игрока к слоту. `targetWord` генерируется случайно из `wordList5letters`. `maxAttempts` копируется из `MissionSlot.crackMaxAttempts` — становится «слепком» параметра (защита от изменений в админке посреди игры).
2. **При успехе** (слово угадано → `/complete`) — **удаляется** (миссия пройдена, сессия не нужна).
3. **При провале** (попытка `#(maxAttempts+1)`) — **пересоздаётся**: новый `targetWord` (случайный), новый `wordList`, `attemptsUsed=0`, `attempts=[]`. `maxAttempts` остаётся прежним.

**Инвариант:** даже если админ изменит `MissionSlot.crackMaxAttempts` посреди игры — у игрока с активной сессией лимит остаётся прежним. Игрок доигрывает по правилам, увиденным в начале. Новое значение применится только к новым сессиям.

`**@default(6)` на уровне БД\*\* — защита от рассинхрона. Если в `MissionSlot.crackMaxAttempts` каким-то образом окажется null (миграция со старых данных), сессия создастся с лимитом 6 — игра не сломается.

**При перезапуске игры:** все сессии игрока удаляются (DELETE).

---

### `RdpFile` — файлы RDP-симуляции

```prisma
model RdpFile {
  id        String       @id @default(cuid())
  slotId    String       // привязка к конкретному RDP-слоту (RDP_VICTOR, RDP_MARINA, ...)
  name      String       // имя файла, отображаемое в симуляции
  url       String       // ссылка в Beget Cloud Storage
  size      Int?         // размер в байтах
  folder    String       // имя папки в симуляции ("Архив", "Маркова", "Документы")
  isLocked  Boolean      @default(false)  // папка запаролена
  createdAt DateTime     @default(now())

  slot      MissionSlot  @relation(fields: [slotId], references: [id], onDelete: Cascade)

  @@index([slotId])
}
```

**Назначение:** Метаданные PDF-файлов, отображаемых в симуляции Windows миссии RDP.

**Привязка к слоту через `slotId`:** разделяет файлы Виктора и Марины — у них могут быть одноимённые папки и файлы, но контент разный.

**Поле `folder`** остаётся строкой (виртуальная группировка внутри слота, не отдельная сущность).

**Инвариант:** `isLocked` должен быть **одинаков для всех файлов одной папки одного слота**. Проверяется в админке при загрузке. Админка имеет отдельное действие «изменить isLocked для всей папки» — атомарное обновление всех файлов.

**Каскад:** при удалении `MissionSlot` все связанные `RdpFile` тоже удаляются (метаданные). Сами объекты в Beget Cloud Storage — отдельным заданием в обработчике `DELETE` (не каскадно через БД).

---

## Модели — финальный отчёт

### `FinalReportQuestion` — вопросы

```prisma
model FinalReportQuestion {
  id            String    @id @default(cuid())
  orderIndex    Int       // порядок вопросов
  questionText  String
  options       Json      // ["Виктор", "Евгений", "Елена", "Марина"]
  correctOption Int       // индекс правильного ответа (0..N-1)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([orderIndex])
}
```

**Назначение:** Вопросы финального отчёта. Глобальный контент.

**Защита:** `correctOption` НИКОГДА не возвращается клиенту через игровой API. Проверка ответов — только на сервере в `POST /api/report/submit`. Клиент видит только `questionText` + `options` без правильного индекса.

`**options` как JSON:\*\* количество вариантов гибкое (2-5 в типичном случае), без миграции БД при изменении.

---

### `FinalReportContent` — тексты концовок

```prisma
model FinalReportContent {
  id                String    @id @default(cuid())
  finalChoiceValue  String    @unique  // UPPERCASE-ключ выбора из REPORT_FINAL_CHOICES (например, "ACCUSE", "PROTECT")
  title             String    // заголовок финального текста
  bodyText          String    // полный текст истории
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

**Назначение:** Тексты концовок (по одной записи на каждый возможный выбор в форме отчёта).

**`finalChoiceValue`** — UPPERCASE-ключ выбора из `REPORT_FINAL_CHOICES` (например, `ACCUSE`, `PROTECT`). При сдаче отчёта выбор приходит в теле `POST /submit` (Phase 17). Сервер ищет запись по `finalChoiceValue` — благодаря `@unique` найдёт ровно одну.

⚠️ **Инвариант:** для каждого значения из `REPORT_FINAL_CHOICES` должна существовать запись в `FinalReportContent`. Если игрок выберет вариант, для которого нет записи — `/submit` вернёт 500 «Контент финала не настроен».

**Конвенция UPPERCASE:** `"PROTECT"`, `"ACCUSE"` — обязательное соответствие между `REPORT_FINAL_CHOICES` и `FinalReportContent.finalChoiceValue`. Админка имеет валидатор `GET /api/admin/report/validate`, который проверяет это соответствие.

---

### `FinalReportLinkBlock` — блоки ссылок финального отчёта

```prisma
model FinalReportLinkBlock {
  id         String   @id @default(cuid())
  blockIndex Int      @unique          // 1 | 2 — фиксированные позиции
  text       String   @default("")     // текстовое содержимое блока
  images     Json     @default("[]")   // [{ url: string, key: string }]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Назначение:** Два фиксированных блока контента для страницы финального отчёта (Phase 17). Каждый блок содержит текст и список изображений, загруженных в Beget Cloud Storage (S3).

**`images`** — JSON-массив объектов `{ url: string, key: string }`, где `url` — публичная CDN-ссылка, `key` — ключ объекта в S3 (нужен для удаления через `deleteObject`).

**Инвариант:** всегда ровно 2 записи (`blockIndex: 1` и `blockIndex: 2`). Создаются сидером (`seedFinalReportLinkBlock()`), только редактируются — не создаются/удаляются через UI.

---

## Модели — подсказки Детектива

### `DetectiveHint` — глобальный список подсказок

```prisma
model DetectiveHint {
  id          String    @id @default(cuid())
  orderIndex  Int       @unique  // порядковый номер в выдаче
  text        String    @db.Text  // текст подсказки (может быть длинным)
  isActive    Boolean   @default(true)  // мягкое отключение
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([orderIndex])
  @@index([isActive])
}
```

**Назначение:** Глобальный контент. Сюжетные подсказки от Детектива по расследованию. Управляется админом.

**Не путать с:**

- `MissionSlot.hintText` — локальные подсказки внутри миссий (по знаку «?»)
- `OnboardingOverlay` — фиксированная экскурсия по интерфейсу при первом входе
- `ChatScript` — реплики Детектива в чате

**Почему `orderIndex @unique`:** в выдаче игрокам подсказки идут строго по порядку. Дубликаты порядка вызвали бы недетерминизм. При создании новой подсказки с занятым `orderIndex` админ должен переставить существующие.

**Мягкое отключение** через `isActive=false` — подсказка пропускается в выдаче, но `UserHintProgress.lastSeenHintIndex` игроков не меняется. При обратном включении — игроки увидят её.

---

### `UserHintProgress` — прогресс игрока по подсказкам

```prisma
model UserHintProgress {
  id                String    @id @default(cuid())
  userId            String    @unique
  lastSeenHintIndex Int       @default(0)  // orderIndex последней просмотренной подсказки
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**Назначение:** Индекс последней просмотренной подсказки для каждого игрока. 1:1 с `User`.

**Логика:**

- При первом обращении создаётся через UPSERT с `lastSeenHintIndex = 0`
- `GET /api/hints/current` ищет первую активную подсказку с `orderIndex >= lastSeenHintIndex`
- `POST /api/hints/advance` инкрементит и возвращает следующую

**При перезапуске игры:** запись игрока удаляется (DELETE) — при следующем открытии модалки игрок снова видит подсказку №1.

---

## Модели — админка и настройки

### `AppSettings` — глобальные настройки приложения (singleton)

```prisma
model AppSettings {
  id                       String   @id @default(cuid())
  defaultMarketingConsent  Boolean  @default(false)   // дефолт для галки согласия на маркетинг
  supportEmail             String   @default("support@example.com")  // email техподдержки
  privacyPolicyUrl         String   @default("https://example.com/privacy")  // ссылка на политику обработки данных
  finalReportQuestionId    String?  // указатель на финальный вопрос «Обвинить / Защитить»
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  finalReportQuestion      FinalReportQuestion? @relation(fields: [finalReportQuestionId], references: [id], onDelete: SetNull)
}
```

**Назначение:** Singleton — всегда ровно одна запись в таблице. Создаётся сидером при первом деплое, дальше только UPDATE через UI админки.

**Поля:**

| Поле                      | Назначение                                                                              | Где используется                          |
| ------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| `defaultMarketingConsent` | Начальное состояние галки маркетинга в форме регистрации                                | `GET /api/settings/registration-defaults` |
| `supportEmail`            | Email техподдержки в сообщениях об ошибках регистрации (неверный ключ, лимит активаций) | `GET /api/settings/registration-defaults` |
| `privacyPolicyUrl`        | Ссылка на политику обработки данных (рядом с обязательной галкой согласия)              | `GET /api/settings/registration-defaults` |
| `finalReportQuestionId`   | ID вопроса с вариантами «Обвинить / Защитить», используемого в финальном отчёте         | `GET/PUT /api/admin/report/history`, `GET /api/admin/report/validate` |

⚠️ **Юридические требования:**

- `defaultMarketingConsent` по умолчанию `false` — закон 152-ФЗ ст. 9 и GDPR ст. 7 требуют активный opt-in. Заказчик может изменить на `true` через админку — это его осознанная юридическая ответственность. UI админки показывает предупреждение.
- `privacyPolicyUrl` **обязателен для запуска в прод** — без рабочей ссылки регистрация юридически не валидна. Админка показывает баннер-предупреждение, пока поле содержит заглушку `https://example.com/privacy`.

---

### `AdminAuditLog` — аудит критичных действий

```prisma
model AdminAuditLog {
  id        String   @id @default(cuid())
  type      String   // 'user_restart', 'mission_slot_deleted', 'hint_deleted', 'admin_created', ...
  userId    String?  // кто инициировал (для restart — сам игрок; для админских — null или adminId)
  adminId   String?  // если действие совершил админ
  message   String   // человекочитаемое описание ("Игрок example@mail.com выполнил перезапуск игры")
  metadata  Json?    // структурированные детали (slotKey, hintId, affectedCount, ...)
  createdAt DateTime @default(now())

  @@index([type])
  @@index([createdAt])
  @@index([userId])
  @@index([adminId])
}
```

**Назначение:** Аудит критичных действий — перезапусков игроков, удалений слотов миссий, удалений подсказок, админских коррекций прогресса. Используется для отладки support-кейсов от заказчика после релиза.

**Что пишется (минимум на старте):**

| `type`                 | Кто инициировал | Когда                                                                                 |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `user_restart`         | userId игрока   | `POST /api/game/restart`                                                              |
| `mission_slot_deleted` | adminId         | `DELETE /api/admin/mission-slots/[id]` (с `slotKey`, `displayName` в metadata)        |
| `hint_deleted`         | adminId         | `DELETE /api/admin/hints/[id]` (с `hintId`, `orderIndex`, `affectedCount` в metadata) |
| `admin_created`        | adminId         | `POST /api/admin/admins`                                                              |
| `admin_deleted`        | adminId         | `DELETE /api/admin/admins/[id]`                                                       |
| `key_blocked`          | adminId         | `PATCH /api/admin/keys/[id]` с `isBlocked=true`                                       |

**Почему `userId` без каскада:** запись лога должна **пережить удаление пользователя**. Если игрока удалили — мы хотим знать, что он сделал перезапуск месяцем ранее. Поэтому без `onDelete: Cascade`. Поле опционально для системных событий.

Виден администратору в отдельном разделе админки `/admin/audit-log` (реализуется в Фазе 4).

---

## Схема связей

```
AccessKey ──< User
              │
              ├── GameProgress
              │
              ├── ChatState ──> ChatScript (через FK currentDetectiveMessageId / currentMarinaMessageId)
              │
              ├──< OperationLog
              │
              ├──< MissionProgress >── MissionSlot ──< RdpFile
              │                              │
              ├──< CrackSession ─────────────┘
              │
              └── UserHintProgress

ChatScript ──< ChatTransition >── ChatScript    (граф диалога)

DetectiveHint            (глобальный контент, без FK к User)
MissionSlot              (глобальный контент)
FinalReportQuestion      (глобальный контент)
FinalReportContent       (глобальный контент)
AppSettings              (singleton — глобальные настройки)

AdminUser                (изолированная, своя auth-схема)
AdminAuditLog            (аудит — без каскада, переживает удаление User/AdminUser)
```

**Принципы:**

- **Каскадное удаление с `User`** для всех персональных таблиц: `GameProgress`, `ChatState`, `OperationLog`, `MissionProgress`, `CrackSession`, `UserHintProgress`. При удалении аккаунта админом — все игровые данные чистятся автоматически.
- `**AdminUser` — полная изоляция.\*\* Никаких связей с `User` и игровыми таблицами. Своя auth-схема, своя ветка в `proxy.ts`.
- `**AdminAuditLog` — намеренно без каскада.\*\* Лог критичных действий должен сохраняться после удаления юзера/админа. Поле `userId`/`adminId` опционально и без FK с каскадом.
- `**DetectiveHint` без FK к User.\*\* Это глобальный контент (как `MissionSlot`, `ChatScript`). Прогресс игрока хранится отдельно в `UserHintProgress`.

---

## Сидеры

При первом деплое скрипт `prisma/seed.ts` создаёт минимально необходимый каркас. **Сидер запускается ТОЛЬКО один раз** — защита через `if (await prisma.<table>.count() === 0)` или флаг `--force`. При повторных деплоях не должен пересоздавать данные, иначе админская работа по наполнению затрётся.

### 1. `AdminUser` — первый администратор

Создаётся из ENV-переменных:

- `ADMIN_INITIAL_EMAIL`
- `ADMIN_INITIAL_PASSWORD` (хэшируется bcrypt при INSERT)

После создания первого админа эти ENV-переменные удаляются с сервера. Дальнейшие администраторы — через UI админки.

---

### 2. `AppSettings` — singleton с дефолтами

| Поле                      | Значение                                   |
| ------------------------- | ------------------------------------------ |
| `defaultMarketingConsent` | `false`                                    |
| `supportEmail`            | `"support@example.com"` (заглушка)         |
| `privacyPolicyUrl`        | `"https://example.com/privacy"` (заглушка) |

Заказчик меняет `supportEmail` и `privacyPolicyUrl` через админку **до запуска в прод**. Без замены — UI админки показывает баннер-предупреждение.

---

### 3. `MissionSlot` — 6 базовых слотов

| `slotKey`           | `displayName`                         | `missionType` | `orderIndex` | `isActive` | `logSubjectName` | Назначение                                 |
| ------------------- | ------------------------------------- | ------------- | ------------ | ---------- | ---------------- | ------------------------------------------ |
| `CRACK_P2`          | Взлом сайта P2 Digital                | CRACK         | 10           | true       | `null`           | Шаг 1                                      |
| `RDP_VICTOR`        | Удалённый доступ к компьютеру Виктора | RDP           | 20           | true       | `Виктор`         | Шаг 2: rdpScenario=1                       |
| `DECIPHER_SHANTAZH` | Расшифровка папки шантажа             | DECIPHER      | 30           | true       | `null`           | Шаг 3                                      |
| `CRACK_VUZ`         | Взлом сайта ВУЗа                      | CRACK         | 40           | true       | `null`           | Шаг 4                                      |
| `DECIPHER_MARKOVA`  | Расшифровка папки Маркова             | DECIPHER      | 50           | true       | `null`           | Шаг 5                                      |
| `RDP_MARINA`        | Удалённый доступ к компьютеру Марины  | RDP           | 60           | true       | `Неизвестно`     | Шаг 6: rdpScenario=2, триггерит чат Марины |

**Параметры механик в сидере:**

| `slotKey`           | `crackMaxAttempts` | `rdpScenario` | `timerSeconds` | `rdpPuzzleGridSize` | `nextRdpSlotKey` |
| ------------------- | ------------------ | ------------- | -------------- | ------------------- | ---------------- |
| `CRACK_P2`          | `5`                | —             | —              | —                   | `null`           |
| `RDP_VICTOR`        | —                  | `1`           | `null`         | `6`                 | `"RDP_MARINA"`   |
| `DECIPHER_SHANTAZH` | —                  | —             | —              | —                   | `null`           |
| `CRACK_VUZ`         | `5`                | —             | —              | —                   | `null`           |
| `DECIPHER_MARKOVA`  | —                  | —             | —              | —                   | `null`           |
| `RDP_MARINA`        | —                  | `2`           | `120`          | `7`                 | `null`           |

**Связь Decipher → RDP в сидере:**

| `slotKey` (Decipher) | `unlocksRdpFolder` | `unlocksRdpSlotKey` |
| -------------------- | ------------------ | ------------------- |
| `DECIPHER_SHANTAZH`  | `Шантаж`           | `RDP_VICTOR`        |
| `DECIPHER_MARKOVA`   | `Маркова`          | `RDP_VICTOR`        |

> **Примечание:** в сценарии Виктора (`RDP_VICTOR`) две запароленные папки — «Шантаж» и «Маркова». Каждая разблокируется своим Decipher-слотом. В сценарии Марины (`RDP_MARINA`) запароленных папок нет, соответствующих Decipher-слотов с `unlocksRdpSlotKey === 'RDP_MARINA'` тоже нет.

> **Имена папок для сидера** (`Шантаж`, `Маркова`) — заглушки. Реальные имена и распределение по RDP-слотам определит заказчик при наполнении контента через админку.

**Контентные поля** (`encryptedWord`, `correctIp`, `resultPassword`, `folderPath` и т.д.) заполняются заглушками — реальный контент админ загружает через админку. Шаги `orderIndex` с интервалом 10 — для гибкости вставок.

---

### 4. `ChatScript` — минимальный каркас диалогов

| `code`                | `chatType` | `isStart` | `isEnd` | `hasChoices` | `text` (заглушка)                                                                                    |
| --------------------- | ---------- | --------- | ------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `detective_greeting`  | DETECTIVE  | true      | false   | false        | "Здравствуйте, детектив. Начнём."                                                                    |
| `detective_end`       | DETECTIVE  | false     | true    | false        | "Дело завершено."                                                                                    |
| `marina_greeting`     | MARINA     | true      | false   | false        | "Я Марина. Я расскажу свою историю."                                                                 |
| `marina_final_choice` | MARINA     | false     | false   | true         | "Что вы решите?" + choices: `[{label:"Защитить",value:"PROTECT"},{label:"Обвинить",value:"ACCUSE"}]` |
| `marina_end_protect`  | MARINA     | false     | true    | false        | "Спасибо. (заглушка финала: защитить)"                                                               |
| `marina_end_accuse`   | MARINA     | false     | true    | false        | "Понимаю. (заглушка финала: обвинить)"                                                               |

---

### 5. `ChatTransition` — минимальный набор переходов

| from → to                                    | conditionType | conditionValue |
| -------------------------------------------- | ------------- | -------------- |
| `detective_greeting` → `detective_end`       | ALWAYS        | `null`         |
| `marina_greeting` → `marina_final_choice`    | ALWAYS        | `null`         |
| `marina_final_choice` → `marina_end_protect` | CHOICE        | `"PROTECT"`    |
| `marina_final_choice` → `marina_end_accuse`  | CHOICE        | `"ACCUSE"`     |

**Связность графа критична:** после сидера должен существовать путь от каждой `isStart=true` реплики до хотя бы одной `isEnd=true` реплики. Иначе игрок зависнет.

---

### 6. `FinalReportContent` — минимум для двух концовок

| `finalChoiceValue` | `title` (заглушка) | `bodyText` (заглушка)              |
| ------------------ | ------------------ | ---------------------------------- |
| `PROTECT`          | "Защита"           | "Заглушка финала: защитить Марину" |
| `ACCUSE`           | "Обвинение"        | "Заглушка финала: обвинить Марину" |

Реальные тексты загружаются админом через UI админки. Значения `PROTECT`/`ACCUSE` должны **совпадать** с `REPORT_FINAL_CHOICES` в `constants/reportFinalChoices.ts`.

---

### 7. `FinalReportLinkBlock` — два пустых блока ссылок

Создаются функцией `seedFinalReportLinkBlock()` (Phase 16 / Task 3):

| `blockIndex` | `text` | `images` |
| ------------ | ------ | -------- |
| `1`          | `""`   | `[]`     |
| `2`          | `""`   | `[]`     |

Upsert по `blockIndex` — повторный запуск сидера безопасен.

---

### 8. `DetectiveHint` — минимум одна заглушка

> **Статус: ⏳ ещё не в `prisma/seed.ts`.** Функция `seedDetectiveHint()` добавляется в **Phase 8 / Task 1** (вместе с CRUD подсказок). До этого момента таблица `DetectiveHint` пуста — это ожидаемо и ничего не ломает: модель не используется в фазах 0–7. Не путать с уже реализованными сидерами (`seedAdminUser`, `seedAppSettings`, `seedMissionSlots`, `seedChatGraph`, `seedFinalReportContent`).

Целевой вид сидера (реализовать в Phase 8 / Task 1):

```typescript
await prisma.detectiveHint.upsert({
  where: { orderIndex: 1 },
  create: {
    orderIndex: 1,
    text: "Заглушка подсказки. Финальный текст предоставит заказчик.",
    isActive: true,
  },
  update: {},
});
```

Создаётся для тестирования UI до получения финальных текстов от заказчика.

---

## Критичные транзакции

### 1. Регистрация игрока

Атомарная операция: проверка ключа + создание User + инициализация связанных записей + инкремент счётчика активаций. Защита от race condition при одновременных регистрациях по одному ключу.

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Создать User
  const user = await tx.user.create({
    data: {
      name,
      email,
      passwordHash,
      accessKeyId,
      consentMarketing,
      consentPolicy: true,
    },
  });

  // 2. Создать связанные записи прогресса
  await tx.gameProgress.create({ data: { userId: user.id } });
  await tx.chatState.create({ data: { userId: user.id } });

  // 3. Инкремент с защитой от race
  // key.maxActivations — значение из объекта, загруженного ДО транзакции.
  // updateMany с WHERE-условием атомарен: если между чтением и записью
  // другой запрос инкрементировал счётчик — UPDATE затронет 0 строк → ROLLBACK.
  const updated = await tx.accessKey.updateMany({
    where: {
      id: accessKeyId,
      currentActivations: { lt: key.maxActivations },
    },
    data: { currentActivations: { increment: 1 } },
  });

  if (updated.count === 0) {
    // Race condition: пока мы шли сюда, кто-то другой исчерпал лимит
    throw new Error("ACTIVATIONS_EXCEEDED");
  }
});
```

**Почему именно так:** если два запроса прошли проверку «есть ли свободный слот» до транзакции, второй UPDATE затронет 0 строк — транзакция откатится, у второго пользователя User не создастся.

---

### 2. Перезапуск игры (Restart)

Полный сброс прогресса в одной транзакции. Что НЕ трогается: `User` (включая `onboardingDone`), `AccessKey.currentActivations`, всё глобальное содержимое.

**Гонки:** транзакция начинается с PostgreSQL advisory lock на `userId` — два параллельных restart'а от одного пользователя выполняются последовательно. См. `.docs/modules/concurrency.md` → раздел «Restart с таймером и advisory lock».

```typescript
await prisma.$transaction(async (tx) => {
  // Advisory lock — блокирует параллельные restart'ы на одного userId.
  // Освобождается автоматически в COMMIT/ROLLBACK.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

  // DELETE — записи, которые полностью удаляются
  await tx.missionProgress.deleteMany({ where: { userId } });
  await tx.crackSession.deleteMany({ where: { userId } });
  await tx.operationLog.deleteMany({ where: { userId } });
  await tx.userHintProgress.deleteMany({ where: { userId } });

  // UPDATE — записи, которые обнуляются (не удаляются, чтобы не было проблем с FK)
  await tx.chatState.update({
    where: { userId },
    data: {
      currentDetectiveMessageId: null,
      currentMarinaMessageId: null,
      playerChoices: {},
      finalChoice: null,
      detectiveFinished: false,
      marinaFinished: false,
    },
  });
  await tx.gameProgress.update({
    where: { userId },
    data: {
      marinaTriggered: false,
      finalReportDone: false,
      finalScore: null,
      finalReportChoice: null,
      finalReportAnswers: null,
    },
  });

  // INSERT — стартовая запись в новом OperationLog
  await tx.operationLog.create({
    data: { userId, type: "INFO", message: "Игра начата заново" },
  });

  // INSERT — аудит
  await tx.adminAuditLog.create({
    data: {
      type: "user_restart",
      userId,
      message: `Игрок ${userEmail} выполнил перезапуск игры`,
    },
  });
});
```

**Полная единая точка истины** — `lib/game/restart.ts`. API-эндпоинт `POST /api/game/restart` только вызывает её и возвращает `{ success: true }`.

---

### 3. Завершение Crack-слота

Транзакция: пометка прогресса + удаление сессии + лог.

```typescript
await prisma.$transaction([
  prisma.missionProgress.upsert({
    where: { userId_slotId: { userId, slotId } },
    create: { userId, slotId, completed: true, completedAt: new Date() },
    update: { completed: true, completedAt: new Date() },
  }),
  prisma.crackSession.delete({ where: { userId_slotId: { userId, slotId } } }),
]);

// Логи пишутся через writeLog() после транзакции
await writeLog(userId, "crack_access_granted", { targetUrl, resultPassword });
await writeLog(userId, "mission_completed_overview", { displayName });
```

---

### 4. Crack — провал на последней попытке

Пересоздание сессии: новый `targetWord` (случайный) + новый `wordList`, обнуление попыток. `maxAttempts` сохраняется. Запись лога.

```typescript
// Новое случайное слово и поле при каждом пересоздании (см. missions-crack.md, правило 9).
const { targetWord: newTargetWord, wordList: newWordList } = generateCrackField();

await prisma.crackSession.update({
  where: { id: session.id, version: expectedVersion },
  data: {
    targetWord: newTargetWord, // новое случайное слово при пересоздании
    wordList: newWordList,
    attemptsUsed: 0,
    attempts: [],
    version: { increment: 1 },
    // maxAttempts НЕ меняется
  },
});

await writeLog(userId, "crack_attempt_failed", { targetUrl, targetEmail });
```

---

## Optimistic locking

На критичных таблицах с быстро меняющимся состоянием — поле `version: Int @default(0)`. Каждый UPDATE инкрементирует `version`. Mutate-эндпоинты проверяют присланный `expectedVersion` против актуального — при несовпадении возвращают HTTP 409 Conflict.

**Защищённые модели:**

| Модель            | Зачем                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `GameProgress`    | Флаги `marinaTriggered`, `finalReportDone` — критичные триггеры.                               |
| `MissionProgress` | `completed`, `metadata` — состояние миссий, часто меняется параллельно.                        |
| `CrackSession`    | `attempts`, `attemptsUsed` — несколько параллельных попыток могут перетереть массив.           |
| `ChatState`       | `currentDetectiveMessageId`, `playerChoices` — параллельный `/advance` приводит к рассинхрону. |

**НЕ защищены:** `User`, `AccessKey`, `OperationLog`, `UserHintProgress`, `AdminAuditLog`. Обоснования — в `.docs/modules/concurrency.md` → раздел «Ключевые решения».

Подробный паттерн реализации, список эндпоинтов и обработка 409 на клиенте — в `.docs/modules/concurrency.md`.

---

## Индексы

Все DELETE-операции при перезапуске и каскадных удалениях идут по `userId`. Все списки в админке часто фильтруются по `chatType`, `missionType`, `isActive`. Эти индексы критичны для производительности:

```prisma
@@index([userId])           // MissionProgress, CrackSession, OperationLog, UserHintProgress
@@index([slotId])           // RdpFile (для выборки по слоту)
@@index([fromMessageId])    // ChatTransition (поиск исходящих переходов)
@@index([chatType])         // ChatScript (фильтр в админке)
@@index([code])             // ChatScript (поиск по машинному имени)
@@index([missionType])      // MissionSlot (фильтр по типу)
@@index([isActive])         // MissionSlot, DetectiveHint (мягкое отключение)
@@index([orderIndex])       // DetectiveHint, FinalReportQuestion (сортировка)
@@index([accessKeyId])      // User (поиск всех юзеров одного ключа)
@@index([createdAt])        // OperationLog, AdminAuditLog (сортировка по времени)
@@index([type])             // AdminAuditLog (фильтр по типу события)
```

`@unique` поля автоматически получают индекс — отдельно не указываем.

---

## Миграции

Все изменения схемы — через Prisma:

```bash
# Создать миграцию (dev)
npx prisma migrate dev --name <название_миграции>

# Применить миграции в production (на VPS)
npx prisma migrate deploy

# Сгенерировать Prisma Client после изменений
npx prisma generate

# Открыть Prisma Studio для просмотра данных
npx prisma studio
```

**Правила:**

- Каждое изменение `schema.prisma` = новая миграция. Не редактировать существующие миграции после применения.
- Названия миграций — kebab-case на английском: `add-onboarding-done`, `add-crack-max-attempts`.
- При работе с production БД сначала миграция применяется на стейджинге (если есть) или на копии данных.
- Бэкапы БД — на стороне инфраструктуры Beget (ежедневные автоматические снимки). Отдельный `cron + pg_dump` со стороны приложения **не требуется**.

**Сидер:** запускается командой `npx prisma db seed` (скрипт в `prisma/seed.ts`). Все сидеры идемпотентны — проверяют существование данных через `count() === 0` или используют `upsert`.
