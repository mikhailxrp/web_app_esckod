# Модуль: История операций (logs)

> Спецификация системы логирования игровых событий, видимой игроку на dashboard.
> Связанные файлы: `.docs/database.md` (модель `OperationLog`), все игровые модули (миссии, чаты, restart, onboarding) пишут через эту утилиту.

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Архитектурные решения](#архитектурные-решения)
3. [Утилита writeLog](#утилита-writelog)
4. [Каталог шаблонов](#каталог-шаблонов)
5. [Подстановка параметров](#подстановка-параметров)
6. [UI на dashboard](#ui-на-dashboard)
7. [API-эндпоинты](#api-эндпоинты)
8. [Файлы, которые создаются](#файлы-которые-создаются)
9. [Серверные правила](#серверные-правила)
10. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Цели модуля

После завершения этого модуля:
- В коде существует единая утилита `lib/operationLog.ts` — все игровые модули пишут логи только через неё
- Все шаблоны сообщений лежат в `constants/logTemplates.ts` — единое место для текстов
- На dashboard постоянно отображается история операций (свежие сверху)
- Игрок видит свои действия в стилистике «терминала / лога взлома»
- Логи **никогда не пишутся клиентом напрямую** — только сервер изнутри игровых эндпоинтов
- При перезапуске игры логи игрока удаляются + добавляется одна стартовая запись

**Не входит в модуль:**
- Сам UI dashboard и его layout (это в общем модуле dashboard)
- Логирование критичных админских действий — это `AdminAuditLog`, отдельная таблица. Пишется в модулях `admin.md` и `restart.md`.
- Серверные runtime-логи (console.error, Sentry и т.п.) — другая система

---

## Архитектурные решения

### 1. Один источник правды для текстов — `constants/logTemplates.ts`

Все шаблоны лежат в одном файле как объект `{templateKey: string}`. Никакого хардкода в эндпоинтах.

```typescript
// constants/logTemplates.ts
export const logTemplates = {
  onboarding_completed: 'Подключение установлено',
  crack_attempt_failed: 'Ошибка доступа: проверьте корректность данных {targetUrl}, {targetEmail}',
  crack_access_granted: 'Доступ к {targetUrl} получен. Логин: {targetEmail}. Пароль: {resultPassword}',
  // ...
} as const;

export type LogTemplateKey = keyof typeof logTemplates;
```

**Почему важно:** заказчик хочет править тексты — мы знаем, где их искать. Опечатка ловится один раз. Если шаблон используется в нескольких местах — изменение в одной точке. Также это упрощает потенциальную локализацию (но мультиязычность out of scope).

### 2. Параметризация через `{паттерн}`

Параметры подставляются по имени, не по позиции:

```typescript
'Доступ к {targetUrl} получен. Пароль: {resultPassword}'
// + params: { targetUrl: 'https://p2.com', resultPassword: 'XYZ123' }
// → 'Доступ к https://p2.com получен. Пароль: XYZ123'
```

**Почему по имени:**
- Понятно при чтении кода: `{targetUrl}` яснее `{0}`
- Безопасно к перестановке параметров в шаблоне без правки вызовов
- TypeScript может проверить полноту параметров (через template literal types в будущем)

### 3. Клиент не имеет публичного API на запись

**Что есть:** `GET /api/logs` — чтение логов текущего игрока.

**Чего нет:** `POST /api/logs` — публичного эндпоинта на запись. Если бы он был, игрок мог бы через DevTools засорять свою историю произвольным контентом или подделывать логи прохождения миссий.

**Кто пишет:** только серверные эндпоинты при реальных событиях (прохождение Crack, ошибка ввода IP в RDP, активация чата Марины и т.д.). Запись делается через `writeLog()`.

### 4. Два уровня логов: технические и обзорные

| Уровень | Что показывает | Пример |
|---|---|---|
| **Технический** | Детали с подстановкой параметров (URL, IP, пароли) | «Доступ к https://p2.com получен. Пароль: XYZ123» |
| **Обзорный** | Высокоуровневое прохождение миссии | «Миссия "Взлом сайта P2 Digital" — пройдена» |

При завершении миссии пишутся **оба** лога подряд: сначала технический («доступ получен + пароль»), потом обзорный («миссия пройдена»). Это даёт игроку и контекст («что я только что получил»), и общее понимание прогресса («сколько миссий пройдено»).

**Технические логи включают также:**
- **Launch-логи** (`crack_launch_failed`, `decipher_launch_failed`) — неудачные попытки запуска через Mission Launcher. Пишутся при несовпадении URL/login или folderPath.
- **Логи разблокировки папок** (`rdp_folder_unlocked`) — пишутся при каждой успешной разблокировке папки в RDP. Содержат путь и пароль — игрок может найти их в истории операций без повторного открытия RDP-окна.

### 5. `LogType` влияет только на UI-стилизацию

Поле `type: SUCCESS | ERROR | INFO` в `OperationLog` нужно, чтобы UI окрашивал записи разным цветом:
- `SUCCESS` — зелёный (доступ получен, миссия пройдена)
- `ERROR` — красный (ошибка ввода, доступ запрещён)
- `INFO` — нейтральный (подключение установлено, игра начата заново)

Никакой логики на стороне сервера от `LogType` не зависит. Это поле для рендера.

### 6. Сортировка — DESC по `createdAt`

Свежие записи сверху. UI отображает массив в порядке `createdAt DESC`. На клиенте при добавлении новой записи (через ре-рендер после успешного API-вызова) — она добавляется в начало массива.

---

## Утилита writeLog

### Сигнатура

```typescript
// lib/operationLog.ts
import { prisma } from '@/lib/prisma';
import { logTemplates, type LogTemplateKey } from '@/constants/logTemplates';
import { LogType } from '@prisma/client';

interface WriteLogOptions {
  userId: string;
  templateKey: LogTemplateKey;
  params?: Record<string, string | number>;
  type: LogType;
}

export async function writeLog(options: WriteLogOptions): Promise<void> {
  const template = logTemplates[options.templateKey];
  if (!template) {
    throw new Error(`Unknown log template: ${options.templateKey}`);
  }

  const message = renderTemplate(template, options.params ?? {});

  await prisma.operationLog.create({
    data: {
      userId: options.userId,
      type: options.type,
      message,
    },
  });
}

function renderTemplate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in params) {
      return String(params[key]);
    }
    // Если параметр не передан — оставляем как есть (явный знак опечатки в коде)
    return match;
  });
}
```

### Использование

```typescript
// Внутри любого серверного эндпоинта
import { writeLog } from '@/lib/operationLog';

await writeLog({
  userId,
  templateKey: 'crack_access_granted',
  params: { targetUrl: 'https://p2.com', targetEmail: 'agent@p2.com', resultPassword: 'XYZ123' },
  type: 'SUCCESS',
});
```

### Множественная запись в транзакции

Если в одном эндпоинте нужно записать несколько логов в транзакции с другими действиями — собираем массив операций для `prisma.$transaction`:

```typescript
// Пример: завершение Crack
const techMessage = renderTemplate(
  logTemplates.crack_access_granted,
  { targetUrl, targetEmail, resultPassword }
);
const overviewMessage = renderTemplate(
  logTemplates.mission_completed_overview,
  { displayName }
);

await prisma.$transaction([
  prisma.missionProgress.upsert({ /* ... */ }),
  prisma.crackSession.delete({ /* ... */ }),
  prisma.operationLog.create({ data: { userId, type: 'SUCCESS', message: techMessage } }),
  prisma.operationLog.create({ data: { userId, type: 'SUCCESS', message: overviewMessage } }),
]);
```

**Почему не вызывать `writeLog()` дважды после транзакции:** если транзакция упадёт, логи всё равно запишутся — это создаст неконсистентность. Внутри `$transaction` — атомарно.

`renderTemplate` экспортируется отдельно для таких случаев:

```typescript
// lib/operationLog.ts (дополнение)
export function renderLogMessage(templateKey: LogTemplateKey, params: Record<string, string | number> = {}): string {
  const template = logTemplates[templateKey];
  if (!template) throw new Error(`Unknown log template: ${templateKey}`);
  return renderTemplate(template, params);
}
```

---

## Каталог шаблонов

Все ключи именуются `<контекст>_<событие>`. Группы:

### Онбординг
| Ключ | Шаблон | Type | Параметры |
|---|---|---|---|
| `onboarding_completed` | Подключение установлено | INFO | — |

### Crack (взлом сайта)
| Ключ | Шаблон | Type | Параметры |
|---|---|---|---|
| `crack_launch_failed` | Ошибка доступа к сайту {targetUrl} с логином {targetEmail} | ERROR | targetUrl, targetEmail |
| `crack_attempt_failed` | Ошибка доступа: проверьте корректность данных {targetUrl}, {targetEmail} | ERROR | targetUrl, targetEmail |
| `crack_access_granted` | Доступ к {targetUrl} получен. Логин: {targetEmail}. Пароль: {resultPassword} | SUCCESS | targetUrl, targetEmail, resultPassword |

### Decipher (дешифратор)
| Ключ | Шаблон | Type | Параметры |
|---|---|---|---|
| `decipher_launch_failed` | Не удалось расшифровать путь к папке: {folderPath} | ERROR | folderPath |
| `decipher_access_granted` | Папка {folderPath} расшифрована. Пароль: {folderPassword} | SUCCESS | folderPath, folderPassword |

> **Примечание:** промежуточные неудачные попытки расшифровки **не логируются** — игрок видит ошибку прямо в UI. Это симметрично с миссией Crack. См. `missions-decipher.md` → архитектурное решение 7.

### RDP (удалённый доступ)
| Ключ | Шаблон | Type | Параметры |
|---|---|---|---|
| `rdp_invalid_ip` | Неверный IP-адрес: {ip} | ERROR | ip |
| `rdp_puzzle_solved` | Доступ к удалённому компьютеру ({logSubjectName}) предоставлен | SUCCESS | logSubjectName |
| `rdp_timer_expired` | Сеанс прерван: соединение разорвано | ERROR | — |
| `rdp_session_lost` | Доступ к {logSubjectName} потерян: обнаружено два активных сеанса. Новый IP: {nextIp} | ERROR | logSubjectName, nextIp |
| `rdp_folder_unlocked` | Папка {folderPath} в системе {logSubjectName} разблокирована. Пароль: {folderPassword} | SUCCESS | folderPath, folderPassword, logSubjectName |
| `rdp_completed` | Изучение материалов завершено | SUCCESS | — |

### Финальный отчёт
| Ключ | Шаблон | Type | Параметры |
|---|---|---|---|
| `final_report_submitted` | Финальный отчёт сдан. Результат: {percent}% | SUCCESS | percent |

### Обзорные (после прохождения миссии)
| Ключ | Шаблон | Type | Параметры |
|---|---|---|---|
| `mission_completed_overview` | Миссия "{displayName}" — пройдена | SUCCESS | displayName |

### Перезапуск игры
| Ключ | Шаблон | Type | Параметры |
|---|---|---|---|
| `game_restarted` | Игра начата заново | INFO | — |

### Админские коррекции (с префиксом `[admin]`)
| Ключ | Шаблон | Type | Параметры |
|---|---|---|---|
| `admin_progress_reset` | [admin] Прогресс по миссии "{displayName}" сброшен | INFO | displayName |
| `admin_mission_completed` | [admin] Миссия "{displayName}" отмечена как пройденная | INFO | displayName |

**Префикс `[admin]`** — визуальный маркер для игрока, что событие инициировано админом, а не его собственным действием. Пишется при ручных коррекциях прогресса в админке.

### Чаты

Чаты **не пишут в OperationLog**. Все события чатов отражаются в самом интерфейсе чата (новые реплики, выбор игрока). Если в будущем заказчик попросит — добавим, но на старте — нет.

---

## Подстановка параметров

### Ключевые правила

1. **Все ключи параметров — на английском, snake_case**: `targetUrl`, `resultPassword`, `displayName`. Не использовать русские имена.

2. **Параметры передаются как строки или числа**. Boolean, null, undefined — недопустимы. Если в БД хранится null (`MissionSlot.targetEmail = null`) — на уровне эндпоинта это обрабатывается до вызова `writeLog`:
   ```typescript
   await writeLog({
     userId,
     templateKey: 'crack_attempt_failed',
     params: {
       targetUrl: slot.targetUrl ?? '—',
       targetEmail: slot.targetEmail ?? '—',
     },
     type: 'ERROR',
   });
   ```

3. **`displayName` для обзорных логов — обязательно из `MissionSlot.displayName`**:
   ```typescript
   await writeLog({
     userId,
     templateKey: 'mission_completed_overview',
     params: { displayName: slot.displayName },
     type: 'SUCCESS',
   });
   ```
   Это даёт согласованность с админкой — игрок и админ видят одинаковое имя миссии.

4. **`logSubjectName` для RDP — из `MissionSlot.logSubjectName`**. Это поле специально создано для RDP-логов с упоминанием персонажа. Для CRACK/DECIPHER оно `null`.

5. **Чувствительные параметры (пароли) — пишутся в логи открыто**. Это **намеренно** — игра про взлом, пароли являются частью игрового опыта (игрок копирует их из логов). НЕ путать с реальной безопасностью: `resultPassword` — это игровой пароль к стороннему сайту, который заказчик настроил под игру. Хэши паролей пользователей `User.passwordHash` в логи **никогда не попадают**.

### Пропущенный параметр — заметная ошибка

Если в шаблоне `{targetUrl}`, а в `params` его нет — текст будет содержать `{targetUrl}` в открытом виде. Это **намеренно**: при ручной проверке такая запись сразу видна и отлавливается до релиза.

```typescript
// renderTemplate возвращает: 'Доступ к {targetUrl} получен. Пароль: XYZ123'
// если 'targetUrl' пропущен в params
```

Альтернатива (выкидывать ошибку 500) — хуже, потому что роняет завершение миссии из-за плохого лога.

---

## UI на dashboard

### Размещение

Постоянно видимый блок внизу dashboard, занимающий нижнюю треть/половину экрана. Скроллится внутри своего контейнера, не толкая основной контент.

### Стилистика

«Хакерский терминал»:
- Моноширинный шрифт (например, JetBrains Mono)
- Тёмный фон, светло-зелёный/жёлтый/красный текст в зависимости от `type`
- Каждая запись — отдельная строка, формат `[ЧЧ:ММ] сообщение`
- Время рендерится на клиенте через `Intl.DateTimeFormat` или `date-fns/format` — НЕ хранится в БД, рассчитывается из `createdAt`

### Цвета по `LogType`

| LogType | Цвет (концептуально) | Пример |
|---|---|---|
| `SUCCESS` | Светло-зелёный | `--accent-success` |
| `ERROR` | Красный | `--accent-error` |
| `INFO` | Светло-серый/жёлтый | `--text-secondary` |

Цвета верстаются на Tailwind по ходу фазы.

### Обновление в реальном времени

После любого серверного действия, которое пишет в логи (например, ответ `POST /api/missions/crack/[slotKey]/attempt`), клиент:
1. Получает ответ от эндпоинта
2. Дёргает `GET /api/logs` для получения свежего списка
3. Обновляет state через Zustand (`logStore`)

**Альтернатива через WebSocket** — overkill для нашего проекта (real-time нет, события генерируются только в ответ на действия игрока).

**Оптимизация:** в ответ некоторых эндпоинтов можно сразу включить новые логи (`POST /api/missions/crack/[slotKey]/complete` возвращает `{ success: true, logs: [...] }`) — тогда отдельный GET не нужен. Это решается per-эндпоинт в их модулях.

---

## API-эндпоинты

### `GET /api/logs`

**Auth:** Player only (`session.user.type === 'PLAYER'`)

**Query parameters:**
- `limit?: number` — максимальное число записей (default 100, max 500)

**Алгоритм:**
```typescript
// app/api/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);

  const logs = await prisma.operationLog.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ logs });
}
```

**Response 200:**
```json
{
  "logs": [
    {
      "id": "clx...",
      "type": "SUCCESS",
      "message": "Доступ к https://p2.com получен. Пароль: XYZ123",
      "createdAt": "2026-05-08T14:30:00.000Z"
    },
    ...
  ]
}
```

**Response 401:** если нет сессии или роль не PLAYER.

**Rate limit:** не нужен — игрок может дёргать этот эндпоинт часто (после каждого действия), это нормально.

### `POST /api/logs` — НЕ СУЩЕСТВУЕТ

**Намеренно отсутствует.** Запись логов — только серверная, изнутри игровых эндпоинтов. Если разработчик попытается создать `POST /api/logs/route.ts` — это нарушение архитектуры.

---

## Файлы, которые создаются

```
app/
└── api/
    └── logs/
        └── route.ts                       # GET: чтение логов

components/
└── game/
    └── operation-log/
        ├── OperationHistory.tsx           # Client Component, рендер списка
        ├── LogEntry.tsx                   # Client Component, одна строка лога
        └── LogTypeBadge.tsx               # Цветовая индикация по type (опционально)

lib/
├── operationLog.ts                        # writeLog(), renderLogMessage()

constants/
└── logTemplates.ts                        # Все шаблоны + типы

store/
└── logStore.ts                            # Zustand: { logs, addLogs, setLogs, refresh }
```

**Изменения в существующих файлах:** нет.

---

## Серверные правила

1. **`writeLog()` — единая точка записи.** Любой эндпоинт, которому нужно писать в логи — импортирует `writeLog` из `lib/operationLog.ts`. Прямые `prisma.operationLog.create({...})` вне утилиты допустимы только внутри транзакций (см. секцию «Утилита writeLog → Множественная запись в транзакции»).

2. **Все шаблоны — в `constants/logTemplates.ts`**. Никакого хардкода строк сообщений в эндпоинтах. Это **архитектурное правило**, нарушение фиксируется в DoD таска.

3. **`POST /api/logs` не создавать.** Если разработчик вдруг создаст этот файл — это нарушение, удалить при ревью.

4. **`type` обязателен**. Не использовать default-значение. Эндпоинт явно указывает `'SUCCESS' | 'ERROR' | 'INFO'`.

5. **Параметры подставляются через `renderTemplate` или `writeLog`**. Не использовать обычный template literal со строкой — это нарушает принцип единого источника шаблонов:
   ```typescript
   // ❌ НЕЛЬЗЯ:
   await prisma.operationLog.create({
     data: { userId, type: 'SUCCESS', message: `Доступ к ${url} получен` }
   });

   // ✅ МОЖНО:
   await writeLog({ userId, templateKey: 'crack_access_granted', params: { targetUrl: url, targetEmail: email, resultPassword: pwd }, type: 'SUCCESS' });
   ```

6. **Лог пишется только при реальном событии.** Не писать «спекулятивно» (например, при загрузке страницы миссии — записать «Игрок открыл миссию X»). Логи должны соответствовать действиям игрока, отражённым в результатах эндпоинтов.

7. **При перезапуске игры:**
   - DELETE всех логов игрока через `prisma.operationLog.deleteMany({ where: { userId } })`
   - INSERT одной записи `game_restarted` через тот же транзакционный блок (см. `restart.md` → Критичная транзакция)

8. **Промежуточные ошибки в Crack не логируются.** Попытки 1..N не пишутся в логи (их фиксирует только `CrackSession.attempts`). Пишется только итог финальной попытки при провале N+1 (`crack_attempt_failed`, где N = `CrackSession.maxAttempts`) и финал при успехе (`crack_access_granted`). См. `missions-crack.md`.

9. **Никогда не логировать:** `passwordHash` пользователей, JWT-токены, sensitive admin-данные. Игровые пароли (`MissionSlot.resultPassword`, `folderPassword`) — намеренно логируются (часть геймплея).

10. **Лимит размера сообщения**: на уровне БД `message: String` — без явного лимита. На уровне приложения шаблоны короткие (до 200 символов). Если параметр будет огромный — это аномалия данных, ловится при ручной проверке.

---

## Связи с другими модулями

- **`onboarding.md`** — пишет `onboarding_completed` после успешного `POST /api/onboarding/complete`.
- **`missions-crack.md`** — пишет `crack_launch_failed` при неудачной попытке запуска через Mission Launcher, `crack_attempt_failed`, `crack_access_granted`, `mission_completed_overview`.
- **`missions-decipher.md`** — пишет `decipher_launch_failed` при неудачной попытке запуска, `decipher_access_granted`, `mission_completed_overview`. Промежуточные неудачные попытки расшифровки в логи НЕ пишутся (игрок видит ошибку в UI).
- **`missions-rdp.md`** — пишет `rdp_invalid_ip`, `rdp_puzzle_solved`, `rdp_timer_expired`, `rdp_session_lost` (расширен параметром `nextIp`), `rdp_folder_unlocked` (при разблокировке папки), `rdp_completed`, `mission_completed_overview`.
- **`final-report.md`** — пишет `final_report_submitted` после успешной сдачи отчёта.
- **`restart.md`** — DELETE всех логов + INSERT `game_restarted` в одной транзакции.
- **`admin.md`** — при админских коррекциях прогресса пишет `admin_progress_reset` или `admin_mission_completed` в логи затронутого игрока.
- **`database.md`** — модель `OperationLog` описана там; здесь только применение.
- **`mobile-block.md`** — НЕ пишет в логи. Заглушка — статическое UI-событие без серверного состояния.
- **`chats.md`** — НЕ пишет в логи. События чатов отражаются в интерфейсе чата.
