# Модуль: Чаты (chats)

> Спецификация скриптовых чатов с персонажами на основе графа диалога.
> Связанные файлы: `.docs/database.md` (модели `ChatScript`, `ChatTransition`, `ChatState`), `.docs/modules/missions-rdp.md` (триггер активации Марины), `.docs/modules/final-report.md` (использует `ChatState.finalChoice`).

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Архитектурные решения](#архитектурные-решения)
3. [Структура графа диалога](#структура-графа-диалога)
4. [Логика перехода (advance)](#логика-перехода-advance)
5. [Сценарии работы](#сценарии-работы)
6. [Активация триггеров](#активация-триггеров)
7. [Аудио-сообщения](#аудио-сообщения)
8. [Расшифровка аудио (accessibility)](#расшифровка-аудио-accessibility)
9. [Подстановка переменных](#подстановка-переменных)
10. [Чат Марины — особенности](#чат-марины--особенности)
11. [Обработка отсутствующего currentMessage](#обработка-отсутствующего-currentmessage)
12. [API-эндпоинты](#api-эндпоинты)
13. [Файлы, которые создаются](#файлы-которые-создаются)
14. [Серверные правила](#серверные-правила)
15. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Цели модуля

После завершения этого модуля:
- Игрок видит чат Детектива на dashboard с момента входа в игру
- Может листать реплики, делать выборы (если они есть в реплике)
- Чат Марины **скрыт до серверного триггера** (миссия RDP сценарий 2 → автоактивация в `/file-viewed` после изучения всех файлов слота)
- Реплики идут по графу: после линейных участков → ветвления (CHOICE) → ожидания событий (TRIGGER)
- Аудио-сообщения воспроизводятся как голосовые в Telegram
- Финальный выбор игрока в чате Марины фиксируется в `ChatState.finalChoice` (`PROTECT` / `ACCUSE`)
- Граф полностью управляется админом без изменений кода

**Не входит в модуль:**
- UI-компоненты dashboard (это в общем dashboard)
- Контент реплик и аудиофайлы — от заказчика
- Админка для редактирования графа (раздел `chats` в `admin.md`)
- Запись событий чатов в `OperationLog` — НЕ делается (см. `logs.md`, серверное правило)
- Real-time чат через WebSocket — не требуется, чат скриптовый

---

## Архитектурные решения

### 1. Граф диалога вместо линейной последовательности

**Проблема линейной модели:** одна таблица `Message` с `nextMessageId` поддерживает только линейные диалоги. Любое ветвление (выбор игрока) требует костылей — несколько колонок `nextMessageIfChoiceA`, `nextMessageIfChoiceB`, или хардкод в коде. При появлении нового типа условия (например, ожидание серверного события) — миграция БД и переписывание логики.

**Решение:** граф — два узла (`ChatScript` — реплика) и рёбра (`ChatTransition` — переход с условием). Любое ветвление выражается через несколько рёбер с разными условиями.

```
ChatScript A ──ALWAYS──→ ChatScript B ──CHOICE("yes")──→ ChatScript C
                                      └──CHOICE("no")───→ ChatScript D
                                                                │
                                                       TRIGGER("crack_completed:CRACK_P2")
                                                                ↓
                                                        ChatScript E
```

Это позволяет:
- Линейные участки — рёбра с `ALWAYS`
- Ветвления по выбору — несколько рёбер с `CHOICE` от одного узла
- Ожидание серверного события — ребро с `TRIGGER` от «ждущей» реплики
- Любая комбинация выше — без изменений схемы БД

### 2. Три типа условий перехода

| `conditionType` | `conditionValue` | Когда срабатывает |
|---|---|---|
| `ALWAYS` | `null` | Безусловно после закрытия `fromMessage`. Линейные участки. |
| `CHOICE` | `"lawyers"` или другое value из `ChatScript.choices` | Игрок нажал кнопку с этим value в `fromMessage`. |
| `TRIGGER` | `"crack_completed:CRACK_P2"` | Произошло названное серверное событие. Реплика `fromMessage` обычно «ждущая» (без `choices`, без других исходящих рёбер кроме TRIGGER). |

Каждое из этих условий в графе — отдельная запись в `ChatTransition`. Сервер при `advance` фильтрует переходы по типу.

### 3. `marinaTriggered` — единственный источник правды

Видимость чата Марины определяется флагом `GameProgress.marinaTriggered`. Это **единственное место**, где хранится «появился ли чат Марины». Раньше в схеме был дубль (`ChatState.marinaVisible`) — удалён.

**Кто пишет:** сервер в `POST /api/missions/rdp/[slotKey]/file-viewed` для слотов с `rdpScenario === 2`, в момент автоматической активации триггера (когда игрок просмотрел все файлы слота). См. `missions-rdp.md` → раздел «Шаг 4 — сюжетный триггер».

**Кто читает:** клиент через `GET /api/progress`. Если `marinaTriggered === true` — рендерит чат Марины на dashboard.

### 4. Конвенция UPPERCASE для finalChoice

`ChatState.finalChoice` хранится в верхнем регистре: `"PROTECT"`, `"ACCUSE"`. Это конвенция проекта — должно совпадать:
- `value` в choices финальной реплики Марины (`marina_final_choice` → `[{label:"Защитить",value:"PROTECT"}, ...]`)
- `FinalReportContent.finalChoiceValue`

**Зачем UPPERCASE:** машинные значения, не для UI. `label` — для UI (русский текст), `value` — для логики. UPPERCASE визуально отделяет машинное значение от человеческого.

**Валидатор связности** — `GET /api/admin/report/validate` проверяет соответствие между choices Марины и FinalReportContent (см. `final-report.md`). При расхождении админка показывает ошибку.

### 5. Рендер аудио — чисто клиентский

Аудиофайлы хранятся в Beget Cloud Storage. В `ChatScript.audioUrl` — публичная ссылка на S3-объект (или подписанная URL — решается при реализации). На клиенте рендер через нативный `<audio>` элемент. Никакой серверной обработки потока.

**Стилизация под голосовое сообщение** — клиентская задача (волновая диаграмма опционально, кнопка play/pause, прогресс). Можно использовать `wavesurfer.js`, но для MVP достаточно нативного `<audio controls>`.

### 6. Нет реал-тайма

Чаты скриптовые: реплики появляются по нажатию «Далее» (для ALWAYS-переходов), по клику на choice (для CHOICE), или после завершения серверного события (для TRIGGER) — но в последнем случае клиент инициирует ре-проверку через `GET /api/chat/state` после успеха игровой миссии.

Пинговать сервер каждые N секунд НЕ нужно — все игровые события происходят в ответ на действия игрока, после которых клиент уже делает запрос за свежим состоянием.

---

## Структура графа диалога

### Узлы — `ChatScript`

См. `database.md` → `ChatScript`. Ключевые поля для логики:

- `chatType: 'DETECTIVE' | 'MARINA'` — к какому чату относится реплика
- `author: 'DETECTIVE' | 'PLAYER' | 'MARINA' | 'ANONYMOUS'` — от чьего лица показывается реплика (enum `ChatAuthor`, `@default(DETECTIVE)`). Независим от `chatType`: внутри одного чата могут чередоваться авторы. Влияет **только на рендеринг** (выравнивание/стиль «пузыря», подпись отправителя), на логику переходов — нет.
- `code` (UNIQUE) — машинное имя для отладки и сидера
- `text` — текст реплики
- `audioUrl` — опциональная ссылка на аудио
- `hasChoices` — есть ли варианты ответов под репликой
- `choices` — JSON: `[{label, value}, ...]`
- `isStart` — точка входа в чат (одна на `chatType`)
- `isEnd` — конечная реплика (после неё чат завершён)

### Рёбра — `ChatTransition`

См. `database.md` → `ChatTransition`. Поля для логики:

- `fromMessageId` → `toMessageId` — направленное ребро
- `conditionType` — `ALWAYS` / `CHOICE` / `TRIGGER`
- `conditionValue` — зависит от типа
- `priority` — при множественных подходящих переходах сервер берёт первый по убыванию priority

### Состояние игрока — `ChatState`

См. `database.md` → `ChatState`. Ключевые поля:

- `currentDetectiveMessageId` / `currentMarinaMessageId` — указатели на реплики, на которых стоит игрок (по одной на каждый чат)
- `playerChoices` — JSON-карта `{ "<ChatScript.code>": "<value>" }` — какие выборы сделал игрок (для отладки и потенциального анализа)
- `finalChoice` — `"PROTECT"` / `"ACCUSE"` (заполняется при выборе в финальной реплике Марины)
- `detectiveFinished` / `marinaFinished` — флаги достижения `isEnd` реплики

---

## Логика перехода (advance)

### Алгоритм

При каждом `POST /api/chat/advance` или `POST /api/chat/choice` сервер выполняет:

```typescript
async function advanceChatState(userId: string, chatType: ChatType, options: { choiceValue?: string }) {
  // 1. Загрузить текущее состояние
  const state = await prisma.chatState.findUnique({ where: { userId } });
  const currentMessageId = chatType === 'DETECTIVE'
    ? state.currentDetectiveMessageId
    : state.currentMarinaMessageId;

  // 2. Если current не задан — найти isStart
  if (!currentMessageId) {
    const startMessage = await prisma.chatScript.findFirst({
      where: { chatType, isStart: true }
    });
    if (!startMessage) throw new Error('NO_START_MESSAGE');
    return setCurrentAndReturn(state, chatType, startMessage);
  }

  // 3. Загрузить current
  const current = await prisma.chatScript.findUnique({ where: { id: currentMessageId } });

  // 4. Если current — isEnd, ничего не делаем
  if (current.isEnd) {
    return { isFinished: true, currentMessage: current };
  }

  // 5. Найти исходящие переходы из current
  const transitions = await prisma.chatTransition.findMany({
    where: { fromMessageId: currentMessageId },
    orderBy: { priority: 'desc' }
  });

  // 6. Выбрать подходящий переход
  let chosen: ChatTransition | null = null;

  for (const t of transitions) {
    if (t.conditionType === 'ALWAYS') {
      chosen = t;
      break;
    }
    if (t.conditionType === 'CHOICE' && options.choiceValue && t.conditionValue === options.choiceValue) {
      chosen = t;
      break;
    }
    if (t.conditionType === 'TRIGGER') {
      // TRIGGER-переходы НЕ срабатывают через advance/choice от игрока
      // Они срабатывают только через специальный поток — см. «Активация триггеров»
      continue;
    }
  }

  // 7. Если переход не найден
  if (!chosen) {
    return { isWaiting: true, currentMessage: current };
  }

  // 8. Перейти на toMessage, обновить ChatState
  const next = await prisma.chatScript.findUnique({ where: { id: chosen.toMessageId } });

  await prisma.chatState.update({
    where: { userId },
    data: {
      [chatType === 'DETECTIVE' ? 'currentDetectiveMessageId' : 'currentMarinaMessageId']: next.id,
      // Если CHOICE — записать в playerChoices
      ...(options.choiceValue && {
        playerChoices: { ...state.playerChoices, [current.code]: options.choiceValue }
      }),
      // Если next.isEnd — пометить чат завершённым
      ...(next.isEnd && {
        [chatType === 'DETECTIVE' ? 'detectiveFinished' : 'marinaFinished']: true,
      }),
      // Если next — финальная реплика Марины и игрок только что сделал выбор —
      // зафиксировать finalChoice
      // Это специально обрабатывается в POST /api/chat/choice (см. далее)
    }
  });

  return { currentMessage: next, isWaiting: false };
}
```

### Поведение при разных условиях

| Состояние current | Тип следующего перехода | Поведение |
|---|---|---|
| Обычная реплика, есть `ALWAYS`-переход | `ALWAYS` | `advance` → переход |
| Реплика с `hasChoices=true` | `CHOICE` (по value) | `choice` с value → переход |
| Реплика без переходов кроме `TRIGGER` | `TRIGGER` | `advance`/`choice` → `isWaiting: true`, ничего не меняется |
| `isEnd === true` | — | `isFinished: true`, ничего не меняется |
| `currentMessageId === null` | — | Установить `isStart`-реплику, вернуть её |

### Гарантии инварианта

В админке валидатор графа проверяет, что:
- Для каждой реплики **без** `hasChoices` и **без** `isEnd` существует хотя бы один исходящий переход (`ALWAYS` или `TRIGGER`)
- Для реплики с `hasChoices=true` для каждого `value` из choices существует переход с `conditionType=CHOICE` и `conditionValue=value`

См. `admin.md` → раздел chats → валидатор связности.

---

## Сценарии работы

### A. Линейный участок (ALWAYS)

```
detective_greeting (ALWAYS) → detective_intro (ALWAYS) → detective_first_task (TRIGGER, ждёт)
```

Игрок открывает dashboard → видит `detective_greeting` → нажимает «Далее» → `POST /api/chat/advance` → сервер находит `ALWAYS`-переход → переход на `detective_intro`. И т.д.

### B. Ветвление (CHOICE)

```
marina_final_choice (hasChoices: [{label:"Защитить",value:"PROTECT"},{label:"Обвинить",value:"ACCUSE"}])
    ├─CHOICE("PROTECT")→ marina_end_protect (isEnd)
    └─CHOICE("ACCUSE") → marina_end_accuse  (isEnd)
```

Игрок видит реплику с двумя кнопками → нажимает «Защитить» → `POST /api/chat/choice` с body `{value: "PROTECT"}` → сервер находит CHOICE-переход с conditionValue=`"PROTECT"` → переход на `marina_end_protect`. Сервер также записывает `finalChoice = "PROTECT"` (см. ниже).

### C. Ожидание триггера (TRIGGER)

```
detective_after_p2 (TRIGGER "crack_completed:CRACK_P2") → detective_next
```

Игрок дошёл до `detective_after_p2` → видит реплику без кнопок «Далее» (или кнопка задизейблена с подсказкой «Ожидание...»). Идёт проходить миссию `CRACK_P2`. После успешного `POST /api/missions/crack/CRACK_P2/complete` сервер вызывает функцию `advanceTriggerListeners(tx, userId, 'crack_completed:CRACK_P2')` (в транзакции эндпоинта), которая проверяет ChatState текущего игрока и, если он ждёт это событие — обновляет `currentMessageId` на `toMessageId` соответствующего TRIGGER-перехода. Клиент получает обновлённое состояние через очередной `GET /api/chat/state`.

См. ниже секцию [Активация триггеров](#активация-триггеров).

### D. Активация Марины

Особый TRIGGER: после прохождения сюжетной точки (миссия RDP сценарий 2 → автоактивация триггера в `/file-viewed` по факту просмотра всех файлов слота) сервер устанавливает `GameProgress.marinaTriggered = true`. Клиент при следующем `GET /api/progress` видит флаг и **рендерит чат Марины** в dashboard.

При первом `GET /api/chat/state` для чата Марины (после активации) сервер видит `currentMarinaMessageId === null` → возвращает `isStart`-реплику Марины (`marina_greeting`).

### E. Финальный выбор Марины

Реплика `marina_final_choice` имеет два CHOICE-перехода (PROTECT, ACCUSE). Когда игрок делает выбор:

Фиксация `finalChoice` и срабатывание `final_choice_made` происходят **внутри той же транзакции**, что и сам переход выбора, — это критично для optimistic locking: `advanceTriggerListeners` делает ещё один UPDATE строки `ChatState` (Детектив может реагировать на финал отдельной репликой), поэтому клиенту нужно вернуть **итоговую** `version`. Если разнести на отдельные транзакции/запросы, клиент сохранит устаревшую версию и получит ложный 409 на следующем действии.

Это реализовано внутри `advanceChatState` (`lib/chat/advance.ts`): при `current.code === 'marina_final_choice'` в `updateData` пишется `finalChoice = choiceValue.toUpperCase()`, а сразу после guarded-update в той же транзакции вызывается движок триггеров, и возвращается финальная `version`:

```typescript
// lib/chat/advance.ts (фрагмент, внутри prisma.$transaction)
const updateData: Prisma.ChatStateUpdateInput = {
  [field]: next.id,
  version: { increment: 1 },
};

if (chosen.conditionType === 'CHOICE' && options.choiceValue !== undefined) {
  playerChoices[current.code] = options.choiceValue;
  updateData.playerChoices = playerChoices;
}

if (current.code === MARINA_FINAL_CHOICE_CODE && options.choiceValue !== undefined) {
  updateData.finalChoice = options.choiceValue.toUpperCase(); // UPPERCASE
}

const updated = await tx.chatState.update({
  where: { id: state.id, version: options.expectedVersion },
  data: updateData,
});

// Триггер для реплик, ждущих финального выбора — в той же транзакции
let finalVersion = updated.version;
if (current.code === MARINA_FINAL_CHOICE_CODE && options.choiceValue !== undefined) {
  await advanceTriggerListeners(tx, userId, CHAT_TRIGGER_EVENTS.FINAL_CHOICE_MADE);
  const fresh = await tx.chatState.findUniqueOrThrow({ where: { id: state.id } });
  finalVersion = fresh.version; // отражает и переход выбора, и срабатывание триггера
}

// ... вернуть currentMessage + finalVersion
```

**Альтернатива через флаг на ChatScript** — добавить `isFinalChoice: Boolean` на `ChatScript`, чтобы код не зависел от code строки. Но на старте это overhead — у нас одна финальная точка, проверка по code достаточна. Если в будущем заказчик попросит несколько финальных точек — добавим флаг.

---

## Активация триггеров

### Кто инициирует

При завершении миссии (`POST /api/missions/<type>/<slotKey>/complete`) или серверном событии (например, `POST /api/missions/rdp/<slotKey>/file-viewed` при автоматической активации триггера сценария 2) — серверный эндпоинт **внутри своей транзакции** после основных действий вызывает движок, передавая транзакционный клиент `tx`:

```typescript
import { advanceTriggerListeners } from '@/lib/chat/triggers';

await prisma.$transaction(async (tx) => {
  // ... основные мутации эндпоинта (MissionProgress и т.п.)
  await advanceTriggerListeners(tx, userId, CHAT_TRIGGER_EVENTS.CRACK_COMPLETED('CRACK_P2'));
});
```

### Реализация

Функция принимает **транзакционный клиент** `tx`, чтобы выполняться внутри транзакции вызывающего эндпоинта (например, `/choice` для `final_choice_made`) — так клиент получает итоговую `version` без ложного 409. Каждый UPDATE строки `ChatState` инкрементирует `version` (`concurrency.md` правило 2).

```typescript
// lib/chat/triggers.ts
import type { Prisma } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;

export async function advanceTriggerListeners(
  tx: TransactionClient,
  userId: string,
  triggerCode: string,
): Promise<void> {
  const state = await tx.chatState.findUnique({ where: { userId } });
  if (!state) return;

  // Проверяем оба чата (DETECTIVE и MARINA) — теоретически оба могут ждать
  for (const chatType of ['DETECTIVE', 'MARINA'] as const) {
    const currentId = chatType === 'DETECTIVE'
      ? state.currentDetectiveMessageId
      : state.currentMarinaMessageId;
    if (!currentId) continue;

    // Найти TRIGGER-переход с подходящим conditionValue из текущей реплики
    const transition = await tx.chatTransition.findFirst({
      where: {
        fromMessageId: currentId,
        conditionType: 'TRIGGER',
        conditionValue: triggerCode,
      },
      orderBy: { priority: 'desc' },
    });

    if (!transition) continue;

    const nextMessage = await tx.chatScript.findUnique({
      where: { id: transition.toMessageId },
    });
    if (!nextMessage) continue;

    await tx.chatState.update({
      where: { userId },
      data: {
        [chatType === 'DETECTIVE' ? 'currentDetectiveMessageId' : 'currentMarinaMessageId']: nextMessage.id,
        version: { increment: 1 }, // правило 2 concurrency.md: любой UPDATE ChatState инкрементирует version
        ...(nextMessage.isEnd && {
          [chatType === 'DETECTIVE' ? 'detectiveFinished' : 'marinaFinished']: true,
        }),
      },
    });
  }
}
```

> **Идемпотентность:** при повторном вызове с тем же `triggerCode` указатель уже ушёл с «ждущей» реплики, совпадающего TRIGGER-ребра нет — второго перехода не произойдёт. Двойной `/complete` или двойной `/choice` безопасны.

### Перечень триггеров

Захардкожен в `constants/chatTriggerEvents.ts`:

```typescript
export const CHAT_TRIGGER_EVENTS = {
  CRACK_COMPLETED: (slotKey: string) => `crack_completed:${slotKey}`,
  DECIPHER_COMPLETED: (slotKey: string) => `decipher_completed:${slotKey}`,
  RDP_COMPLETED: (slotKey: string) => `rdp_completed:${slotKey}`,
  RDP_MARINA_TRIGGERED: 'rdp_marina_triggered',
  FINAL_CHOICE_MADE: 'final_choice_made',
} as const;
```

В админке при создании TRIGGER-перехода админ выбирает значение из выпадающего списка — **свободный ввод запрещён** (защита от опечаток). Список генерируется на основе:
- Все слоты миссий (для `crack_completed:*`, `decipher_completed:*`, `rdp_completed:*`)
- Фиксированные значения (`rdp_marina_triggered`, `final_choice_made`)

См. `admin.md` → раздел chats → создание перехода.

---

## Аудио-сообщения

### Хранение

- Поле `ChatScript.audioUrl: String?` — публичный URL на объект в Beget Cloud Storage
- Загрузка из админки → admin endpoint загружает файл в S3, сохраняет URL → `audioUrl` обновляется

### Рендер на клиенте

```tsx
// components/game/chat/ChatMessage.tsx (фрагмент)
{message.audioUrl && (
  <>
    <audio
      controls
      src={message.audioUrl}
      className="w-full mt-2"
      preload="metadata"
    />
    <TranscriptToggle text={message.text} messageId={message.id} />
  </>
)}
```

**Стилизация под голосовое:** на старте — нативный `<audio controls>`. Если заказчик попросит точную копию интерфейса Telegram (волновая диаграмма) — добавим `wavesurfer.js` по ходу фазы.

### Размер и формат

- Допустимые форматы: MP3, WAV (предоставляет заказчик)
- Лимит размера на старте: 5 МБ на файл (захардкожен в админке при загрузке)
- Если потребуется больше — увеличиваем лимит, пересмотрим квоту S3

### Что НЕ делаем

- Транскодирование на сервере (заказчик присылает уже готовые MP3/WAV)
- Воспроизведение текста через TTS — out of scope
- Ускорение/замедление (часто доступно в Telegram) — на старте нет, можно добавить как клиентскую фичу позже
- Глобальный переключатель «всегда показывать расшифровку» в профиле пользователя — out of scope для MVP. Игрок решает по каждой реплике отдельно.
- Автоматический показ расшифровки по системным настройкам accessibility — не делаем.

---

## Расшифровка аудио (accessibility)

Аудио-сообщения сохраняют атмосферу «голосового сообщения» для слышащих игроков. Для слабослышащих — добавлена кнопка-аккордеон «Показать расшифровку» под каждым аудио. Текст реплики уже хранится в `ChatScript.text` (обязательное поле) и возвращается клиенту в каждом ответе API.

### Почему текст не показывается всегда

Если показывать текст параллельно с аудио — игрок прочитает реплику быстрее, чем прослушает. Это убивает темп подачи сюжета, заложенный в аудио (паузы, интонации). Поэтому по умолчанию виден только плеер, текст — по требованию.

### Поведение

- По умолчанию — `showTranscript = false`. Игрок видит только аудиоплеер.
- Кнопка «Показать расшифровку» — мелкая ссылка под плеером.
- Клик → раскрывается `message.text` под кнопкой.
- Повторный клик → текст скрывается, кнопка меняет надпись на «Скрыть расшифровку».
- Состояние локальное (`useState` в компоненте `TranscriptToggle`). **Не сохраняется** между сессиями, перерендерами всего чата, устройствами.

### Реплики без аудио

Реплики с `audioUrl === null` рендерятся как обычный текст. Кнопки расшифровки нет — текст и так виден.

### Компонент `TranscriptToggle`

```tsx
// components/game/chat/TranscriptToggle.tsx
'use client';
import { useState } from 'react';

export function TranscriptToggle({ text, messageId }: { text: string; messageId: string }) {
  const [open, setOpen] = useState(false);
  const transcriptId = `transcript-${messageId}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={transcriptId}
        className="text-sm underline mt-1 text-muted hover:text-foreground"
      >
        {open ? 'Скрыть расшифровку' : 'Показать расшифровку'}
      </button>
      {open && (
        <p id={transcriptId} className="text-sm mt-1 text-muted leading-relaxed">
          {text}
        </p>
      )}
    </>
  );
}
```

### Доступность (a11y)

- `aria-expanded` сообщает screen reader'у состояние «свёрнуто/развёрнуто».
- `aria-controls` связывает кнопку с раскрываемым контейнером.
- Кнопка фокусируется через Tab, активируется через Enter/Space (нативное поведение `<button>`).
- Контейнер с текстом получает фокус screen reader'а при открытии.

### Что НЕ входит

- Подсветка/выделение текста в момент произнесения (subtitle-style) — out of scope.
- Загрузка отдельного `.vtt`/`.srt` файла субтитров — не требуется, текст и так есть.
- Перевод реплик на другие языки — мультиязычность out of scope (см. `prd.md` → Out of Scope).

---

## Подстановка переменных

Текст любой реплики (`ChatScript.text`) может содержать токен `{{user.email}}`. Перед отправкой клиенту сервер заменяет его на email текущего игрока. Подстановка работает во всех точках отдачи текста: лента истории, текущая реплика и расшифровка аудио (это тот же `text`, отдельной обработки не требует).

### Токен

- Константа `USER_EMAIL_TOKEN = '{{user.email}}'` в `lib/chat/template.ts`.
- Другие токены в MVP не поддерживаются — при необходимости расширяется отдельно.

### Источник email

- `User.email` из БД по `userId` сессии (`findUniqueOrThrow`, `select: { email: true }`), один запрос на реквест.
- `session.user.email` **не используется** — callback `session()` в Auth.js несёт только `id` + `type`.

### Слой применения

- `toChatMessageView` и lib-функции чатов (`getChatState`, `getChatHistory`, `advanceChatState`) остаются **чистыми** — без подстановки.
- Подстановка — отдельный слой в `lib/chat/template.ts`: `applyChatTemplate`, `applyTemplateToView`, `applyTemplateToAdvanceResult`.
- Применяется **на границе роутов** в четырёх эндпоинтах: `GET /api/chat/state`, `GET /api/chat/messages`, `POST /api/chat/advance`, `POST /api/chat/choice`.
- В `replaceAll` используется replacement-функция `() => email`, а не строка — защита от интерпретации `$&`/`$$`, если email содержит `$`.

### Поведение

| Случай | Результат |
|---|---|
| `text === null` (аудио без текста) | `null`, без падения |
| Реплика без токена | Текст без изменений |
| Несколько вхождений токена | Заменяются все (`replaceAll`) |
| «Эхо»-реплики игрока в истории | Тоже прогоняются (map по всему массиву) |
| `currentMessage === null` в `/state` | Подстановка пропускается |

### Контент в админке

Реплика `marina_01_intro` с плейсхолдером `[подставить почту пользователя]` → `{{user.email}}` — **ручная правка в админке**, не в сиде. Полный граф Марины строится вручную по `logic-chat.md`; в `prisma/seed.ts` этой реплики нет.

---

## Чат Марины — особенности

### Видимость

- Реплики Марины (`chatType === 'MARINA'`) **существуют в БД с момента сидера**
- На клиенте чат Марины **скрыт**, пока `GameProgress.marinaTriggered === false`
- При загрузке dashboard клиент дёргает `GET /api/progress`, видит флаг, рендерит / не рендерит панель чата Марины

### Активация

`marinaTriggered` устанавливается в `true` сервером в `POST /api/missions/rdp/[slotKey]/file-viewed` при автоматической активации триггера — но только для слотов с `rdpScenario === 2`. Триггер срабатывает, когда игрок просмотрел все файлы всех папок слота (запароленные предварительно разблокированы). См. `missions-rdp.md` → раздел «Шаг 4 — сюжетный триггер».

После активации:
- Клиент видит чат Марины на dashboard
- Первый запрос `GET /api/chat/messages?chatType=MARINA` возвращает `marina_greeting` (через логику автостарта при `currentMarinaMessageId === null`)

### Финальный выбор

Реплика `marina_final_choice` имеет CHOICE-переходы на `marina_end_protect` и `marina_end_accuse`. После выбора:
1. `ChatState.currentMarinaMessageId` = `marina_end_protect` (или `marina_end_accuse`)
2. `ChatState.finalChoice` = `"PROTECT"` (или `"ACCUSE"`)
3. `ChatState.marinaFinished` = `true`
4. Клиент через `GET /api/progress` видит изменения, разблокирует кнопку «Финальный отчёт» (если все миссии тоже пройдены)

См. `final-report.md` → двойной триггер.

---

## Обработка отсутствующего currentMessage

### Сценарий

Админ удалил реплику из БД (например, `detective_intro`), а у нескольких игроков `currentDetectiveMessageId === <удалённая реплика>`.

Поскольку FK `currentDetectiveMessageId → ChatScript.id` имеет `onDelete: SetNull`, при удалении реплики все ссылки автоматически становятся `null`.

### Восстановление

При следующем запросе `GET /api/chat/state` или `POST /api/chat/advance`:
- Сервер видит `currentDetectiveMessageId === null`
- Запускает логику автостарта: ищет `ChatScript` с `chatType=DETECTIVE` и `isStart=true`
- Устанавливает на него указатель
- Возвращает эту реплику клиенту

**Эффект для игрока:** чат как будто перезапускается с начала. Это лучшее, что мы можем сделать после удаления реплики посреди диалога. Админка в момент удаления показывает предупреждение «N игроков сейчас на этой реплике, после удаления они вернутся к началу чата» (см. `admin.md`).

### Альтернатива — мягкое отключение

Вместо удаления админ может **пометить реплику как deleted/inactive** (через флаг). На старте этого не делаем — простое удаление с автовосстановлением через `isStart` достаточно.

---

## API-эндпоинты

| Метод | Путь | Назначение | Auth |
|---|---|---|---|
| GET | `/api/chat/state` | Текущее состояние чатов игрока | Player |
| GET | `/api/chat/messages` | История уже показанных реплик | Player |
| POST | `/api/chat/advance` | Перейти к следующей реплике (для ALWAYS) | Player |
| POST | `/api/chat/choice` | Зафиксировать выбор и перейти (для CHOICE) | Player |

### `GET /api/chat/state`

Возвращает указатели на текущие реплики обоих чатов + флаги.

**Query parameters:** нет

**Гейт Детектива по `onboardingDone`:**  
Если `onboardingDone === false` — `resolveChatSlot('DETECTIVE')` возвращает `{ currentMessage: null, isVisible: true }`, не вызывая `ensureChatStarted`. Первый старт чата происходит через колбэк завершения онбординга → `chatStore.refresh()`.

**Алгоритм:**

```typescript
async function getChatState(userId: string) {
  const state = await prisma.chatState.findUnique({ where: { userId } });

  // Auto-start: если указатель null — найти isStart-реплику и установить
  async function resolveCurrentMessage(
    currentId: string | null,
    chatType: ChatType,
    isVisible: boolean
  ) {
    // Марина не активирована — не трогаем
    if (chatType === 'MARINA' && !isVisible) {
      return { currentMessage: null, isWaiting: false, isFinished: false, isVisible: false };
    }

    let messageId = currentId;

    if (!messageId) {
      // Первый заход — найти и зафиксировать isStart-реплику
      const startMessage = await prisma.chatScript.findFirst({
        where: { chatType, isStart: true },
      });
      if (!startMessage) {
        return { currentMessage: null, isWaiting: false, isFinished: false, isVisible: true };
      }
      // Записываем в ChatState
      await prisma.chatState.update({
        where: { userId },
        data: {
          [chatType === 'DETECTIVE'
            ? 'currentDetectiveMessageId'
            : 'currentMarinaMessageId']: startMessage.id,
        },
      });
      messageId = startMessage.id;
    }

    const message = await prisma.chatScript.findUnique({ where: { id: messageId } });

    // Проверяем: есть ли выполнимый ALWAYS-переход (или CHOICE)
    // Если только TRIGGER-переходы — isWaiting=true
    const transitions = await prisma.chatTransition.findMany({
      where: { fromMessageId: messageId },
    });
    const isWaiting = !message?.isEnd &&
      transitions.length > 0 &&
      transitions.every(t => t.conditionType === 'TRIGGER');

    return {
      currentMessage: message
        ? { id: message.id, code: message.code, text: message.text,
            audioUrl: message.audioUrl, hasChoices: message.hasChoices,
            choices: message.choices, isEnd: message.isEnd }
        : null,
      isWaiting,
      isFinished: message?.isEnd ?? false,
      isVisible: true,
    };
  }

  const marinaVisible = (await prisma.gameProgress.findUnique({
    where: { userId }, select: { marinaTriggered: true }
  }))?.marinaTriggered ?? false;

  const [detective, marina] = await Promise.all([
    resolveCurrentMessage(state?.currentDetectiveMessageId ?? null, 'DETECTIVE', true),
    resolveCurrentMessage(state?.currentMarinaMessageId ?? null, 'MARINA', marinaVisible),
  ]);

  return {
    detective,
    marina,
    finalChoice: state?.finalChoice ?? null,
  };
}
```

**Ключевое правило:** `GET /api/chat/state` — **не чистый GET с точки зрения REST** (делает UPSERT при первом вызове). Это намеренно — клиент всегда получает валидное состояние без отдельного «инициализирующего» запроса. Аналогично `GET /api/hints/current` (тоже делает UPSERT при первом вызове, см. `hints.md`).

**Response 200:**
```json
{
  "detective": {
    "currentMessage": {
      "id": "clx...",
      "code": "detective_intro",
      "text": "...",
      "audioUrl": null,
      "hasChoices": false,
      "choices": null,
      "isEnd": false
    },
    "isWaiting": false,
    "isFinished": false
  },
  "marina": {
    "currentMessage": null,
    "isWaiting": false,
    "isFinished": false,
    "isVisible": false
  },
  "finalChoice": null
}
```

`marina.isVisible` определяется по `GameProgress.marinaTriggered`. Если `false` — клиент не рендерит панель Марины.

`isWaiting: true` — если current-реплика без `isEnd` и все её переходы — только TRIGGER (ждут серверного события). Клиент показывает реплику без кнопки «Далее» и без кнопок выбора.

`currentMessage: null` возможен только в двух случаях:
- Чат Марины (`isVisible: false`) — Марина ещё не активирована
- Нет `isStart`-реплики для этого chatType (баг конфигурации — сидер не отработал корректно)

### `GET /api/chat/messages`

Возвращает все реплики, которые игрок уже видел в указанном чате. Для рендера истории при загрузке dashboard.

**Query parameters:**
- `chatType: 'DETECTIVE' | 'MARINA'` (обязательно)

**Алгоритм:** в `ChatState.playerChoices` хранятся коды пройденных реплик с выборами. Но для рендера истории нужны все реплики (включая без выборов). Решение: **history восстанавливается обходом графа от `isStart` до текущей реплики**, учитывая `playerChoices`.

```typescript
// lib/chat/history.ts
export async function getChatHistory(userId: string, chatType: ChatType): Promise<ChatScript[]> {
  const state = await prisma.chatState.findUnique({ where: { userId } });
  const targetMessageId = chatType === 'DETECTIVE'
    ? state.currentDetectiveMessageId
    : state.currentMarinaMessageId;

  if (!targetMessageId) return [];

  const start = await prisma.chatScript.findFirst({
    where: { chatType, isStart: true },
  });

  // BFS/DFS от start до target, выбирая переходы по playerChoices
  const history: ChatScript[] = [];
  let current = start;
  while (current) {
    history.push(current);
    if (current.id === targetMessageId) break;

    const transitions = await prisma.chatTransition.findMany({
      where: { fromMessageId: current.id },
      orderBy: { priority: 'desc' },
    });

    let next: ChatScript | null = null;
    for (const t of transitions) {
      if (t.conditionType === 'ALWAYS') {
        next = await prisma.chatScript.findUnique({ where: { id: t.toMessageId } });
        break;
      }
      if (t.conditionType === 'CHOICE') {
        const playerChoice = state.playerChoices?.[current.code];
        if (playerChoice === t.conditionValue) {
          next = await prisma.chatScript.findUnique({ where: { id: t.toMessageId } });
          break;
        }
      }
      // TRIGGER — пропускаем; история до текущей реплики не требует TRIGGER
      // (если игрок прошёл TRIGGER-переход, то current уже после него)
    }

    if (!next) break;
    current = next;
  }

  return history;
}
```

**Response 200:**
```json
{
  "messages": [
    { "id": "clx1", "code": "detective_greeting", "text": "...", "audioUrl": null, ... },
    { "id": "clx2", "code": "detective_intro", "text": "...", ... },
    ...
  ]
}
```

**Edge case:** если граф изменён посреди игры (админ удалил/добавил рёбра), восстановление истории может прерваться. В этом случае возвращаем то, что удалось восстановить — игрок увидит частичную историю, но текущая реплика всегда доступна через `GET /api/chat/state`.

### `POST /api/chat/advance`

**Body (Zod):**
```typescript
const advanceSchema = z.object({
  chatType: z.enum(['DETECTIVE', 'MARINA']),
});
```

**Алгоритм:** вызывает `advanceChatState(userId, chatType, {})` без `choiceValue`. Применимо только для реплик без `hasChoices` и с `ALWAYS`-переходом.

**Response 200:**
```json
{
  "currentMessage": { "id": "clx...", "code": "...", "text": "...", ... },
  "isWaiting": false,
  "isFinished": false
}
```

**Response 400 (если current — реплика с выбором, нужно `/choice`):**
```json
{ "error": "CHOICE_REQUIRED" }
```

### `POST /api/chat/choice`

**Body (Zod):**
```typescript
const choiceSchema = z.object({
  chatType: z.enum(['DETECTIVE', 'MARINA']),
  value: z.string().min(1),
});
```

**Алгоритм:** вызывает `advanceChatState(userId, chatType, { choiceValue: value })`. Дополнительно: если current — финальная реплика Марины (`marina_final_choice`), записывает `finalChoice = value` в `ChatState`.

**Response 200:** аналогично `/advance`.

**Response 400:**
- `INVALID_CHOICE` — current — не реплика с выбором, или value не соответствует ни одному CHOICE-переходу.

---

## Файлы, которые создаются

```
app/
└── api/
    └── chat/
        ├── state/route.ts                  # GET
        ├── messages/route.ts               # GET (с query chatType)
        ├── advance/route.ts                # POST
        └── choice/route.ts                 # POST

components/
└── game/
    └── chat/
        ├── ChatPanel.tsx                   # Server Component, рендер двух чатов
        ├── ChatWindow.tsx                  # Client Component, история + текущая реплика
        ├── ChatMessage.tsx                 # Client Component, одна реплика (текст + audio)
        ├── TranscriptToggle.tsx            # Client Component, кнопка «Показать расшифровку» под аудио
        ├── ChatChoices.tsx                 # Client Component, кнопки выбора
        └── ChatAdvanceButton.tsx           # Client Component, кнопка «Далее»

lib/
└── chat/
    ├── advance.ts                          # advanceChatState() — основная логика перехода
    ├── triggers.ts                         # advanceTriggerListeners() — обработка TRIGGER-событий
    ├── template.ts                         # applyChatTemplate() — подстановка {{user.email}}
    ├── state.ts                            # getChatState() — текущее состояние обоих чатов
    └── history.ts                          # getChatHistory() — восстановление истории

constants/
└── chatTriggerEvents.ts                    # Список TRIGGER-событий

store/
└── chatStore.ts                            # Zustand: { detective, marina, advance, choice, refresh }
```

---

## Серверные правила

1. **Граф — единственный источник переходов.** Никакого хардкода «после X показать Y» в эндпоинтах. Все переходы — через `ChatTransition`.

2. **`finalChoice` — UPPERCASE.** Конвенция проекта. Валидатор `GET /api/admin/report/validate` проверяет соответствие между choices Марины и `FinalReportContent.finalChoiceValue`.

3. **TRIGGER-переходы НЕ срабатывают через `/advance` или `/choice` напрямую.** Только через `advanceTriggerListeners()` из миссий и других триггер-эндпоинтов. **Исключение:** в `/choice` после фиксации `finalChoice` сервер сам вызывает `advanceTriggerListeners(tx, userId, 'final_choice_made')` **в той же транзакции** — это намеренно, чтобы реплики могли реагировать на финальный выбор Марины, и чтобы клиент получил итоговую `version`.

4. **`marinaTriggered` пишется ТОЛЬКО в `POST /api/missions/rdp/[slotKey]/file-viewed`** при автоматической активации триггера для слотов с `rdpScenario === 2`. Никаких других точек записи. Это единственный путь активации Марины.

5. **`isStart` для Марины — точка входа после активации, а не «показать сразу».** Сам факт `isStart=true` не делает реплику видимой игроку — видимость определяется `marinaTriggered`.

6. **Запрет на изменение `code` через PATCH в админке** (см. `admin.md`). Изменение code сломает автостарт (поиск `marina_greeting` etc.), валидаторы и FinalReportContent.

7. **При удалении реплики** через `DELETE /api/admin/chats/scripts/[id]` — Prisma каскадно удаляет все её `ChatTransition` (входящие и исходящие). FK на `ChatState` обнуляются через `SetNull` — игроки автовосстанавливаются с `isStart`.

8. **При удалении реплики с активными игроками** — админка показывает предупреждение «N игроков сейчас здесь, они вернутся к началу чата». См. `admin.md`.

9. **Никогда не возвращать `targetMessageId` или внутренние ID без необходимости.** Клиент должен оперировать `code` и текстом реплики, а не CUID. ID нужен только для специфических операций (например, передача в `/api/chat/choice` — но и там по факту value используется, не id).

10. **Чаты не пишут в `OperationLog`.** События чатов (новая реплика, выбор) отражаются в самом интерфейсе чата. См. `logs.md`, серверное правило.

11. **Логику advance не дублировать.** `lib/chat/advance.ts` — единая точка. Оба эндпоинта (`/advance` и `/choice`) импортируют её.

12. **Optimistic locking на `ChatState`.** Эндпоинты `/advance` и `/choice` принимают `expectedVersion` в теле, возвращают обновлённую `version` в ответе. При несовпадении — HTTP 409. См. `.docs/modules/concurrency.md`.

---

## Связи с другими модулями

- **`database.md`** — модели `ChatScript`, `ChatTransition`, `ChatState` описаны там; здесь только применение.
- **`concurrency.md`** — эндпоинты `/advance` и `/choice` используют optimistic locking. Поле `version` на `ChatState` инкрементируется при UPDATE.
- **`missions-crack.md`** — после `POST /complete` вызывает `advanceTriggerListeners(tx, userId, 'crack_completed:<slotKey>')` в транзакции эндпоинта.
- **`missions-decipher.md`** — то же с `decipher_completed:<slotKey>`.
- **`missions-rdp.md`** — после `POST /complete` вызывает `rdp_completed:<slotKey>`. Дополнительно: `POST /file-viewed` при автоматической активации триггера для слотов `rdpScenario === 2` устанавливает `marinaTriggered=true` и вызывает `rdp_marina_triggered`.
- **`final-report.md`** — использует `ChatState.finalChoice` для выбора `FinalReportContent` через `finalChoiceValue`.
- **`restart.md`** — обнуляет `ChatState` (UPDATE на дефолты, не DELETE — чтобы не было проблем с FK).
- **`admin.md`** — раздел chats: CRUD реплик и переходов, валидатор связности, валидатор связности с FinalReportContent, загрузка аудио.
- **`logs.md`** — НЕ пишутся события чатов. Намеренно (см. серверное правило 10).
