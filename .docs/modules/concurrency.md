# Модуль: Защита от параллельных действий (concurrency)

> Связанные файлы: `.docs/database.md` (поле `version` в моделях), `.docs/modules/restart.md`, все модули миссий и чатов.

## Оглавление

1. [Контекст: почему это нужно](#контекст-почему-это-нужно)
2. [Что входит в модуль](#что-входит-в-модуль)
3. [Что НЕ входит](#что-не-входит)
4. [Ключевые решения](#ключевые-решения)
5. [Optimistic locking — как работает](#optimistic-locking--как-работает)
6. [Список защищённых эндпоинтов](#список-защищённых-эндпоинтов)
7. [Обработка 409 на клиенте](#обработка-409-на-клиенте)
8. [Restart с таймером и advisory lock](#restart-с-таймером-и-advisory-lock)
9. [Серверные правила](#серверные-правила)
10. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Контекст: почему это нужно

Игра — гибридная настольная. Один игровой аккаунт = команда за столом. Игроки могут открывать игру на нескольких устройствах одновременно (один смотрит PDF, другой решает пазл, третий читает чат). Это намеренная свобода продукта — жёсткое ограничение «одно устройство = один аккаунт» противоречит концепции.

Без защиты возникают следующие риски:

| Риск | В чём проблема |
|---|---|
| **Перетирание состояния миссий** | Два устройства одновременно вызывают `/attempt`, последний UPDATE затирает первый. Игрок теряет ход. |
| **Перетирание пазла RDP** | Один крутит плитки, второй — тоже. Серверный `puzzleField` сохраняет последний `/rotate-tile`, прогресс первого теряется. |
| **Двойные триггеры и логи** | Двойной `/complete` → две записи `mission_completed_overview` + два вызова `advanceTriggerListeners`. |
| **Рассинхрон чатов** | Один продвинул реплику Детектива через `/advance`, второй видит уже следующее сообщение без контекста. |
| **Потеря данных при restart** | Кто-то нажал «Начать заново» посреди миссии другого игрока — данные пропали неожиданно. |

## Что входит в модуль

После реализации:

- На критичных таблицах (`GameProgress`, `MissionProgress`, `CrackSession`, `ChatState`) добавлено поле `version: Int @default(0)`.
- Все mutate-эндпоинты, изменяющие эти таблицы, реализуют **optimistic locking**: клиент присылает `expectedVersion`, сервер сверяет, при несовпадении возвращает HTTP 409.
- Клиент при 409 показывает тост «Состояние изменилось на другом устройстве» + автоматически перечитывает данные.
- Restart защищён двойным механизмом: **UI-таймер 5 сек** (вариант E) + **PostgreSQL advisory lock** на `userId` (защита от гонок на сервере).

## Что НЕ входит

- WebSocket / Server-Sent Events для real-time синхронизации устройств — слишком тяжело для MVP.
- Heartbeat и индикатор «Вы открыты в N окнах» — может быть добавлен в будущем по жалобам.
- Принудительный single-session (один логин выкидывает другой) — **категорически нет**: ломает концепцию гибридной игры.
- Логирование конфликтов в `OperationLog` — это UX-событие, не игровое.

## Ключевые решения

### 1. Optimistic locking, а не pessimistic

Pessimistic lock (через `SELECT FOR UPDATE` на каждый запрос) держит блокировку на время выполнения и плохо масштабируется. Optimistic не блокирует, а проверяет в момент UPDATE. Для нашей нагрузки (десятки RPS на пользователя) optimistic — оптимален.

### 2. Поле `version` — Int, инкрементируется при каждом UPDATE

Альтернатива — `updatedAt` (timestamp). Отвергнута: миллисекундная точность не гарантирована, два UPDATE в одной транзакции могут иметь одинаковый `updatedAt`.

### 3. Не защищаем `OperationLog` и `UserHintProgress`

`OperationLog` — append-only, нет UPDATE → version бесполезен. Двойная запись лога допустима (визуально игрок видит «двойную попытку» — это правда).

`UserHintProgress` — изменяется только при нажатии «Далее» в подсказках. Двойной inc счётчика → игрок пропускает одну подсказку. Это терпимо.

### 4. Не защищаем `User` и `AccessKey`

`User` меняется редко (онбординг, согласия). Конфликты теоретически возможны, но эффект незначителен (например, дважды записать `onboardingDone=true`).

`AccessKey.currentActivations` уже защищён через атомарный UPDATE с проверкой `WHERE currentActivations < maxActivations` (см. `database.md` → «Критичные транзакции»).

### 5. Клиент НЕ ретраит автоматически

При 409 — только рефетч + тост. Повторять действие пользователя автоматически опасно: его действие могло быть основано на устаревшем состоянии (например, выбрал слово на основе старых попыток).

### 6. Restart защищён двойным механизмом

- **UI-таймер 5 сек** — защита от случайного нажатия второго игрока («Все знают, что мы начинаем заново?»).
- **Advisory lock на сервере** — защита от технических гонок (два HTTP-запроса одновременно).

Только UI-таймера недостаточно: игрок мог нажать одновременно с действительно желающим. Только advisory lock'а недостаточно: один из restart'ов всё равно выполнится, потеря данных останется.

## Optimistic locking — как работает

### Схема запроса

Все mutate-эндпоинты принимают `expectedVersion: number` в теле запроса (Zod-схема):

```typescript
import { z } from 'zod';

export const attemptCrackSchema = z.object({
  word: z.string().length(5),
  expectedVersion: z.number().int().nonnegative(),
});
```

### Серверная обработка

```typescript
export async function POST(req: Request, { params }: { params: { slotKey: string } }) {
  const body = attemptCrackSchema.parse(await req.json());
  const userId = (await auth()).user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.crackSession.findUnique({
        where: { userId_slotId: { userId, slotId } },
      });

      if (!session) return { status: 404, body: { error: 'SESSION_NOT_FOUND' } };

      if (session.version !== body.expectedVersion) {
        return {
          status: 409,
          body: {
            error: 'CONFLICT',
            currentVersion: session.version,
          },
        };
      }

      // ... бизнес-логика
      const updated = await tx.crackSession.update({
        where: { id: session.id, version: body.expectedVersion },
        data: {
          attempts: { push: newAttempt },
          attemptsUsed: { increment: 1 },
          version: { increment: 1 },
        },
      });

      return { status: 200, body: { /* ... */, version: updated.version } };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    // Prisma P2025 (Record not found) — версия изменилась между findUnique и update
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'CONFLICT' }, { status: 409 });
    }
    throw e;
  }
}
```

**Две точки проверки:**
1. `if (session.version !== body.expectedVersion)` — явная проверка после `findUnique`.
2. `where: { id, version: body.expectedVersion }` в `update` — гарантия атомарности на уровне БД (если между `findUnique` и `update` кто-то успел изменить версию).

Двойная проверка нужна потому, что между `findUnique` и `update` есть окно гонки. Второй UPDATE с `WHERE version = X` затронет 0 строк и Prisma бросит `P2025`.

### Возврат версии в каждом ответе

Каждый mutate-эндпоинт возвращает **новую** версию ресурса:

```json
{
  "success": true,
  "attempt": { /* ... */ },
  "version": 5
}
```

Клиент сохраняет её в локальном стейте (Zustand) и использует в следующем запросе как `expectedVersion`.

### GET-эндпоинты

Все GET-эндпоинты, читающие защищённые ресурсы, **должны возвращать поле `version`** в ответе:

```typescript
// GET /api/missions/crack/[slotKey]
return NextResponse.json({
  session: {
    id: session.id,
    targetWordLength: session.targetWord.length,
    attempts: session.attempts,
    attemptsUsed: session.attemptsUsed,
    maxAttempts: session.maxAttempts,
    version: session.version,
  },
});
```

Без этого клиент не сможет инициализировать `expectedVersion` после загрузки страницы.

## Список защищённых эндпоинтов

| Эндпоинт | Защищаемая таблица | Что инкрементируется |
|---|---|---|
| `POST /api/missions/crack/[slotKey]/attempt` | `CrackSession` (+ `MissionProgress` при провале) | `version` обеих (клиент сверяет `CrackSession.version`) |
| `POST /api/missions/crack/[slotKey]/complete` | `MissionProgress` | идемпотентен, `expectedVersion` НЕ принимает (см. примечание ниже) |
| `POST /api/missions/crack/[slotKey]/skip` | `MissionProgress` | идемпотентен, `expectedVersion` НЕ принимает (см. примечание ниже) |
| `POST /api/missions/decipher/[slotKey]/attempt` | `MissionProgress` | `version` инкрементируется, `expectedVersion` НЕ принимается (см. примечание) |
| `POST /api/missions/decipher/[slotKey]/complete` | `MissionProgress` | идемпотентен, `expectedVersion` НЕ принимает (см. примечание) |
| `POST /api/missions/decipher/[slotKey]/skip` | `MissionProgress` | идемпотентен, `expectedVersion` НЕ принимает (см. примечание) |
| `POST /api/missions/rdp/[slotKey]/rotate-tile` | `MissionProgress` | `version` |
| `POST /api/missions/rdp/[slotKey]/check-puzzle` | `MissionProgress` | `version` |
| `POST /api/missions/rdp/[slotKey]/timer-expired` | `MissionProgress` | `version` |
| `POST /api/missions/rdp/[slotKey]/unlock-folder` | `MissionProgress` | `version` |
| `POST /api/missions/rdp/[slotKey]/file-viewed` | `MissionProgress` (+ `GameProgress` при `marinaTriggered`) | `version` обеих |
| `POST /api/missions/rdp/[slotKey]/complete` | `MissionProgress` | `version` |
| `POST /api/missions/rdp/[slotKey]/skip` | `MissionProgress` (+ `GameProgress`) | `version` обеих |
| `POST /api/chat/advance` | `ChatState` | `version` |
| `POST /api/chat/choice` | `ChatState` | `version` |
| `POST /api/final-report/submit` | `GameProgress` | `version` |

**Особенности:**

- **Launch-эндпоинты** (`/api/missions/crack/launch`, `/api/missions/decipher/launch`, `/api/missions/rdp/connect`) — НЕ защищены version, потому что не модифицируют состояние, а только ищут слот по полям формы. Создание `CrackSession` при первом launch — атомарно через UPSERT.
- **Crack `/complete` и `/skip` — идемпотентны и `expectedVersion` НЕ принимают.** Причина: клиент знает только `CrackSession.version` (из GET и `/attempt`), а `MissionProgress` до первого завершения может не существовать (создаётся через `upsert`) — взять `expectedVersion` неоткуда. Защита обеспечивается бизнес-инвариантами: `/complete` требует «последняя попытка `CrackSession.attempts` === `targetWord`», `/skip` требует `failedSessionsCount >= 2`. Повторный вызов уже пройденной миссии возвращает тот же успех. `MissionProgress.version` всё равно инкрементируется при UPDATE (для consistency), но клиентом не сверяется.
- **Decipher `/attempt`, `/complete`, `/skip` — не используют `expectedVersion`.** Decipher — медленный текстовый ввод; параллельный ввод с двух устройств практически невозможен. `/attempt` делает read-then-upsert: `version` инкрементируется для consistency, но клиент его не сверяет (потеря одного инкремента `failedAttempts` в метриках — допустимо). `/complete` и `/skip` — идемпотентны через бизнес-инварианты: `lastAttemptCorrect`, порог `failedAttemptsCount >= threshold` и флаг `completed`. Это осознанное исключение, а не баг.
- **Rate limit** не заменяет optimistic locking. Это разные защиты: rate limit — от спама, version — от race condition.

## Обработка 409 на клиенте

### Универсальная утилита `fetchWithVersion`

```typescript
// lib/api/fetchWithVersion.ts
'use client';

import { toast } from '@/components/ui/Toast';

export async function fetchWithVersion(
  url: string,
  body: Record<string, unknown>,
  onConflict: () => Promise<void>
): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    toast.warning('Состояние изменилось на другом устройстве. Обновляю...');
    await onConflict();
    return res;
  }

  return res;
}
```

### Применение в компоненте

```typescript
'use client';
const { sessionData, mutate } = useSWR('/api/missions/crack/CRACK_P2');

async function handleAttempt(word: string) {
  const res = await fetchWithVersion(
    '/api/missions/crack/CRACK_P2/attempt',
    { word, expectedVersion: sessionData.version },
    () => mutate(),
  );

  if (res.ok) {
    const { version } = await res.json();
    mutate({ ...sessionData, version }, { revalidate: false });
  }
}
```

### Где НЕ нужна обработка

- GET-эндпоинты — конфликта не бывает.
- Launch-эндпоинты — не используют version.

## Restart с таймером и advisory lock

См. подробное описание в `.docs/modules/restart.md`. Здесь — суть.

### UI: двухэтапное подтверждение (5-сек таймер)

```
1. Игрок жмёт «Начать заново».
2. Открывается модалка:
   ┌─────────────────────────────────────────────┐
   │ Начать игру заново?                         │
   │                                             │
   │ Внимание! Это действие нельзя отменить.    │
   │ Убедитесь, что все игроки за столом знают.  │
   │ Весь прогресс будет потерян.                │
   │                                             │
   │ [Отмена]    [Подтвердить (5)] ◄─ серая     │
   └─────────────────────────────────────────────┘
3. Через 5 сек кнопка активна:
   [Отмена]    [Да, начать заново]
4. По клику — POST /api/game/restart.
```

Таймер — `useEffect` с `setInterval`, обновляющий локальный счётчик. При закрытии модалки таймер сбрасывается.

### Сервер: advisory lock через `pg_advisory_xact_lock`

```typescript
export async function restartGame(userId: string, userEmail: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    // ... все DELETE/UPDATE/INSERT
  });
}
```

**Почему advisory lock, а не `SELECT FOR UPDATE` на `User`:**
- `SELECT FOR UPDATE` блокирует **запись** в таблице — другие операции с этим `User` (например, чтение `onboardingDone`) тоже встанут.
- `pg_advisory_xact_lock` — это лёгкая блокировка по числовому ключу, никакие реальные строки не блокируются. Идеально для координации между транзакциями.

`hashtext()` — встроенная Postgres-функция, превращает строку (`userId`) в int4 для аргумента lock.

**Блок автоматически освобождается** в `COMMIT` или `ROLLBACK` транзакции — никаких ручных `pg_advisory_unlock`.

### Поведение при гонке

1. Запрос A заходит в транзакцию, берёт advisory lock на `userId=X`.
2. Запрос B приходит через 50 мс, заходит в транзакцию, **ждёт** lock'а A.
3. Запрос A выполняется (~100 мс), коммитится, lock освобождается.
4. Запрос B получает lock, выполняет DELETE/UPDATE — но они уже **холостые** (всё удалено в A). Технически работает: ничего лишнего не происходит, второй `game_restarted` лог пишется, второй `AdminAuditLog` пишется.

**Альтернатива:** проверять в начале транзакции, был ли restart за последнюю секунду. Но это сложнее и не даёт выигрыша.

## Серверные правила

1. **Поле `version` инициализируется в `0`** при создании записи (`@default(0)` в схеме).

2. **`version` инкрементируется в каждом UPDATE** этой записи, без исключений. Даже если изменяется только `version` — это означает «была попытка перезаписи».

3. **Mutate-эндпоинт без `expectedVersion` в теле — баг**, кроме явно задокументированных исключений: decipher (`/attempt`, `/complete`, `/skip`) и crack (`/complete`, `/skip`). Zod-схема обязательна для всех остальных. Отсутствующее поле → 400 Validation Error.

4. **Каждый mutate-ответ возвращает обновлённую `version`.** Клиент сохраняет её для следующего запроса.

5. **Каждый GET-ответ защищённых ресурсов возвращает `version`.** Без этого клиент не сможет инициализировать стейт.

6. **Prisma error `P2025` (Record not found) в `update` с проверкой `version` — это конфликт.** Возвращать 409, не 500.

7. **Advisory lock в restart использует именно `pg_advisory_xact_lock`, не `pg_advisory_lock`.** Первый освобождается транзакцией, второй нужно освобождать вручную — забыл = вечная блокировка.

8. **`OperationLog` и `UserHintProgress` НЕ защищены version.** См. «Ключевые решения», пункты 3-4.

## Связи с другими модулями

- **`database.md`** — модели `GameProgress`, `MissionProgress`, `CrackSession`, `ChatState` дополнены полем `version: Int @default(0)`. Транзакция restart использует `pg_advisory_xact_lock`.
- **`restart.md`** — UI-таймер 5 сек + advisory lock на сервере. Подробности там.
- **`missions-crack.md`**, **`missions-rdp.md`** — mutate-эндпоинты следуют паттерну optimistic locking из этого модуля. В Zod-схемах добавлено поле `expectedVersion`.
- **`missions-decipher.md`** — все три mutate-эндпоинта (`/attempt`, `/complete`, `/skip`) не используют `expectedVersion` по дизайну (см. «Список защищённых эндпоинтов»).
- **`chats.md`** — эндпоинты `/advance` и `/choice` защищены version `ChatState`.
- **`final-report.md`** — `/submit` защищён version `GameProgress`. Дополнительно остаётся защита через `finalReportDone` (двойная защита — на уровне версии + на уровне бизнес-флага).
- **`logs.md`** — конфликты НЕ логируются в `OperationLog`. Это UX-событие, не игровое.
- **`dod-global.md`** — DoD каждой mutate-фичи включает пункт «Обработка 409 Conflict реализована».
