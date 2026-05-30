# Модуль: Админ-панель (admin)

> Зонтичный модуль для всей админ-зоны приложения. Включает 10 подразделов: управление ключами, пользователями, администраторами, настройками, слотами миссий, чатами, файлами RDP, финальным отчётом, подсказками Детектива и аудит-логом.
> Связанные файлы: все остальные модули (admin часто их продолжает с админской стороны).

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Архитектурные решения](#архитектурные-решения)
3. [Общая структура админки](#общая-структура-админки)
4. [Конвенция имён в Beget Cloud Storage](#конвенция-имён-в-beget-cloud-storage)
5. [Подраздел: Ключи доступа](#подраздел-ключи-доступа)
6. [Подраздел: Пользователи](#подраздел-пользователи)
7. [Подраздел: Администраторы](#подраздел-администраторы)
8. [Подраздел: Глобальные настройки](#подраздел-глобальные-настройки)
9. [Подраздел: Слоты миссий](#подраздел-слоты-миссий)
10. [Подраздел: Чаты (граф диалога)](#подраздел-чаты-граф-диалога)
11. [Подраздел: Файлы RDP](#подраздел-файлы-rdp)
12. [Подраздел: Финальный отчёт](#подраздел-финальный-отчёт)
13. [Подраздел: Подсказки Детектива](#подраздел-подсказки-детектива)
14. [Подраздел: Аудит-лог](#подраздел-аудит-лог)
15. [Файлы, которые создаются](#файлы-которые-создаются)
16. [Серверные правила](#серверные-правила)
17. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Цели модуля

После завершения этого модуля:
- Админ заходит на `/admin-login`, входит в админ-зону
- Видит навигацию по 10 разделам
- В каждом разделе — CRUD соответствующих сущностей
- Все деструктивные действия логируются в `AdminAuditLog`
- Админка имеет защиты от опасных действий (удаление последнего админа, удаление слота с активным прогрессом и т.п.)
- Админка показывает баннеры-предупреждения о неконсистентной конфигурации (заглушки в проде, расхождение в FinalReportContent)

**Не входит в модуль:**
- Логин и сессия админа — это в `auth.md`
- Логика игровых эндпоинтов — это в соответствующих модулях. Здесь только CRUD контента.
- Аналитика прохождения, статистика — out of scope (см. PRD)

---

## Архитектурные решения

### 1. Зонтичный модуль с подразделами

Все админские функции описываются в одном модуле. Альтернатива — 10 отдельных модулей (`admin-keys.md`, `admin-users.md`, ...). Выбираем зонтик потому что:
- Подразделы небольшие (200-400 строк каждый)
- Общая навигация и защиты — описываются один раз
- Связи между подразделами (например, валидатор chats → report) удобнее в одном файле
- Один модуль с оглавлением проще искать, чем 10 отдельных

### 2. Префиксы эндпоинтов

Все админские эндпоинты живут под `/api/admin/*`. Внутри `proxy.ts` — отдельная ветка проверки `session.user.type === 'ADMIN'`. Каждый эндпоинт **дополнительно** проверяет роль (defense in depth):

```typescript
const session = await auth();
if (!session || session.user.type !== 'ADMIN') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### 3. Зеркалирование UI ↔ API

Каждой странице `app/(admin)/admin/<фича>/` соответствует:
- Набор эндпоинтов `app/api/admin/<фича>/*`
- Папка компонентов `components/admin/<фича>/*`

Это упрощает навигацию по коду — разработчик ищет «всё про ключи» в трёх параллельных местах.

### 4. Защиты от опасных действий

Удаление контента, который **используется** игроками — отдельная категория защит. Универсальный паттерн:

| Действие | Защита |
|---|---|
| DELETE админа | Запрет удаления самого себя + запрет удаления последнего |
| DELETE слота миссии | Запрет если есть активные `CrackSession` (правильное действие — `isActive=false`) |
| DELETE чат-реплики | Каскад на `ChatTransition`, `ChatState.currentMessageId → null`, предупреждение «N игроков сейчас на этой реплике» |
| DELETE подсказки | Без каскада, удалённая просто пропускается алгоритмом findFirst |
| DELETE вопроса отчёта | Если игрок сдал отчёт раньше — `correctCount` в `/result` будет неточным (см. `final-report.md`) |
| DELETE контента концовки (FinalReportContent) | Предупреждение «N игроков с finalChoice=X сделают /submit и получат ошибку». При таком расхождении — баннер в админке. |
| DELETE ключа | Если есть пользователи — запрет (правильное действие — `isBlocked=true`) |

### 5. CSV для bulk-операций

Где есть много элементов — CSV-импорт/экспорт:
- Ключи: импорт списка ключей при подготовке коробок
- Пользователи: экспорт email для рассылок (заказчик сам делает рассылку — у нас email-рассылки out of scope)

### 6. Аудит критичных действий

В `AdminAuditLog` пишутся:
- `admin_created`, `admin_deleted` — изменения админов
- `mission_slot_deleted`, `mission_slot_reactivated` — изменения слотов
- `hint_deleted` — удаление подсказок
- `key_blocked`, `key_unblocked` — блокировка ключей
- `user_blocked`, `user_unblocked` — блокировка игроков
- `user_progress_reset_by_admin` — админ ручную сбросил прогресс игрока
- `user_restart` — игрок сам перезапустил (см. `restart.md`)

Не пишутся (рутинные действия): редактирование текстов, добавление контента, изменение настроек слотов.

### 7. Server Components для админки

Страницы `/admin/*` — Server Components, дёргают данные через Prisma напрямую (не через fetch к собственному API). Это **исключение** из общего правила «всё через API»:

**Почему:**
- Внутри admin-зоны нет публичного клиента — данные нужны только админу
- SSR ускоряет первый рендер
- Меньше дублирования кода (запрос в БД vs fetch + GET handler)

**Когда всё же нужен API:**
- Мутации (POST, PATCH, DELETE) — через API Routes
- Динамическая фильтрация и поиск, который Server Component не может сделать без перерендера всей страницы

---

## Общая структура админки

### Защита роутов

```
/admin               → главная (статистика, навигация)
/admin/keys          → управление ключами
/admin/users         → управление пользователями
/admin/admins        → управление администраторами
/admin/settings      → глобальные настройки
/admin/mission-slots → слоты миссий
/admin/chats         → граф диалогов
/admin/files         → файлы RDP
/admin/report        → финальный отчёт
/admin/hints         → подсказки Детектива
/admin/audit-log     → аудит-лог
```

Все защищены через `proxy.ts` — `session.user.type === 'ADMIN'`. См. `auth.md`.

### Layout `/admin/*`

```tsx
// app/(admin)/admin/layout.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin/layout/AdminNav';
import { AdminBanners } from '@/components/admin/layout/AdminBanners';

export default async function AdminLayout({ children }) {
  const session = await auth();
  if (!session || session.user.type !== 'ADMIN') redirect('/admin-login');

  return (
    <div className="flex">
      <AdminNav />
      <main className="flex-1 p-6">
        <AdminBanners />
        {children}
      </main>
    </div>
  );
}
```

### `AdminBanners` — глобальные предупреждения

Server Component, дёргает несколько проверок:
1. Есть ли заглушки в `AppSettings` (`example.com` в `supportEmail` или `privacyPolicyUrl`)
2. Валидатор связности chats ↔ report (см. `final-report.md`)
3. Есть ли необработанные ошибки в системе (опционально, на старте не делаем)

Каждый баннер — кликабельная карточка, ведёт в соответствующий раздел админки.

---

## Конвенция имён в Beget Cloud Storage

Чтобы избежать каши в S3-бакете, договариваемся о структуре имён ключей (object keys):

```
audio/chat/{chatScriptId}/{filename}     # Аудио реплик чата (DETECTIVE и MARINA)
pdf/rdp/{slotKey}/{folderName}/{filename}  # PDF файлов RDP-симуляции
```

**Примеры:**
- `audio/chat/clx1abc/intro.mp3`
- `audio/chat/clx2def/marina_greeting.mp3`
- `pdf/rdp/RDP_VICTOR/Архив/contract.pdf`
- `pdf/rdp/RDP_MARINA/Маркова/diary.pdf`

**Правила:**
- `chatScriptId` — CUID реплики из `ChatScript.id`. Гарантирует уникальность.
- `slotKey` — машинный код слота (`RDP_VICTOR`, `RDP_MARINA`, ...).
- `folderName` — поле `RdpFile.folder` как есть. Если в имени пробелы и кириллица — допускается (URL encoding на стороне клиента S3).
- `filename` — оригинальное имя файла, отправленного админом, в lowercase + замена пробелов на `_`.

**При удалении объекта в БД** (например, `RdpFile`) сервер должен удалить и объект из S3. Это **не каскад на уровне БД** — сервер вручную в `DELETE` эндпоинте делает запрос к S3.

**Защита от попадания мусора:** при загрузке нового файла сервер проверяет `Content-Type` и расширение. Допустимые типы:
- Аудио: `audio/mpeg`, `audio/wav`, `audio/mp3`
- PDF: `application/pdf`

Что-то ещё — 400 `INVALID_FILE_TYPE`.

---

## Подраздел: Ключи доступа

### Цель

Заказчик готовит N коробок с уникальными ключами. Через админку загружает CSV со списком ключей, может позже редактировать `maxActivations`, блокировать ключи, видеть статистику использования.

### UI: страница `/admin/keys`

Server Component с таблицей всех ключей. Колонки:
- Ключ (mono font)
- Активаций (current / max)
- Статус (Активен / Заблокирован)
- Дата создания
- Действия (Редактировать, Заблокировать, Удалить)

Над таблицей — кнопки:
- «Создать ключ» — единичное создание
- «Импорт CSV» — массовая загрузка
- «Экспорт CSV» — выгрузка всех ключей (для администратора заказчика)

Поиск и фильтрация: по подстроке в ключе, по статусу.

### API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/admin/keys` | Список ключей (с пагинацией, фильтром) |
| POST | `/api/admin/keys` | Создать новый ключ |
| POST | `/api/admin/keys/import` | Импорт CSV |
| GET | `/api/admin/keys/export` | Экспорт CSV |
| GET | `/api/admin/keys/[id]` | Детали ключа |
| PATCH | `/api/admin/keys/[id]` | Изменить (maxActivations, isBlocked) |
| DELETE | `/api/admin/keys/[id]` | Удалить (с защитой) |

### Защиты

1. **DELETE** запрещён, если у ключа есть пользователи (`accessKey.users.length > 0`). Правильное действие — `isBlocked=true`.

2. **PATCH `maxActivations`** — новое значение **не может быть меньше `currentActivations`**. Проверка в Zod / handler.

3. **POST с уже существующим `key`** — 400 `KEY_EXISTS` (UNIQUE на схеме).

4. **CSV формат** — простой:
   ```
   key,maxActivations
   ABC-123-XYZ,5
   DEF-456-UVW,3
   ```
   Если `maxActivations` не указан — default 5.

5. **При блокировке ключа** — пишется `AdminAuditLog` тип `key_blocked` + причина `blockReason` (опциональное поле).

6. **При блокировке ключа** активные пользователи **не разлогиниваются мгновенно** — но при следующем логине (или JWT-протухании через 24ч) увидят ошибку «KEY_BLOCKED» (см. `auth.md`).

---

## Подраздел: Пользователи

### Цель

Просмотр списка зарегистрированных игроков, бан/разбан, ручная коррекция прогресса (для support-кейсов), удаление аккаунта.

### UI: страница `/admin/users`

Таблица с колонками:
- Email, Name
- Ключ доступа (по которому регистрировались)
- Создан
- Статус (Активен / Заблокирован)
- Прогресс (краткая сводка: 3/6 миссий пройдено, чат Марины активен)
- Действия (Состояние, Сбросить миссию, Заблокировать, Удалить)

Над таблицей:
- Поиск по email/name
- Фильтр по `isBlocked`
- Кнопка «Экспорт email в CSV» (для рассылки от заказчика)

### API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/admin/users` | Список с пагинацией |
| GET | `/api/admin/users/export` | Экспорт email-list в CSV |
| GET | `/api/admin/users/[id]` | Детали пользователя |
| GET | `/api/admin/users/[id]/state` | Полный игровой state (для отладки) |
| PATCH | `/api/admin/users/[id]` | Изменить (isBlocked) |
| DELETE | `/api/admin/users/[id]` | Удалить аккаунт |
| POST | `/api/admin/users/[id]/reset-mission` | Сбросить конкретную миссию ⚠️ Отложено до Фазы 10+ — заглушка в `app/api/admin/users/[id]/reset-mission/route.ts` |
| POST | `/api/admin/users/[id]/complete-mission` | Принудительно отметить миссию пройденной ⚠️ Отложено до Фазы 10+ — заглушка в `app/api/admin/users/[id]/complete-mission/route.ts` |

### `GET /api/admin/users/[id]/state` — полный snapshot

Используется для отладки support-кейсов. Возвращает **всю** информацию об игроке в одном объекте:

**Response 200:**
```json
{
  "user": {
    "id": "clx...",
    "email": "...",
    "name": "...",
    "isBlocked": false,
    "onboardingDone": true,
    "consentMarketing": false,
    "consentPolicy": true,
    "createdAt": "2026-05-01T...",
    "accessKey": { "key": "ABC-123", "isBlocked": false }
  },
  "gameProgress": {
    "marinaTriggered": true,
    "finalReportDone": false,
    "finalScore": null
  },
  "chatState": {
    "currentDetectiveMessage": { "code": "...", "text": "..." },
    "currentMarinaMessage": null,
    "playerChoices": { "marina_intro": "PROTECT" },
    "finalChoice": "PROTECT",
    "detectiveFinished": false,
    "marinaFinished": false
  },
  "missionProgress": [
    { "slotKey": "CRACK_P2", "completed": true, "completedAt": "...", "metadata": null },
    { "slotKey": "RDP_VICTOR", "completed": false, "metadata": { "puzzleSolved": true } }
  ],
  "crackSessions": [
    { "slotKey": "CRACK_VUZ", "attemptsUsed": 2, "maxAttempts": 6 }
  ],
  "hintProgress": { "lastSeenHintIndex": 3 },
  "logsCount": 47,
  "recentLogs": [ /* последние 10 логов */ ]
}
```

**Auth:** только Admin.

**Никогда не возвращается:** `passwordHash`, `targetWord` (для активных Crack-сессий), `correctOption` (вопросов отчёта).

### Защиты

1. **DELETE User** — каскадно удаляет всё (через `onDelete: Cascade` в Prisma). `AccessKey.currentActivations` НЕ декрементируется (защита от обхода лимита).

2. **POST reset-mission** — удаляет `MissionProgress` + `CrackSession` для конкретного слота. Пишет в `OperationLog` игрока шаблон `admin_progress_reset` с префиксом `[admin]`. Пишет в `AdminAuditLog`.

3. **POST complete-mission** — UPSERT `MissionProgress(completed=true)`. Пишет лог `admin_mission_completed` с префиксом `[admin]`. Пишет аудит. **НЕ вызывает** `advanceTriggerListeners` (триггеры чата для админских коррекций — отдельный вопрос, на старте не дёргаем).

4. **PATCH isBlocked=true** — игрок не разлогинивается мгновенно. При следующем логине увидит `USER_BLOCKED`.

5. **Экспорт email** — формат `user1@example.com\nuser2@example.com\n...`. Только email, без других полей (защита персональных данных).

---

## Подраздел: Администраторы

### Цель

CRUD администраторов. Самый защищённый раздел — нельзя случайно потерять доступ к системе.

### UI: страница `/admin/admins`

Простая таблица:
- Email
- Создан, Последний логин
- Действия (Сменить пароль, Удалить)

Над таблицей — кнопка «Добавить администратора».

### API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/admin/admins` | Список администраторов |
| POST | `/api/admin/admins` | Создать админа (с генерацией пароля) |
| DELETE | `/api/admin/admins/[id]` | Удалить (с защитами) |
| PATCH | `/api/admin/admins/[id]/password` | Сменить пароль |
| GET | `/api/admin/admins/[id]/audit-logs` | История операций администратора (пагинация + поиск) |

### `GET /api/admin/admins/[id]/audit-logs`

Возвращает записи `AdminAuditLog`, где `adminId === id` (действия, выполненные этим администратором).

**Query-параметры:**
```typescript
const querySchema = z.object({
  cursor: z.string().cuid().optional(), // cursor-based пагинация (id последней записи)
  search: z.string().max(100).optional(), // поиск по полю message (ILIKE)
});
```

**Response 200:**
```json
{
  "logs": [
    { "id": "clx...", "type": "admin_created", "message": "...", "createdAt": "..." }
  ],
  "nextCursor": "clx..." // null если записей больше нет
}
```

**Лимит:** 20 записей на страницу. Сортировка: `createdAt desc`.

### Защиты

1. **DELETE** запрещено, если `id === session.user.id` — нельзя удалить самого себя.

2. **DELETE** запрещено, если в БД остался **только один админ** — нельзя удалить последнего.

3. **POST** создаёт нового админа с **сгенерированным паролем** (`generatePassword(12)`). Пароль возвращается **в ответе POST один раз** — админ-родитель должен передать его новому админу. После первого ответа пароль больше нигде нет (только bcrypt-хэш в БД).

4. **PATCH /password** — генерирует новый пароль (как при reset-password игрока), возвращает в ответе один раз.

5. **Никаких email-уведомлений** при создании/удалении админов. Передача пароля — устно/через защищённый канал.

6. **Аудит:** `admin_created`, `admin_deleted`, `admin_password_changed`.

### Реализация защит DELETE

```typescript
async function deleteAdmin(adminId: string, currentAdminId: string) {
  if (adminId === currentAdminId) return error(400, 'CANNOT_DELETE_SELF');

  const totalCount = await prisma.adminUser.count();
  if (totalCount <= 1) return error(400, 'CANNOT_DELETE_LAST_ADMIN');

  await prisma.$transaction([
    prisma.adminUser.delete({ where: { id: adminId } }),
    prisma.adminAuditLog.create({
      data: {
        type: 'admin_deleted',
        adminId: currentAdminId,
        message: `Админ ${currentAdminEmail} удалил админа ${deletedAdminEmail}`,
      },
    }),
  ]);

  return { success: true };
}
```

---

## Подраздел: Глобальные настройки

См. отдельный модуль `app-settings.md`.

UI и эндпоинты описаны там. В навигации админки — пункт `/admin/settings`.

Краткое напоминание:
- `GET/PATCH /api/admin/app-settings`
- 3 поля: `defaultMarketingConsent`, `supportEmail`, `privacyPolicyUrl`
- Баннер при заглушках, модалка при `defaultMarketingConsent=true`

---

## Подраздел: Слоты миссий

### Цель

CRUD слотов миссий (CRACK, DECIPHER, RDP). Создание визардом по типу миссии, редактирование контента, мягкое отключение, удаление с защитой.

### UI: страница `/admin/mission-slots`

Список слотов в табличном виде с фильтрами по `missionType` и `isActive`. Колонки:
- `slotKey`, `displayName`
- Тип
- `orderIndex`
- Статус (Активен / Отключён)
- Прохождений (число игроков с `completed=true`)
- Действия (Редактировать, Toggle isActive, Удалить)

Над таблицей — кнопка «Создать слот» (визард).

### Визард создания

Шаг 1: тип миссии (CRACK / DECIPHER / RDP)
Шаг 2: общие поля (`slotKey`, `displayName`, `orderIndex`, `hintText`)
Шаг 3: специфичные поля (зависят от типа):
- CRACK: `targetWord`, `targetUrl`, `targetEmail`, `resultPassword`, `crackMaxAttempts`
- DECIPHER: `cipherType`, `encryptedWord`, `cipherKey`, `folderPassword`, `folderPath`, `unlocksRdpFolder`, `unlocksRdpSlotKey`
- RDP: `correctIp`, `rdpScenario`, `timerSeconds`, `rdpPuzzleGridSize`, `logSubjectName`, `nextRdpSlotKey` (для сценария 1: выпадающий список активных RDP-слотов)

### API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/admin/mission-slots` | Список с фильтрами |
| GET | `/api/admin/mission-slots/[id]` | Детали слота |
| POST | `/api/admin/mission-slots` | Создание |
| PATCH | `/api/admin/mission-slots/[id]` | Редактирование |
| DELETE | `/api/admin/mission-slots/[id]` | Удаление (с защитами) |
| PATCH | `/api/admin/mission-slots/[id]/toggle-active` | Включить/выключить |

### Защиты

1. **PATCH запрещает изменение `slotKey`** — это машинный код, по нему ищут активные сессии и логи. Изменение сломает данные.

2. **PATCH запрещает изменение `missionType`** — миссия CRACK не может стать RDP без потери всех связанных данных.

3. **DELETE запрещён, если есть активные `CrackSession` для этого слота** — иначе сессии останутся «висеть» с отсутствующим slotId. Правильное действие — `isActive=false`.

4. **DELETE возможен**, если миссия не использовалась (нет `MissionProgress` и `CrackSession`). Каскад на `RdpFile` (для RDP-слотов) — настроен в схеме.

5. **DELETE с активными `MissionProgress` (completed=true)**: разрешено, но с предупреждением «N игроков пройдут эту миссию заново при следующем входе» — на самом деле нет, потому что `MissionProgress` тоже удалится через каскад. Решение: при DELETE слота с прохождениями — спрашивать «Вы уверены? N игроков потеряют прогресс по этой миссии».

6. **Валидация полей при POST/PATCH** — Zod-схема per-`missionType`:
   - CRACK: `targetWord` ровно 5 символов, `crackMaxAttempts` 3..10
   - DECIPHER: `cipherType` enum, `encryptedWord` непустой, `cipherKey` непустой
   - RDP: `correctIp` валидный IP, `rdpScenario` 1 или 2, `timerSeconds` 30..600, `rdpPuzzleGridSize` 6 или 7

7. **Аудит** при DELETE: `mission_slot_deleted` с `slotKey` и `displayName`.

8. **Валидация связности RDP ↔ Decipher при сохранении Decipher-слота:** при создании или редактировании Decipher-слота с заполненными `unlocksRdpFolder` и `unlocksRdpSlotKey` — админка проверяет:
   1. Существует активный `MissionSlot` с `slotKey === unlocksRdpSlotKey` и `missionType === 'RDP'`
   2. В этом RDP-слоте существует `RdpFile` с `folder === unlocksRdpFolder` и `isLocked === true`

   Если хотя бы одно условие не выполнено — показать баннер-предупреждение «Папка `<unlocksRdpFolder>` не найдена в RDP-слоте `<unlocksRdpSlotKey>` или не помечена как запароленная. Разблокировка через этот пароль не сработает». **Не блокирует сохранение** — админ может создавать Decipher-слот заранее, до создания RDP-контента. Но баннер обязателен.

9. **Валидация Плейфера — запрет букв Ю/Я:** при создании или редактировании Decipher-слота с `cipherType === 'PLAYFAIR'` админка проверяет, что `encryptedWord` и `cipherKey` не содержат буквы `Ю` или `Я`. Если содержат — показать предупреждение «Шифр Плейфера: буквы Ю и Я могут вызвать ошибку при расшифровке (попадание на пустую ячейку таблицы 6×6)». **Не блокирует сохранение** — заказчик может намеренно не использовать эти буквы в словах, но предупреждение обязательно.

10. **Защита от деактивации последнего активного слота типа.** При попытке установить `isActive=false` (через `PATCH` или `toggle-active`) или выполнить `DELETE` — сервер выполняет проверку:
    ```typescript
    const otherActive = await prisma.missionSlot.count({
      where: {
        missionType: slot.missionType,
        isActive: true,
        id: { not: slot.id },
      },
    });
    if (otherActive === 0) {
      return error(400, 'LAST_ACTIVE_SLOT_OF_TYPE', {
        missionType: slot.missionType,
        message: `Нельзя деактивировать последний активный слот типа ${slot.missionType}. Сначала активируйте другой слот этого типа.`,
      });
    }
    ```
    UI админки показывает это сообщение в виде alert при попытке выполнить запрещённое действие. Код ошибки: `LAST_ACTIVE_SLOT_OF_TYPE`.

11. **Предупреждение о дублирующихся ключах запуска** (Mission Launcher):
    - **CRACK:** при создании или редактировании Crack-слота — проверить уникальность пары `(targetUrl, targetEmail)` среди активных CRACK-слотов. Если дубликат — баннер-предупреждение «Уже существует активный Crack-слот с таким URL и логином. Launch-эндпоинт вернёт непредсказуемый слот (`findFirst`)». Не блокирует сохранение.
    - **DECIPHER:** при создании или редактировании Decipher-слота — проверить уникальность `folderPath` среди активных DECIPHER-слотов. Аналогичное предупреждение.
    - **RDP:** `correctIp` должен быть уникальным среди активных RDP-слотов (connect ищет по IP). Аналогичное предупреждение.

12. **Валидация `nextRdpSlotKey` для RDP-слотов:**
    - Поле `nextRdpSlotKey` — опциональное, только для RDP. Отображается как выпадающий список других активных RDP-слотов.
    - При сохранении слота с `rdpScenario=1` без `nextRdpSlotKey` — баннер-предупреждение «Для сценария 1 рекомендуется указать следующий RDP-слот в цепочке. Без него IP следующего шага не будет показан в логах». Не блокирует сохранение.
    - При заполненном `nextRdpSlotKey` — проверить, что слот с таким `slotKey` существует, активен и имеет `missionType === 'RDP'`.

---

## Подраздел: Чаты (граф диалога)

### Цель

CRUD реплик (`ChatScript`) и переходов (`ChatTransition`). Загрузка аудио для реплик. Валидатор связности.

### UI: страница `/admin/chats`

Два вкладки:
- **Реплики** — таблица всех `ChatScript` с фильтром по `chatType`
- **Переходы** — таблица всех `ChatTransition`

Опционально: визуальный редактор графа (через библиотеку `react-flow`), но это нагрузка для UI — на MVP делаем табличный вид.

### Таблица реплик

Колонки: `code`, `chatType`, `text` (truncate), `isStart`, `isEnd`, `hasChoices`, audio (значок если загружено), действия.

### Таблица переходов

Колонки: `from.code`, `to.code`, `conditionType`, `conditionValue`, `priority`, действия.

### API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/admin/chats/scripts` | Список реплик с фильтром по chatType |
| POST | `/api/admin/chats/scripts` | Создать реплику |
| GET | `/api/admin/chats/scripts/[id]` | Детали реплики |
| PATCH | `/api/admin/chats/scripts/[id]` | Редактировать |
| DELETE | `/api/admin/chats/scripts/[id]` | Удалить (с предупреждением) |
| POST | `/api/admin/chats/scripts/[id]/audio` | Загрузить аудио (multipart/form-data) |
| DELETE | `/api/admin/chats/scripts/[id]/audio` | Удалить аудио |
| GET | `/api/admin/chats/transitions` | Список переходов |
| POST | `/api/admin/chats/transitions` | Создать переход |
| PATCH | `/api/admin/chats/transitions/[id]` | Редактировать |
| DELETE | `/api/admin/chats/transitions/[id]` | Удалить |
| GET | `/api/admin/chats/validate` | Валидатор связности графа |
| GET | `/api/admin/chats/affected-users/[scriptId]` | Сколько игроков сейчас на этой реплике |

### Защиты и валидаторы

1. **PATCH `code` запрещён** — это машинное имя, на него ссылаются autostart, валидаторы, FinalReportContent.

2. **PATCH `chatType` запрещён** — реплика не может перейти из DETECTIVE в MARINA без переписывания связанных переходов.

3. **DELETE реплики** — каскад `ChatTransition`, `ChatState.currentMessageId → null` (через `onDelete: SetNull`). Перед DELETE — спрашиваем `GET /api/admin/chats/affected-users/[scriptId]` и показываем «N игроков сейчас на этой реплике, они вернутся к началу чата».

4. **POST `transition` с `conditionType=TRIGGER`** — `conditionValue` должен быть из выпадающего списка. Список генерируется на сервере (валидация в Zod):
   ```typescript
   const TRIGGER_VALUES = [
     ...allMissionSlots.map(s => `crack_completed:${s.slotKey}`),
     ...allMissionSlots.map(s => `decipher_completed:${s.slotKey}`),
     ...allMissionSlots.map(s => `rdp_completed:${s.slotKey}`),
     'rdp_marina_triggered',
     'final_choice_made',
   ];
   ```

5. **Валидатор графа** `GET /api/admin/chats/validate`:
   - Каждая реплика без `hasChoices` и без `isEnd` имеет хотя бы один исходящий переход
   - Каждая реплика с `hasChoices=true` имеет переход для каждого `value` из choices
   - Существует путь от `isStart` до `isEnd` для каждого `chatType`
   - Нет «висячих» переходов (with non-existent fromMessageId/toMessageId — невозможно по FK, но проверяем)

6. **Загрузка аудио:**
   - Multipart upload до 5 МБ
   - `Content-Type: audio/mpeg` или `audio/wav` или `audio/mp3`
   - Файл сохраняется в S3 по ключу `audio/chat/{scriptId}/{filename}`
   - Старый аудио (если есть) удаляется из S3 перед загрузкой нового
   - `ChatScript.audioUrl` обновляется

---

## Подраздел: Файлы RDP

### Цель

Загрузка PDF-файлов для симуляции Windows. Привязка к слотам, группировка по папкам, управление `isLocked` для папок.

### UI: страница `/admin/files`

Группировка: сначала фильтр по слоту (`MissionSlot.slotKey` для RDP-слотов), затем — список файлов в этом слоте, сгруппированных по `folder`.

Внутри каждой папки:
- Список файлов (имя, размер, ссылка на просмотр)
- Toggle `isLocked` на уровне папки (изменяет `isLocked` для всех файлов в папке атомарно)
- Кнопка «Загрузить файл»
- Кнопка «Удалить папку» (удаляет все файлы папки)

### API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/admin/files` | Список файлов с фильтром по slotId/folder |
| POST | `/api/admin/files` | Загрузить файл (multipart) |
| GET | `/api/admin/files/[id]` | Детали файла |
| PATCH | `/api/admin/files/[id]` | Редактировать (имя файла) |
| DELETE | `/api/admin/files/[id]` | Удалить файл |
| PATCH | `/api/admin/files/folder/lock` | Изменить isLocked для всей папки атомарно |
| DELETE | `/api/admin/files/folder` | Удалить всю папку (все файлы внутри) |

### Защиты

1. **POST загрузка:**
   - Multipart upload до 10 МБ
   - `Content-Type: application/pdf`
   - Поля в body: `slotId`, `folder` (имя), `name` (имя файла, опционально — иначе берём из upload)
   - Сохраняется в S3: `pdf/rdp/{slotKey}/{folder}/{name}`
   - INSERT `RdpFile` с метаданными

2. **PATCH /folder/lock** — атомарное обновление `isLocked` для всех файлов одной папки одного слота:
   ```typescript
   await prisma.rdpFile.updateMany({
     where: { slotId, folder: folderName },
     data: { isLocked: newValue },
   });
   ```
   Это гарантирует **инвариант** «все файлы папки имеют одинаковый isLocked» (см. `database.md` → `RdpFile`).

3. **DELETE файла** — удаляет запись `RdpFile` И объект из S3 (через `s3.deleteObject`).

4. **DELETE /folder** — удаляет все файлы папки и связанные S3-объекты:
   ```typescript
   const files = await prisma.rdpFile.findMany({ where: { slotId, folder } });
   for (const f of files) {
     await s3.deleteObject({ Key: extractKeyFromUrl(f.url) });
   }
   await prisma.rdpFile.deleteMany({ where: { slotId, folder } });
   ```

5. **Валидация при создании:** `slotId` должен быть RDP-слотом (`missionType === 'RDP'`).

---

## Подраздел: Финальный отчёт

### Цель

CRUD вопросов и контентов концовок. Валидатор связности с чатом Марины.

### UI: страница `/admin/report`

Две секции:
- **Вопросы** — таблица с `orderIndex`, `questionText`, `correctOption`. Drag-and-drop для переупорядочивания.
- **Концовки** — таблица с `finalChoiceValue`, `title`, превью `bodyText`.

Внизу страницы — баннер с результатом валидатора связности (см. ниже).

### API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/admin/report/questions` | Список вопросов |
| POST | `/api/admin/report/questions` | Создать вопрос |
| PATCH | `/api/admin/report/questions/[id]` | Редактировать |
| DELETE | `/api/admin/report/questions/[id]` | Удалить |
| GET | `/api/admin/report/contents` | Список концовок |
| POST | `/api/admin/report/contents` | Создать концовку |
| PATCH | `/api/admin/report/contents/[id]` | Редактировать |
| DELETE | `/api/admin/report/contents/[id]` | Удалить (с предупреждением) |
| GET | `/api/admin/report/validate` | Валидатор связности |

### Защиты и валидаторы

1. **POST/PATCH `correctOption`** — должен быть в диапазоне `0..options.length-1`.

2. **POST `FinalReportContent`** — `finalChoiceValue` обязательно UPPERCASE, проверяется регексом `/^[A-Z_]+$/`.

3. **DELETE `FinalReportContent`** — если есть игроки с `ChatState.finalChoice === <этот value>` И `GameProgress.finalReportDone === false` — предупреждение «N игроков, у которых уже сделан выбор `X`, не смогут получить финал». Не блокируем удаление, но даём знать.

4. **Валидатор связности** `GET /api/admin/report/validate` — описан в `final-report.md` → раздел «Соответствие с FinalReportContent». Запускается:
   - При входе на `/admin/report` (показ баннера)
   - При входе на `/admin/chats` (показ баннера)
   - После любого изменения choices в финальной реплике Марины
   - После любого изменения `FinalReportContent`

5. **Не предупреждаем при изменении `correctOption`** — это нормальное действие. Хотя у уже сданных отчётов `finalScore` останется без изменений (см. `final-report.md` → правило 9).

---

## Подраздел: Подсказки Детектива

### Цель

CRUD подсказок Детектива. Drag-and-drop для переупорядочивания. Мягкое отключение.

### UI: страница `/admin/hints`

Таблица:
- `orderIndex` (можно перетаскивать строки)
- `text` (truncate, на превью)
- `isActive` (toggle)
- Действия (Редактировать, Удалить)

Над таблицей — кнопка «Создать подсказку».

### API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/admin/hints` | Список подсказок |
| POST | `/api/admin/hints` | Создать |
| PATCH | `/api/admin/hints/[id]` | Редактировать (text, isActive) |
| DELETE | `/api/admin/hints/[id]` | Удалить (с аудитом) |
| POST | `/api/admin/hints/reorder` | Переупорядочить (массовое обновление orderIndex) |

### Защиты

1. **POST с уже занятым `orderIndex`** — 400 `INDEX_TAKEN`. Админ должен выбрать свободный или переупорядочить.

2. **POST /reorder** — принимает массив `{ id, newOrderIndex }`, обновляет всё атомарно в транзакции.

3. **DELETE** — каскад на `UserHintProgress` НЕ нужен (там нет FK на `DetectiveHint`). Удалённая подсказка просто пропускается алгоритмом findFirst в `getCurrentHint`. См. `hints.md`.

4. **Аудит:** `hint_deleted` с `hintId`, `orderIndex`. Полезно для отладки «у игрока пропали подсказки».

---

## Подраздел: Аудит-лог

### Цель

Просмотр всех записей `AdminAuditLog` для отладки support-кейсов. Фильтрация по типу, дате, userId/adminId.

### UI: страница `/admin/audit-log`

Таблица записей:
- `createdAt`
- `type`
- `userId` / `adminId` (с email рядом, если найден)
- `message`
- `metadata` (раскрывающаяся ячейка с JSON)

Фильтры:
- По типу (выпадающий список всех `type` значений)
- По диапазону дат
- По userId/adminId

Пагинация: 50 записей на страницу.

### API-эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/admin/audit-log` | Список с фильтрами и пагинацией |

### Параметры запроса

```typescript
const querySchema = z.object({
  type: z.string().optional(),
  userId: z.string().cuid().optional(),
  adminId: z.string().cuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().cuid().optional(), // для пагинации
});
```

**Response 200:**
```json
{
  "logs": [
    {
      "id": "clx...",
      "type": "user_restart",
      "userId": "clx...",
      "userEmail": "user@example.com",  // обогащено из User.email
      "adminId": null,
      "adminEmail": null,
      "message": "Игрок user@example.com выполнил перезапуск игры",
      "metadata": null,
      "createdAt": "2026-05-08T..."
    }
  ],
  "nextCursor": "clx..." // null если больше записей нет
}
```

### Защиты

1. **Только GET** — нет POST/PATCH/DELETE. Лог неизменяем.

2. **Обогащение email из User/AdminUser** — при отрисовке. Если соответствующая запись удалена (`userId` есть, но User не найден) — показываем `<deleted>`.

3. **Без удаления старых записей** на старте. Если БД разрастётся — добавим cron job на удаление логов старше 6 месяцев. Не делаем в MVP.

---

## Файлы, которые создаются

```
app/
├── (admin)/
│   ├── layout.tsx                                # Server Component, защита + AdminNav + AdminBanners
│   └── admin/
│       ├── page.tsx                              # Главная админки
│       ├── keys/page.tsx
│       ├── users/
│       │   ├── page.tsx
│       │   └── [id]/page.tsx                     # Детальная карточка
│       ├── admins/page.tsx
│       ├── settings/page.tsx                     # См. app-settings.md
│       ├── mission-slots/
│       │   ├── page.tsx
│       │   ├── new/page.tsx                      # Визард создания
│       │   └── [id]/page.tsx
│       ├── chats/
│       │   ├── page.tsx
│       │   └── [scriptId]/page.tsx
│       ├── files/page.tsx
│       ├── report/page.tsx
│       ├── hints/page.tsx
│       └── audit-log/page.tsx
└── api/
    └── admin/
        ├── keys/...
        ├── users/...
        ├── admins/...
        ├── app-settings/...                      # См. app-settings.md
        ├── mission-slots/...
        ├── chats/...
        ├── files/...
        ├── report/...
        ├── hints/...
        └── audit-log/route.ts

components/
└── admin/
    ├── layout/
    │   ├── AdminNav.tsx
    │   └── AdminBanners.tsx
    ├── keys/
    │   ├── KeysTable.tsx
    │   ├── KeyForm.tsx
    │   └── ImportKeysCsvModal.tsx
    ├── users/
    │   ├── UsersTable.tsx
    │   ├── UserStateView.tsx                     # Полный snapshot для отладки
    │   └── ResetMissionDialog.tsx
    ├── admins/
    │   ├── AdminsTable.tsx
    │   └── AdminForm.tsx
    ├── app-settings/...                          # См. app-settings.md
    ├── mission-slots/
    │   ├── MissionSlotsTable.tsx
    │   ├── CreateMissionSlotWizard.tsx
    │   ├── CrackSlotForm.tsx
    │   ├── DecipherSlotForm.tsx
    │   └── RdpSlotForm.tsx
    ├── chats/
    │   ├── ChatScriptsTable.tsx
    │   ├── ChatScriptForm.tsx
    │   ├── ChatTransitionsTable.tsx
    │   ├── ChatTransitionForm.tsx
    │   ├── AudioUploader.tsx
    │   └── ChatGraphValidatorBanner.tsx
    ├── files/
    │   ├── FoldersList.tsx
    │   ├── FolderItem.tsx
    │   ├── FileUploadModal.tsx
    │   └── FolderLockToggle.tsx
    ├── report/
    │   ├── QuestionsTable.tsx
    │   ├── QuestionForm.tsx
    │   ├── ContentsTable.tsx
    │   ├── ContentForm.tsx
    │   └── ReportValidatorBanner.tsx
    ├── hints/
    │   ├── HintsTable.tsx
    │   ├── HintForm.tsx
    │   └── HintsReorderControl.tsx
    └── audit-log/
        ├── AuditLogTable.tsx
        └── AuditLogFilters.tsx

lib/
├── admin/
│   ├── auditLog.ts                               # writeAuditLog(type, userId?, adminId?, message, metadata?)
│   ├── csvImport.ts                              # parseKeysCsv(text)
│   ├── csvExport.ts                              # generateKeysCsv(keys), generateUsersEmailCsv(users)
│   └── chatGraphValidator.ts                     # validateChatGraph()
└── s3.ts                                         # уже создан в файлах/чатах модулей; здесь добавляются deleteObject
```

---

## Серверные правила

1. **Все эндпоинты `/api/admin/*` защищены** через `proxy.ts` + явная проверка в handler.

2. **Деструктивные действия пишутся в `AdminAuditLog`** — с указанием adminId инициатора.

3. **`passwordHash` НИКОГДА не возвращается клиенту** — ни для User, ни для AdminUser. Даже в snapshot для отладки.

4. **Загрузка файлов** — обязательная валидация `Content-Type` и размера. Защита от попадания мусора в S3.

5. **При удалении контента из БД — удалять и из S3.** Иначе бакет разрастётся «осиротевшими» объектами.

6. **Server Components для админки.** Эндпоинты только для мутаций (POST/PATCH/DELETE) и динамических списков с фильтрами.

7. **Зеркальная структура UI ↔ API ↔ Components** обязательна. Это упрощает навигацию для разработчика.

8. **Защиты от опасных действий — именно на сервере.** Клиентские проверки (disabled-кнопки) — UX, серверные проверки — безопасность.

9. **Аудит — отдельная утилита** `lib/admin/auditLog.ts`. Все эндпоинты вызывают её, не пишут в `AdminAuditLog` напрямую.

10. **Email обогащение в audit-log** — JOIN на User/AdminUser или дополнительный запрос. На малых объёмах — просто выборка.

11. **CSV — простой формат**, без излишних полей. Для импорта/экспорта используем `papaparse` (есть в стеке) на клиенте + `csv-parse` на сервере.

12. **Никогда не возвращать клиенту:** `passwordHash`, `targetWord` (из активных Crack-сессий), `correctOption` (из вопросов отчёта), bcrypt-хэши.

13. **Валидаторы связности — баннеры, не блокеры.** Админ может работать даже при наличии issues, но видит явное предупреждение.

---

## Связи с другими модулями

- **`auth.md`** — авторизация админа, `proxy.ts`, `lib/auth.ts`. Здесь только применение.
- **`app-settings.md`** — раздел `/admin/settings`, эндпоинты `/api/admin/app-settings`. Описано там, в админке только пункт навигации.
- **`database.md`** — все модели, на которые опирается админка. Этот модуль — UI и API для управления контентом.
- **`logs.md`** — `OperationLog` админ может ручную добавлять через `reset-mission` / `complete-mission` (с префиксом `[admin]`).
- **`chats.md`** — admin/chats управляет графом. Валидатор связности проверяет инварианты.
- **`final-report.md`** — admin/report управляет вопросами и контентами концовок. Валидатор связности с chats.
- **`hints.md`** — admin/hints управляет подсказками. Drag-and-drop для переупорядочивания.
- **`missions-crack.md`**, **`missions-decipher.md`**, **`missions-rdp.md`** — admin/mission-slots визард создания и редактирования слотов.
- **`restart.md`** — `AdminAuditLog` пишется при каждом restart игрока. Виден в `/admin/audit-log`.
- **`onboarding.md`** — управление через `/admin/users/[id]/state` (просмотр) и `reset-mission` (сброс конкретных флагов — это отдельный кейс, на старте не делаем).
- **`mobile-block.md`** — взаимодействия нет. Заглушка для устройств с малым экраном не имеет серверного состояния, админка её не настраивает.
