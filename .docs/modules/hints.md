# Модуль: Подсказки Детектива (hints)

> Спецификация системы сюжетных подсказок: кнопка-иконка на dashboard → модалка с подсказками по одной.
> Связанные файлы: `.docs/database.md` (модели `DetectiveHint`, `UserHintProgress`), `.docs/modules/admin.md` (CRUD подсказок).

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Что такое подсказки и чем они отличаются](#что-такое-подсказки-и-чем-они-отличаются)
3. [Архитектурные решения](#архитектурные-решения)
4. [Логика выдачи](#логика-выдачи)
5. [UI: кнопка и модалка](#ui-кнопка-и-модалка)
6. [API-эндпоинты](#api-эндпоинты)
7. [Сброс при перезапуске](#сброс-при-перезапуске)
8. [Файлы, которые создаются](#файлы-которые-создаются)
9. [Серверные правила](#серверные-правила)
10. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Цели модуля

После завершения этого модуля:
- На dashboard видна кнопка-иконка «Подсказка от Детектива»
- При клике открывается модалка с **одной** подсказкой
- Игрок нажимает «Далее» — показывается следующая
- Когда подсказки кончились — финальный экран модалки «Подсказок больше нет»
- Подсказки управляются админом через `/admin/hints` (CRUD)
- При перезапуске игры прогресс подсказок сбрасывается — игрок снова видит подсказку №1

**Не входит в модуль:**
- Подсказки внутри миссий (по знаку «?») — это `MissionSlot.hintText`, см. модули миссий
- Онбординг — это отдельный модуль
- Контент текстов подсказок — заглушки в коде, финальные тексты от заказчика
- Админский CRUD — это в `admin.md`

---

## Что такое подсказки и чем они отличаются

В проекте есть **три разные** механики, которые могут называться «подсказками». Важно их не путать:

| Механика | Где живёт | Когда показывается | Цель |
|---|---|---|---|
| **Подсказки Детектива** (этот модуль) | `DetectiveHint` + `UserHintProgress`, кнопка-иконка на dashboard | По требованию игрока | Сюжетные намёки от Детектива, направление расследования |
| **Локальная подсказка миссии** | `MissionSlot.hintText`, знак «?» внутри открытой миссии | По требованию игрока внутри миссии | Объяснение правил конкретной мини-игры |
| **Онбординг** | `OnboardingOverlay` (react-joyride) поверх dashboard | Один раз при первом входе | Экскурсия по интерфейсу |

**В этом модуле — только первая механика.** Остальные две — в своих модулях.

**Терминология в коде и документации:**
- «Hint» / «DetectiveHint» — этот модуль
- «hintText» (на `MissionSlot`) — локальная подсказка миссии
- «Onboarding» — экскурсия

---

## Архитектурные решения

### 1. По одной за раз — защита от спойлеров

**Проблема, если показать все:** игрок откроет 15 подсказок разом, прочитает их вне контекста расследования, узнает финал раньше времени. Атмосфера детектива сломана.

**Решение:** в модалке всегда **одна** подсказка. Кнопка «Далее» открывает следующую. Назад нельзя (но это не критично — игроки чаще хотят следующую, чем предыдущую). Если очень нужно — посмотрят в истории операций (но логи hints не пишутся, см. серверное правило 5 в `logs.md`).

### 2. Прогресс на сервере, не в localStorage

`UserHintProgress.lastSeenHintIndex` — серверный флаг. Почему не localStorage:
- Миграция с устройства на устройство
- Очистка кэша браузера не возвращает прогресс
- Единообразие с другими прогрессами

### 3. Сюжетные подсказки — глобальный контент

`DetectiveHint` — глобальная таблица (как `MissionSlot`, `ChatScript`). Не привязана к игроку, управляется админом. У всех игроков один и тот же набор подсказок.

**Альтернатива «персональные подсказки»** (зависят от того, на какой миссии застрял игрок) — overhead и сложность. Достаточно, что у Детектива есть последовательный сюжетный список, который игрок открывает по мере необходимости.

### 4. `orderIndex @unique` — детерминированный порядок

Подсказки выдаются строго по `orderIndex`. Дубликаты порядка вызвали бы недетерминизм — какая подсказка №3, если их две? Поэтому `@unique`.

При создании новой подсказки админ должен задать порядок без коллизий. Если нужно вставить в середину — переставить существующие (сдвинуть indexы). UI админки помогает с drag-and-drop.

### 5. Мягкое отключение через `isActive`

Админ может снять активность подсказки (`isActive=false`) — она пропадает из выдачи, но запись в БД остаётся, и `UserHintProgress.lastSeenHintIndex` игроков не корректируется.

**Логика выдачи:** ищем первую `isActive=true` подсказку с `orderIndex >= lastSeenHintIndex`. Неактивные пропускаются автоматически. При повторной активации — игроки её увидят.

### 6. Защита от спама — rate limit

`POST /api/hints/advance` — 30/мин на пользователя. Это защита от ситуации «игрок открыл DevTools и в цикле двигает индекс», что приведёт к мгновенному «расходу» всех подсказок и спойлерам. 30/мин — комфортный лимит для нормального использования (читать подсказку 2 секунды никто не успеет).

### 7. Запись прогресса — UPSERT

При первом обращении к `/api/hints/current` для игрока запись `UserHintProgress` ещё не существует. Используем UPSERT с `lastSeenHintIndex = 0`:

```typescript
await prisma.userHintProgress.upsert({
  where: { userId },
  create: { userId, lastSeenHintIndex: 0 },
  update: {},
});
```

`update: {}` — пустое, потому что при существующей записи ничего не меняем (только при advance).

---

## Логика выдачи

### Алгоритм `GET /api/hints/current`

```typescript
async function getCurrentHint(userId: string) {
  // 1. UPSERT прогресса (создать с 0, если не было)
  let progress = await prisma.userHintProgress.upsert({
    where: { userId },
    create: { userId, lastSeenHintIndex: 0 },
    update: {},
  });

  // 2. Найти первую активную подсказку с orderIndex >= lastSeenHintIndex
  const hint = await prisma.detectiveHint.findFirst({
    where: {
      isActive: true,
      orderIndex: { gte: progress.lastSeenHintIndex },
    },
    orderBy: { orderIndex: 'asc' },
  });

  if (!hint) {
    return { isFinished: true };
  }

  return {
    isFinished: false,
    hint: { id: hint.id, orderIndex: hint.orderIndex, text: hint.text },
  };
}
```

**Edge cases:**
- **Нет ни одной активной подсказки** (только что развернули, админ ничего не загрузил): `findFirst` вернёт `null` → `isFinished: true`. Клиент показывает финальный экран. Это норма для пустой системы.
- **Первая активная подсказка** имеет orderIndex 5 (1-4 неактивны или удалены): игрок при первом открытии увидит подсказку 5 как «первую» — это нормально, для него она и есть первая.
- **Между подсказками удалили несколько**: пропускаются автоматически через `findFirst`.

### Алгоритм `POST /api/hints/advance`

```typescript
async function advanceHint(userId: string) {
  const progress = await prisma.userHintProgress.findUnique({ where: { userId } });
  if (!progress) {
    // Не должно случаться — current уже UPSERT'нул запись.
    // Но на всякий случай — создаём.
    await prisma.userHintProgress.create({ data: { userId, lastSeenHintIndex: 0 } });
    return getCurrentHint(userId); // вернуть первую
  }

  // 1. Найти текущую подсказку (та, на которой стоит игрок)
  const current = await prisma.detectiveHint.findFirst({
    where: {
      isActive: true,
      orderIndex: { gte: progress.lastSeenHintIndex },
    },
    orderBy: { orderIndex: 'asc' },
  });

  if (!current) {
    return { isFinished: true };
  }

  // 2. Найти следующую за ней
  const next = await prisma.detectiveHint.findFirst({
    where: {
      isActive: true,
      orderIndex: { gt: current.orderIndex },
    },
    orderBy: { orderIndex: 'asc' },
  });

  // 3. Обновить lastSeenHintIndex на orderIndex следующей (или current.orderIndex + 1, если next=null)
  const newIndex = next ? next.orderIndex : current.orderIndex + 1;
  await prisma.userHintProgress.update({
    where: { userId },
    data: { lastSeenHintIndex: newIndex },
  });

  if (!next) {
    return { isFinished: true };
  }

  return {
    isFinished: false,
    hint: { id: next.id, orderIndex: next.orderIndex, text: next.text },
  };
}
```

**Почему обновляем `lastSeenHintIndex` на orderIndex следующей, а не на current+1:** если между current и next есть пропуски (например, current=5, next=10, 6-9 удалены/неактивны) — записываем 10. Тогда повторный `current` сразу вернёт 10, не делая лишний поиск. Это оптимизация — корректность сохраняется и при `current+1`, но БД делает больше работы.

---

## UI: кнопка и модалка

### Кнопка-иконка на dashboard

Постоянно видна. Размещение — в одном из углов dashboard (правый верхний или правый нижний). Имеет `data-onboarding-id="hints-button"` для подсветки в онбординге (см. `onboarding.md`).

```tsx
// components/game/hints/DetectiveHintsButton.tsx
'use client';
import { useState } from 'react';
import { DetectiveHintsModal } from './DetectiveHintsModal';

export function DetectiveHintsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-onboarding-id="hints-button"
        className="..."
        aria-label="Подсказка от Детектива"
      >
        <HintIcon /> Подсказка
      </button>
      {open && <DetectiveHintsModal onClose={() => setOpen(false)} />}
    </>
  );
}
```

### Модалка

При открытии — дёргает `GET /api/hints/current`. Возможные состояния:

| Состояние | Что показывается |
|---|---|
| Loading | Спиннер |
| Активная подсказка | Текст подсказки + кнопка «Далее» + кнопка «Закрыть» |
| `isFinished: true` | Финальный экран: «Подсказок больше нет» + кнопка «Закрыть» |
| Ошибка | Сообщение «Не удалось загрузить подсказку» + кнопка «Повторить» |

```tsx
// components/game/hints/DetectiveHintsModal.tsx
'use client';
import { useEffect, useState } from 'react';

export function DetectiveHintsModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<'loading' | 'active' | 'finished' | 'error'>('loading');
  const [hint, setHint] = useState<{ text: string; orderIndex: number } | null>(null);

  const loadCurrent = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/hints/current');
      const data = await res.json();
      if (data.isFinished) {
        setState('finished');
      } else {
        setHint(data.hint);
        setState('active');
      }
    } catch {
      setState('error');
    }
  };

  const handleAdvance = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/hints/advance', { method: 'POST' });
      const data = await res.json();
      if (data.isFinished) {
        setState('finished');
      } else {
        setHint(data.hint);
        setState('active');
      }
    } catch {
      setState('error');
    }
  };

  useEffect(() => { loadCurrent(); }, []);

  return (
    <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center">
      <div className="bg-card p-6 max-w-md ...">
        {state === 'loading' && <Spinner />}

        {state === 'active' && hint && (
          <>
            <h2>Подсказка №{hint.orderIndex}</h2>
            <p>{hint.text}</p>
            <button onClick={handleAdvance}>Далее</button>
            <button onClick={onClose}>Закрыть</button>
          </>
        )}

        {state === 'finished' && (
          <>
            <h2>Подсказок больше нет</h2>
            <p>Вернитесь, когда я подготовлю что-то новое для вас.</p>
            <button onClick={onClose}>Закрыть</button>
          </>
        )}

        {state === 'error' && (
          <>
            <p>Не удалось загрузить подсказку</p>
            <button onClick={loadCurrent}>Повторить</button>
            <button onClick={onClose}>Закрыть</button>
          </>
        )}
      </div>
    </div>
  );
}
```

**Поведение «Закрыть» при состоянии `active`:** просто закрывает модалку. Прогресс **не меняется** — текущая подсказка остаётся текущей. При повторном открытии игрок увидит её снова.

**Поведение «Далее»:** двигает прогресс. После «Далее» новая подсказка становится текущей. Если закрыть и открыть снова — увидит её, не предыдущую.

---

## API-эндпоинты

### `GET /api/hints/current`

**Auth:** Player only

**Query parameters:** нет

**Алгоритм:** см. выше — UPSERT прогресса + поиск активной подсказки.

**Response 200 (есть подсказка):**
```json
{
  "isFinished": false,
  "hint": {
    "id": "clx...",
    "orderIndex": 1,
    "text": "Текст первой подсказки..."
  }
}
```

**Response 200 (закончились):**
```json
{ "isFinished": true }
```

**Response 401:** если нет сессии или роль не PLAYER.

**Rate limit:** не нужен — игрок не может открывать модалку чаще, чем в реальном времени.

---

### `POST /api/hints/advance`

**Auth:** Player only

**Body:** пустой

**Rate limit:** **30 / мин на userId** (защита от автоматизированного перебора, см. архитектурное решение 6).

**Алгоритм:** см. выше — найти next, инкрементировать `lastSeenHintIndex`.

**Response 200 (есть следующая):**
```json
{
  "isFinished": false,
  "hint": {
    "id": "clx...",
    "orderIndex": 2,
    "text": "Текст второй подсказки..."
  }
}
```

**Response 200 (это была последняя):**
```json
{ "isFinished": true }
```

**Response 429:**
```json
{ "error": "RATE_LIMIT_EXCEEDED" }
```

**Что не делаем:**
- Не пишем в `OperationLog` (это не игровое событие)
- Не пишем в `AdminAuditLog` (рутинное действие)

---

## Сброс при перезапуске

В транзакции `lib/game/restart.ts`:

```typescript
prisma.userHintProgress.deleteMany({ where: { userId } })
```

Запись удаляется **полностью** (а не обновляется на 0). При следующем `GET /api/hints/current` UPSERT создаст новую запись с `lastSeenHintIndex = 0` — игрок увидит первую подсказку.

**Почему DELETE, а не UPDATE на 0:** консистентность с другими «удаляемыми» таблицами (`MissionProgress`, `OperationLog`, `CrackSession`). UPDATE используется только там, где запись логически существует всегда (`ChatState`, `GameProgress` — 1:1 с User). `UserHintProgress` создаётся лениво при первом обращении — нет смысла её оставлять.

См. `restart.md` → транзакция.

---

## Файлы, которые создаются

```
app/
└── api/
    └── hints/
        ├── current/
        │   └── route.ts                       # GET
        └── advance/
            └── route.ts                       # POST (rate limit 30/мин)

components/
└── game/
    └── hints/
        ├── DetectiveHintsButton.tsx           # Client Component, кнопка на dashboard
        └── DetectiveHintsModal.tsx            # Client Component, модалка с состояниями

lib/
└── hints/
    └── service.ts                             # getCurrentHint(userId), advanceHint(userId)

# Изменения в существующих файлах:
components/game/dashboard/DashboardClient.tsx  # добавление <DetectiveHintsButton />
```

**Серверный rate limiter** — используется существующий из `lib/rateLimit.ts` (создаётся в auth-модуле). Для нового лимита просто добавляется вызов:

```typescript
// app/api/hints/advance/route.ts
import { checkRateLimit } from '@/lib/rateLimit';

const allowed = checkRateLimit(`hints-advance:${userId}`, 30, 60_000);
if (!allowed) return Response.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
```

---

## Серверные правила

1. **`orderIndex` в админке начинается с 1** (не с 0) — валидация: `z.number().int().min(1)`. Это гарантирует, что `lastSeenHintIndex=0` (начальное значение) корректно найдёт первую подсказку с `orderIndex >= 0` (то есть любую, включая `orderIndex=1`).

2. **`lastSeenHintIndex` пишется только сервером** через `/api/hints/advance` или сидером (default 0). Нет публичного API на запись этого поля.

2. **`lastSeenHintIndex` пишется только сервером** через `/api/hints/advance` или сидером (default 0). Нет публичного API на запись этого поля.

3. **`UserHintProgress` создаётся через UPSERT** при первом обращении к `current`. Не должно быть ситуации «у игрока нет записи» (кроме случая прямого DELETE вне restart-транзакции, чего быть не должно).

4. **Rate limit 30/мин на advance** — обязателен. Без него возможен автоматизированный «расход» подсказок через DevTools.

5. **Не возвращать клиенту:**
   - Список всех подсказок (нет такого эндпоинта для игрока — только текущая)
   - `lastSeenHintIndex` (внутренний прогресс — клиенту не нужно его знать)
   - `createdAt`, `updatedAt` подсказки

6. **Hints НЕ пишутся в `OperationLog`.** Это не игровое событие, а интерфейсное действие игрока.

7. **При удалении подсказки админом** — никаких миграций `lastSeenHintIndex` игроков. Удалённая просто пропускается алгоритмом findFirst при следующем запросе. См. `admin.md` → раздел hints.

8. **При изменении `orderIndex` подсказок админом** — игроки могут увидеть «уже виденную» подсказку как новую (если новый orderIndex >= их `lastSeenHintIndex`). Это редкий и принятый эффект (см. `admin.md`).

9. **Текст подсказки может быть длинным.** Поле `DetectiveHint.text` в БД — `@db.Text` (не `String`). Лимит UI — нет, но в рамках разумного (~5000 символов рекомендуется).

---

## Связи с другими модулями

- **`database.md`** — модели `DetectiveHint`, `UserHintProgress` описаны там; здесь только применение.
- **`onboarding.md`** — кнопка «Подсказка» имеет `data-onboarding-id="hints-button"` и подсвечивается в онбординге.
- **`restart.md`** — `UserHintProgress.deleteMany({ where: { userId } })` в транзакции сброса.
- **`admin.md`** — раздел hints: CRUD подсказок, drag-and-drop для переупорядочивания, мягкое отключение.
- **`logs.md`** — НЕ пишутся события подсказок. См. серверное правило 5.
- **`auth.md`** — лимиты и `lib/rateLimit.ts` появляются вместе с auth, переиспользуются здесь.
