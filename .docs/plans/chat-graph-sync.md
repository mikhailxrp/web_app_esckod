# План: перенос графа чатов в рабочую БД (сид-скрипт по `code`)

**Статус:** ✅ Реализовано 2026-11-05: `prisma/chat-graph.ts`, `prisma/game-settings.ts`. Актуальная инструкция — [server-restore.md](server-restore.md); ниже исходный план.

## Решения (приняты)

- **Способ — отдельный сид-скрипт, НЕ миграция.** Миграции Prisma — для схемы, выполняются один раз; граф — контент, который будет правиться. Скрипт можно запускать повторно.
- **Старый [prisma/seed.ts](../../prisma/seed.ts) не трогаем.** Его `seedChatGraph` пропускает работу, если в БД есть хоть одна реплика, — для обновления не годится.
- **Аудио не переносим.** Прод использует **другой** S3-бакет, локальные `audioUrl` (`eb3ddc399907-esckodstorage`) там недействительны. В JSON `audioUrl` не экспортируется; при синхронизации у существующих реплик `audioUrl` **не перезаписывается**, у новых — `null`. Аудио загружается через админку на проде.

- **Прод пустой** (ответ пользователя 2026-11-03): игроков с прогрессом нет, поэтому риска сбросить им прогресс нет.
- **Ключи слотов на проде совпадают с локальными.** Это уже обеспечивает `prisma/seed.ts` (`seedMissionSlots`: upsert тех же 6 `slotKey`). Сид запускается на проде **до** синхронизации чатов.
- **Приоритет №1 — переходы переносятся точно**: from → to, `conditionType`, `conditionValue`, `priority`. Тексты и аудио вторичны, их можно поправить в админке.

## Исходные данные

Источник — локальная БД `EscKod_LOCAL`: 37 реплик (Детектив 30, Марина 7), 53 перехода. Граф проверен 2026-11-03: структурно корректен, тупиков/циклов/битых переходов нет, все триггеры валидны. Заглушки контента (текст «ТУТ РАСШИФРОВКА АУДИО» и т.п.) переносятся как есть — заменить потом.

## Ключевой риск и как его обходим

`ChatState.currentDetectiveMessageId / currentMarinaMessageId` → `ChatScript` с `onDelete: SetNull`.
Если удалить и пересоздать реплики — у игроков на проде чат сбросится на старт.

Поэтому синхронизация **по `code`** (он `@unique`):
- реплики с существующим `code` — `update`, `id` сохраняется → указатели игроков живы;
- новые `code` — `create`;
- переходы — удалить все и создать заново (на них ничего не ссылается);
- реплики, которых нет в JSON, — удалить (затронутых игроков скрипт показывает заранее).

## Файлы

| Файл | Что делает |
|---|---|
| `prisma/export-chat-graph.ts` (новый) | Читает граф из текущей БД (`DATABASE_URL`) → пишет `prisma/data/chat-graph.json`. Переходы — по `fromCode`/`toCode`, без `id`. Без `audioUrl`. Сортировка стабильная (по `chatType`, `code`) — чтобы diff в git был читаемым. |
| `prisma/data/chat-graph.json` (новый, генерируется) | `{ version: 1, scripts: [{code, chatType, author, text, hasChoices, choices, isStart, isEnd}], transitions: [{fromCode, toCode, conditionType, conditionValue, priority}] }` |
| `prisma/seed-chat-graph.ts` (новый) | Синхронизация JSON → БД (алгоритм ниже). Флаг `--dry-run`. |
| `package.json` | Скрипты `db:chat:export` → `tsx prisma/export-chat-graph.ts`, `db:chat:sync` → `tsx prisma/seed-chat-graph.ts`. |

Стиль — как в `prisma/seed.ts`: свой `new PrismaClient()`, без импорта `@/lib/prisma` (там `server-only`), `main().catch(...).finally($disconnect)`. Строгий TS, без `any`.

## Алгоритм `seed-chat-graph.ts`

1. **Прочитать и провалидировать JSON (Zod)** — форма файла; `choices` через `choicesSchema` из `lib/validations/admin-chats.ts`.
2. **Валидация графа ДО записи** (те же правила, что `lib/admin/chatGraphValidator.ts`, но по данным JSON):
   - ровно один `isStart` на каждый `chatType`;
   - каждый `fromCode`/`toCode` существует, и обе реплики одного `chatType`;
   - не-`isEnd` и не-`hasChoices` → есть ALWAYS или TRIGGER;
   - `hasChoices` → валидные `choices`, каждому `value` соответствует CHOICE-переход;
   - концовка достижима от старта; нет реплик без входящих (кроме старта);
   - TRIGGER `conditionValue` ∈ `buildTriggerValues(slotKeys)` из `constants/chatTriggerEvents.ts`, где `slotKeys` — **из целевой БД** (`MissionSlot`). Если слота нет на проде (напр. `CRACK_VUZ`) — ошибка, ничего не пишем.
   - есть реплика `marina_final_choice` (на неё завязан `final_choice_made` в `lib/chat/advance.ts`).
   Любая ошибка → вывод списка и `exit 1`, БД не трогается.
3. **Расчёт diff с БД и вывод отчёта:** сколько реплик создать / обновить / удалить, сколько переходов будет пересоздано, сколько `ChatState` указывают на удаляемые реплики (они сбросятся на старт), у скольких существующих реплик сохранится `audioUrl`.
4. `--dry-run` → остановиться после отчёта.
5. **Одна `prisma.$transaction`** (увеличить `timeout`, напр. 30 с):
   1. `deleteMany` всех `ChatTransition`;
   2. upsert реплик по `code` (в `update` — без `audioUrl`);
   3. `deleteMany` реплик с `code` не из JSON;
   4. `createMany` переходов (`code` → `id` по свежему `findMany`).
   Важно: сначала снять `isStart` у старых стартовых реплик либо апсертить в порядке, при котором не возникает двух стартов, — уникального индекса на `isStart` нет, так что это только про логическую целостность внутри транзакции (снаружи никто не увидит промежуточного состояния).
6. **Сверка переходов после коммита (обязательно, это главная цель).** Перечитать граф из БД и привести каждый переход к виду `chatType|fromCode|toCode|conditionType|conditionValue|priority`. Сравнить с таким же набором из JSON: множества должны совпасть один в один. То же для реплик: `code|chatType|author|isStart|isEnd|hasChoices|choices(JSON)`. При расхождении вывести diff и завершиться с `exit 1`; сам скрипт запускать заново, в нём нет этапа отката.
7. Этой же функцией сверки сделать режим `--verify` (только чтение): им можно в любой момент проверить, что граф на проде совпадает с `chat-graph.json`.

Скрипт **не трогает** `ChatState` игроков (кроме автоматического `SetNull` при удалении реплик), `firedTriggers`, `playerChoices`.

## Порядок работы

1. Локально: `npm run db:chat:export` → проверить `prisma/data/chat-graph.json` глазами.
2. Локально: `npm run db:chat:sync -- --dry-run` → должно быть «0 создать / 37 обновить / 0 удалить».
3. Локально: `npm run db:chat:sync` → убедиться, что ничего не сломалось (админка → проверка графа, чат игрока на месте).
4. `npx tsc --noEmit`, `npm run lint`.
5. Коммит в `edits_branch` → PR → деплой (CI сам скрипт **не** запускает — это осознанно).
6. На сервере (прод пустой):
   1. `npx prisma migrate deploy` (делает CI) → `npm run db:seed`: создаются слоты миссий, админ, контент отчёта и **заглушка графа из 6 реплик**;
   2. `npm run db:chat:sync -- --dry-run` → ожидается «37 создать / 0 обновить / 6 удалить» (удаляются заглушки `detective_greeting` и прочие), затронутых `ChatState` — 0;
   3. `npm run db:chat:sync` → сверка из шага 6 алгоритма должна пройти;
   4. `npm run db:chat:sync -- --verify` → «совпадает».
7. На проде: админка → «Проверить граф»; загрузить аудио в реплики `det_06_audio_files`, `det_06_audio_files_elena`, `det_12_audio_orphanage`, `det_12_audio_aa`, `det_12_audio_lawyers`.

## Попутно (не блокирует)

- Обновить `.docs/modules/chats.md`: там всё ещё описан `marina_final_choice` с `PROTECT/ACCUSE`, а фактически `option_1..3` (поле `ChatState.finalChoice` — legacy, отчёт его не использует).
