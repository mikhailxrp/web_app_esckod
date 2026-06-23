# Модуль: Перезапуск игры (restart)

> Спецификация полного сброса прогресса игрока. Атомарная транзакция: одно действие — гарантированный консистентный результат.
> Связанные файлы: `.docs/database.md` (модели всех персональных таблиц), все игровые модули (что сбрасывается).

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Архитектурные решения](#архитектурные-решения)
3. [Что сбрасывается, что нет](#что-сбрасывается-что-нет)
4. [Атомарная транзакция](#атомарная-транзакция)
5. [API-эндпоинт](#api-эндпоинт)
6. [UI: кнопка и подтверждение](#ui-кнопка-и-подтверждение)
7. [Файлы, которые создаются](#файлы-которые-создаются)
8. [Серверные правила](#серверные-правила)
9. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Цели модуля

После завершения этого модуля:
- На главном экране есть кнопка «Начать заново»
- При клике открывается модалка подтверждения: «Вы уверены? Весь прогресс будет потерян»
- При подтверждении — игрок сбрасывается в стартовое состояние:
  - Все миссии считаются непройденными
  - Чаты сброшены к началу
  - История операций очищена (одна новая запись «Игра начата заново»)
  - Подсказки начинаются с первой
  - Финальный отчёт можно сдать заново
- НЕ сбрасываются: учётка пользователя, факт онбординга, активации ключа
- Запись в `AdminAuditLog` для отладки

**Не входит в модуль:**
- Сброс глобального контента — он не сбрасывается. `MissionSlot`, `ChatScript`, `ChatTransition`, `FinalReportQuestion`, `FinalReportContent`, `DetectiveHint`, `RdpFile`, `AppSettings` — управляются админом, не игроком.
- Удаление аккаунта — это в `admin.md` (бан/разбан). Restart НЕ удаляет `User`.

---

## Архитектурные решения

### 1. Единая транзакция в `lib/game/restart.ts`

Сброс — это **много DELETE и UPDATE**. Если одно из них упадёт, состояние станет неконсистентным (например, миссии удалены, но логи остались — игрок видит логи прошлых миссий, которые заново «не пройдены»).

Решение: **одна Prisma-транзакция** на всё. Всё или ничего.

```typescript
await prisma.$transaction(async (tx) => {
  // Advisory lock — блокирует параллельные restart'ы на одного userId.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

  await tx.missionProgress.deleteMany({ where: { userId } });
  await tx.crackSession.deleteMany({ where: { userId } });
  await tx.operationLog.deleteMany({ where: { userId } });
  await tx.userHintProgress.deleteMany({ where: { userId } });
  await tx.chatState.update({ /* обнуление */ });
  await tx.gameProgress.update({ /* обнуление */ });
  await tx.operationLog.create({ /* стартовая запись */ });
  await tx.adminAuditLog.create({ /* аудит */ });
});
```

### 2. DELETE для тех, кто 1:N с User; UPDATE для 1:1

| Таблица | 1:1 или 1:N | Действие | Почему |
|---|---|---|---|
| `MissionProgress` | 1:N | DELETE | Записи могут быть, могут не быть. Удаляем все. |
| `CrackSession` | 1:N | DELETE | Активные сессии. Удаляем. |
| `OperationLog` | 1:N | DELETE | Логи. Удаляем все, потом INSERT одну стартовую. |
| `UserHintProgress` | 1:1 | DELETE | Создаётся лениво при первом обращении. Проще удалить — при следующем `/api/hints/current` UPSERT создаст новую с `lastSeenHintIndex=0`. |
| `ChatState` | 1:1 | UPDATE | Запись существует с момента регистрации, FK на ChatScript. UPDATE обнуляет указатели и флаги. |
| `GameProgress` | 1:1 | UPDATE | Запись существует с момента регистрации. UPDATE обнуляет флаги. |

**Почему не DELETE для `ChatState` и `GameProgress`:** при DELETE затем INSERT — есть промежуточный момент, когда ChatState отсутствует. Если параллельно идёт другой запрос (например, `GET /api/chat/state`) — он может упасть. UPDATE на дефолты атомарнее.

**Почему DELETE для `UserHintProgress` (тоже 1:1):** запись создаётся **лениво** — при первом обращении к подсказкам. Игроки могут вообще не открывать подсказки за всю игру → записи нет. Удалять то, чего может не быть, проще, чем UPSERT-обновлять.

### 3. `AdminAuditLog` пишется обязательно

Перезапуск — это деструктивное действие. Если в support приходит сообщение «у меня пропал прогресс» — нужно отличить:
- Игрок сам нажал «Начать заново»
- Баг приложения

`AdminAuditLog` записывает с `userId` инициатора и сообщением. См. `database.md` → `AdminAuditLog`.

### 4. Rate limit 3/мин

**Почему лимит:** случайно нажать дважды — нормально. Намеренный спам кнопкой — не нормально (создаёт нагрузку транзакциями DELETE).

Лимит 3/мин на userId — комфортный для случайного двойного клика, но останавливает скрипт-спам.

### 5. Не сбрасываем `User`-поля

`User.onboardingDone` — игрок уже знает интерфейс, повторно показывать онбординг не нужно.

`User.consentMarketing` / `User.consentPolicy` — это юридическое согласие, не игровой прогресс.

`AccessKey.currentActivations` — счётчик активаций ключа. **НИКОГДА не уменьшается** (защита от обхода лимита через перезапуск). См. `database.md` → `AccessKey`.

### 6. Стартовая запись в логах

После очистки `OperationLog` в той же транзакции вставляется одна запись:
```
type: INFO
message: "Игра начата заново"
templateKey: 'game_restarted'
```

Чтобы у игрока в истории не было совсем пусто — он сразу видит, что игра действительно перезапущена.

### 7. UI-таймер 5 секунд перед подтверждением

Restart — деструктивное действие в **командной игре**. Один игрок за столом может случайно нажать «Начать заново» в момент, когда другой только что прошёл миссию.

Решение: модалка подтверждения с **двухступенчатой защитой**:
1. Модалка открывается с **серой кнопкой «Подтвердить»** и обратным отсчётом `5 → 4 → 3 → 2 → 1`.
2. После 0 кнопка становится активной — «Да, начать заново».
3. Кнопка «Отмена» доступна всё время.

5 секунд — достаточно, чтобы один игрок за столом сказал «Стоп, я ещё играю».

### 8. Advisory lock на сервере

UI-таймер защищает от человеческих ошибок, но не от технических гонок. Два параллельных запроса `POST /api/game/restart` (например, при двойном клике на разных вкладках) — могут привести к двойной транзакции и двойному `AdminAuditLog`.

Решение: PostgreSQL **advisory lock** в самом начале транзакции:

```typescript
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
  // ... DELETE/UPDATE/INSERT
});
```

Второй параллельный restart дождётся освобождения lock'а (~100 мс), после чего выполнится — но все DELETE будут холостыми (уже удалено), а лишний `game_restarted` лог и `AdminAuditLog` запись — это допустимый шум.

`pg_advisory_xact_lock` освобождается автоматически в `COMMIT`/`ROLLBACK` — ручное освобождение не требуется. См. `.docs/modules/concurrency.md` → раздел «Restart с таймером и advisory lock».

---

## Что сбрасывается, что нет

### Сбрасывается (DELETE)

| Таблица | Что значит для игрока |
|---|---|
| `MissionProgress` | Все миссии становятся непройденными. Можно проходить заново. |
| `CrackSession` | Активные сессии Crack удалены. При следующем открытии слота — новая сессия. |
| `OperationLog` | Вся история операций очищена. |
| `UserHintProgress` | При следующем открытии подсказок — снова с первой. |

### Обнуляется (UPDATE)

| Таблица | Поля | Что значит |
|---|---|---|
| `ChatState` | `currentDetectiveMessageId=null`, `currentMarinaMessageId=null`, `playerChoices={}`, `finalChoice=null`, `detectiveFinished=false`, `marinaFinished=false` | Чаты начинаются с `isStart`-реплик. Чат Марины снова скрыт (т.к. зависит от `GameProgress.marinaTriggered`). |
| `GameProgress` | `marinaTriggered=false`, `finalReportDone=false`, `finalScore=null`, `finalReportChoice=null`, `finalReportAnswers=null` | Чат Марины скрыт, отчёт можно сдать заново. |

### Создаётся (INSERT)

| Таблица | Что |
|---|---|
| `OperationLog` | Одна запись `game_restarted` («Игра начата заново») |
| `AdminAuditLog` | Запись `user_restart` с `userId` и сообщением |

### НЕ трогается

| Что | Почему |
|---|---|
| `User` (вся запись) | Учётка остаётся. Email, пароль, имя, ID. |
| `User.onboardingDone` | Онбординг видеть повторно не нужно. |
| `User.consentMarketing`, `User.consentPolicy` | Юридические согласия. |
| `AccessKey` (вся запись) | Ключ принадлежит группе пользователей. |
| `AccessKey.currentActivations` | НИКОГДА не уменьшается (защита от обхода лимита). |
| `AdminUser` | Не имеет отношения к игровому прогрессу. |
| Глобальный контент: `MissionSlot`, `ChatScript`, `ChatTransition`, `FinalReportQuestion`, `FinalReportContent`, `DetectiveHint`, `RdpFile`, `AppSettings` | Управляются админом, не игроком. |

---

## Атомарная транзакция

```typescript
// lib/game/restart.ts
import { prisma } from '@/lib/prisma';
import { renderLogMessage } from '@/lib/operationLog';

export async function restartGame(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Advisory lock — блокирует параллельные restart'ы на одного userId.
    // Освобождается автоматически в COMMIT/ROLLBACK.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const { email } = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    // === DELETE — записи, которые полностью удаляются ===

    await tx.missionProgress.deleteMany({
      where: { userId },
    });

    await tx.crackSession.deleteMany({
      where: { userId },
    });

    await tx.operationLog.deleteMany({
      where: { userId },
    });

    await tx.userHintProgress.deleteMany({
      where: { userId },
    });

    // === UPDATE — записи 1:1, которые обнуляются (не удаляются, чтобы не было проблем с FK) ===

    await tx.chatState.update({
      where: { userId },
      data: {
        currentDetectiveMessageId: null,
        currentMarinaMessageId: null,
        playerChoices: {},
        finalChoice: null,
        detectiveFinished: false,
        marinaFinished: false,
        version: { increment: 1 },
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
        version: { increment: 1 },
      },
    });

    // === INSERT — стартовая запись в OperationLog ===

    await tx.operationLog.create({
      data: {
        userId,
        type: 'INFO',
        message: renderLogMessage('game_restarted', {}),
      },
    });

    // === INSERT — аудит ===

    await tx.adminAuditLog.create({
      data: {
        type: 'user_restart',
        userId,
        message: `Игрок ${email} выполнил перезапуск игры`,
      },
    });
  });
}
```

**Важные нюансы:**

1. **Порядок операций** — Prisma `$transaction` гарантирует атомарность, но не порядок. Это нормально: каждая операция независима (удаление одних таблиц не зависит от других).

2. **Что если транзакция упала на одной из операций:** ROLLBACK всей транзакции — БД остаётся в консистентном состоянии до restart. Клиенту возвращается 500.

3. **Что если `chatState` или `gameProgress` не существуют:** в норме они создаются при регистрации (`auth.md` → транзакция регистрации). Если их нет — это баг регистрации. UPDATE упадёт с ошибкой → транзакция откатится.

---

## API-эндпоинт

### `POST /api/game/restart`

**Auth:** Player only

**Body:** пустой

**Rate limit:** 3 / мин на userId

**Алгоритм:**
```typescript
// app/api/game/restart/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { restartGame } from '@/lib/game/restart';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST() {
  const session = await auth();
  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Rate limit
  const allowed = checkRateLimit(`game-restart:${userId}`, 3, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
  }

  try {
    await restartGame(userId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[Restart] Failed for user:', userId, e);
    return NextResponse.json({ error: 'RESTART_FAILED' }, { status: 500 });
  }
}
```

**Response 200:**
```json
{ "success": true }
```

**Response 401:** не залогинен или не PLAYER.

**Response 429:** превышен rate limit.

**Response 500:** транзакция откатилась (баг — нужно искать причину в логах).

---

## UI: кнопка и подтверждение

### Кнопка на dashboard

Постоянно видна в одном из углов dashboard. Имеет `data-onboarding-id="restart-button"` для подсветки в онбординге (см. `onboarding.md`).

```tsx
// components/game/restart/RestartGameButton.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RestartConfirmModal } from './RestartConfirmModal';

export function RestartGameButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleConfirm = async () => {
    const res = await fetch('/api/game/restart', { method: 'POST' });
    if (res.ok) {
      setOpen(false);
      router.refresh(); // перезагрузка dashboard с новым (пустым) состоянием
    } else if (res.status === 429) {
      // Показать «Слишком частое нажатие»
    } else {
      // Показать «Ошибка перезапуска, попробуйте позже»
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-onboarding-id="restart-button"
        className="..."
        aria-label="Начать игру заново"
      >
        Начать заново
      </button>
      {open && (
        <RestartConfirmModal
          onConfirm={handleConfirm}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

### Модалка подтверждения

```tsx
// components/game/restart/RestartConfirmModal.tsx
'use client';
import { useState, useEffect } from 'react';

const CONFIRM_DELAY_SECONDS = 5;

export function RestartConfirmModal({ onConfirm, onCancel }: {
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(CONFIRM_DELAY_SECONDS);

  useEffect(() => {
    if (countdown === 0) return;
    const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleConfirm = async () => {
    if (countdown > 0) return;
    setLoading(true);
    await onConfirm();
  };

  const canConfirm = countdown === 0 && !loading;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center">
      <div className="bg-card max-w-md p-6">
        <h2>Начать игру заново?</h2>
        <p>
          <strong>Внимание!</strong> Это действие нельзя отменить. Убедитесь, что
          все игроки за столом знают.
        </p>
        <p>
          Весь ваш прогресс будет потерян: пройденные миссии, история операций,
          диалоги. Учётная запись и пройденный онбординг сохранятся.
        </p>

        <div className="flex gap-3 mt-4">
          <button onClick={onCancel} disabled={loading}>
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={canConfirm ? 'Подтвердить перезапуск' : `Подтвердить (через ${countdown} сек)`}
          >
            {loading
              ? 'Перезапуск...'
              : countdown > 0
                ? `Подтвердить (${countdown})`
                : 'Да, начать заново'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Поведение после успеха:**
- `router.refresh()` — Next.js перезагружает Server Components dashboard
- `chatState`, `gameProgress` — обнулены
- `operationLog` — пустой, кроме новой записи «Игра начата заново»
- Все плашки миссий — в состоянии «не пройдена»
- Кнопка «Финальный отчёт» снова заблокирована

---

## Файлы, которые создаются

```
app/
└── api/
    └── game/
        └── restart/
            └── route.ts                    # POST: перезапуск

components/
└── game/
    └── restart/
        ├── RestartGameButton.tsx           # Client Component, кнопка на dashboard
        └── RestartConfirmModal.tsx         # Client Component, подтверждение

lib/
└── game/
    └── restart.ts                          # restartGame(userId) — основная функция
```

**Изменения в существующих файлах:**
```
components/game/dashboard/DashboardClient.tsx  # добавление <RestartGameButton />
constants/logTemplates.ts                      # уже содержит 'game_restarted'
```

---

## Серверные правила

1. **Транзакция — единая точка истины.** Все DELETE/UPDATE/INSERT в одном `prisma.$transaction([...])`. Никаких отдельных запросов вне транзакции.

2. **`User` НЕ трогается.** Запись пользователя, `onboardingDone`, согласия — всё остаётся.

3. **`AccessKey.currentActivations` НЕ декрементируется.** Защита от обхода лимита.

4. **`AdminAuditLog` пишется обязательно.** Без него support не сможет понять, что произошло у игрока.

5. **Rate limit 3/мин обязателен.** Защита от спама транзакциями.

6. **Глобальный контент НЕ трогается.** `MissionSlot`, `ChatScript`, `ChatTransition`, `FinalReportQuestion`, `FinalReportContent`, `DetectiveHint`, `RdpFile`, `AppSettings` — глобальные таблицы, никаких изменений.

7. **`UserHintProgress` — DELETE, не UPDATE.** Создаётся лениво при первом обращении. См. архитектурное решение 2.

8. **`ChatState` и `GameProgress` — UPDATE, не DELETE.** Они существуют с момента регистрации (FK на User 1:1).

9. **При неудаче транзакции — клиент не видит частичных изменений.** ROLLBACK гарантирует, что игрок останется в прежнем состоянии до момента нажатия «Начать заново». Возвращаем 500.

10. **`router.refresh()` после успеха** — обновляет Server Components без полной перезагрузки страницы. Альтернатива `window.location.reload()` — тоже работает, но грубее.

11. **Никаких side-effects вне транзакции.** Например, `advanceTriggerListeners` не вызывается — потому что чаты только что обнулены, никаких триггеров слушать не должно. То же с email-нотификациями.

12. **Идемпотентность не требуется.** В отличие от `/api/onboarding/complete`, restart можно вызвать сколько угодно раз — каждый раз он реально выполняет транзакцию (просто DELETE на пустых таблицах не сделает ничего, UPDATE на уже обнулённых полях — тоже).

13. **Advisory lock в начале транзакции.** Каждый restart выполняется в `prisma.$transaction(async (tx) => {...})` с первой строкой `await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(${userId}))\``. Защищает от двойного выполнения при параллельных запросах.

14. **UI-таймер 5 сек обязателен.** Кнопка «Подтвердить» в модалке заблокирована первые 5 секунд после открытия. Сервер этим не управляет — это UX-защита. Реализована в `RestartConfirmModal.tsx`.

---

## Связи с другими модулями

- **`database.md`** — модели всех затронутых таблиц описаны там; здесь только применение. Транзакция упомянута в `database.md` → раздел «Критичные транзакции» как пример.
- **`concurrency.md`** — общий паттерн optimistic locking. Restart использует один из его механизмов (advisory lock). UI-таймер описан здесь, в `restart.md`.
- **`auth.md`** — `User`, `AccessKey.currentActivations` — то, что НЕ сбрасывается. `lib/rateLimit.ts` переиспользуется.
- **`onboarding.md`** — `User.onboardingDone` НЕ сбрасывается.
- **`mobile-block.md`** — взаимодействия нет. Модуль `mobile-block` не использует БД и не имеет состояния, которое нужно было бы сбрасывать.
- **`logs.md`** — DELETE всех `OperationLog` + INSERT одного `game_restarted` в одной транзакции.
- **`chats.md`** — UPDATE `ChatState` обнуляет указатели на реплики, `playerChoices`, `finalChoice`, флаги.
- **`hints.md`** — DELETE `UserHintProgress`. При следующем `/api/hints/current` UPSERT создаст новую запись с `lastSeenHintIndex=0`.
- **`missions-crack.md`** — DELETE `CrackSession` + DELETE `MissionProgress`. `MissionProgress.metadata` (включая новые поля `failedSessionsCount`, `skipped`) удаляется через `deleteMany` — игрок получает чистый счётчик попыток после restart.
- **`missions-decipher.md`** — DELETE `MissionProgress` (включая `metadata.lastAttemptCorrect`, `failedAttemptsCount`, `skipped`). `MissionProgress.metadata` удаляется через `deleteMany` — игрок получает чистый счётчик после restart.
- **`missions-rdp.md`** — DELETE `MissionProgress` (включая всю `metadata.puzzleField`, `unlockedFolders`, `triggerActivated`, `skipped`).
- **`final-report.md`** — UPDATE `GameProgress`: `finalReportDone=false`, `finalScore=null`. Можно сдать заново.
- **`admin.md`** — INSERT `AdminAuditLog` с `type: 'user_restart'`. Виден в админском разделе audit-log.
