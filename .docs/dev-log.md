# Development Log

Журнал сессий разработки. Записывай сюда что сделано после каждой сессии.

---

## 2026-07-02 — Политика конфиденциальности: Tiptap-редактор в админке

**Сделано:**

- `AppSettings.privacyPolicyUrl` переименовано в `privacyPolicyText`, семантика поля изменена с внешней ссылки на HTML-текст (миграция вручную через `RENAME COLUMN`, данные сохранены, дефолт `""`).
- Новая страница `/admin/privacy-policy` — Tiptap-редактор (`@tiptap/react` + `StarterKit` v3: жирный/курсив/подчёркнутый/зачёркнутый, заголовки H1–H3, списки, цитата, ссылка, undo/redo) с сохранением через существующий `PATCH /api/admin/app-settings`.
- Поле убрано с общей страницы `/admin/settings` (`AppSettingsForm`, `PlaceholderWarningBanner`) — у него теперь отдельная страница и отдельный баннер-предупреждение в `AdminBanners` (проверка пустоты вместо `example.com`).
- Новая публичная страница `/privacy-policy` (в группе `(auth)`, без авторизации) рендерит сохранённый текст; ссылка согласия в `RegisterForm` теперь статична (`/privacy-policy`) вместо динамического URL из `AppSettings`.
- `GET /api/settings/registration-defaults` больше не отдаёт поле политики (форме регистрации оно не нужно).
- Общий CSS-класс `.tiptap-content` в `globals.css` — используется и в зоне редактора, и в публичном рендере, чтобы WYSIWYG совпадал.

**Документация** (обновлена):

- `.docs/modules/app-settings.md`, `.docs/database.md`, `.docs/prd.md`, `.docs/modules/admin.md`, `.docs/modules/auth.md` — все упоминания `privacyPolicyUrl` заменены на `privacyPolicyText` с новой семантикой.

**Новые зависимости:** `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` (`^3.27.1`).

---

## 2026-06-23 — Phase 19 / Таск 2 — UI перезапуска через «Переиграть» в финальном отчёте

**Сделано:**

- Реализован **Phase 19, Таск 2** (клиентская интеграция restart): точка входа — кнопка «Переиграть» на экране результата финального отчёта, а не кнопка в top bar dashboard (продуктовое решение в сессии).

**Клиент** (изменено):

- **`components/game/report/FinalReportView.tsx`** — `handleReplay`: `POST /api/game/restart` → при 200 `window.location.reload()` (полный сброс Zustand `chatStore` / `logStore`); при 429 → `toast.warning('Слишком частые попытки, подождите немного')`; при 500/сети → `toast.error('Ошибка перезапуска. Попробуйте позже')`. Стейт `isRestarting`. Убран проп `onClose` — закрытие отчёта заменено перезагрузкой страницы.
- **`components/game/report/ReportResult.tsx`** — вместо `onClose` пропсы `onReplay` + `isRestarting`; кнопка «Переиграть» с `disabled` / `aria-busy`, спиннер и текст «Перезапуск...» на время запроса.
- **`components/game/DashboardClient.tsx`** — убран `onClose={() => setReportOpen(false)}` у `<FinalReportView>`.

**Сервер** (попутный фикс):

- **`lib/game/restart.ts`** — `finalReportAnswers: Prisma.DbNull` вместо `null` (корректная запись nullable JSON-поля в Prisma).

**Документация** (обновлена):

- **`.docs/modules/restart.md`** — rule #10: `window.location.reload()` обязателен (не `router.refresh()`), с обоснованием про Zustand-сторы.

**Отклонение от исходного TASK.md:**

- `RestartGameButton` / `RestartConfirmModal` в top bar были созданы, затем **удалены** — единственная точка перезапуска: «Переиграть» в финальном отчёте (без 5-сек модалки подтверждения; контекст конца игры считается достаточной защитой).
- `data-onboarding-id="restart-button"` в top bar не добавлялся.

**Ожидает ручной проверки (DoD):** после «Переиграть» — чистый dashboard, одна запись «Игра начата заново» в истории, чат Детектива стартует сразу (`onboardingDone=true` сохранён), чат Марины скрыт, миссии сброшены, финальный отчёт снова недоступен.

---

## 2026-06-23 — Phase 19 / Таск 1 — Транзакция restart + API + правки доков

**Сделано:**

- Реализован **Phase 19, Таск 1**: атомарный сброс прогресса игрока через `POST /api/game/restart`. Параллельные вызовы сериализуются advisory lock'ом на `userId`.

**Сервер** (создано):

- **`lib/game/restart.ts`** — `restartGame(userId)`: `pg_advisory_xact_lock` → email из БД → DELETE `MissionProgress`, `CrackSession`, `OperationLog`, `UserHintProgress` → UPDATE `ChatState` (обнуление полей + `version: { increment: 1 }`) → UPDATE `GameProgress` (5 полей + `version: { increment: 1 }`) → INSERT `OperationLog` (`game_restarted`) → INSERT `AdminAuditLog` (`user_restart` с email игрока). `AccessKey.currentActivations` и `User.onboardingDone` не трогаются.
- **`app/api/game/restart/route.ts`** — `POST`: `auth()` → 401 для не-PLAYER; rate limit 3/мин → 429 `RATE_LIMIT_EXCEEDED`; `restartGame(userId)` → `{ success: true }` 200; ошибка транзакции → 500 `RESTART_FAILED`.
- **`lib/validations/restart.ts`** — пустая Zod-схема тела запроса (без email с клиента).

**Документация** (обновлена):

- **`.docs/modules/restart.md`** — сигнатура `restartGame(userId)` без `userEmail`; 5 полей `GameProgress`; `version: { increment: 1 }` в обоих UPDATE; пример API без передачи email.
- **`.docs/database.md`** — пример транзакции restart: `version: { increment: 1 }` в оба UPDATE; `finalReportChoice=null`, `finalReportAnswers=null` в UPDATE `GameProgress`.

**Out of scope (Таск 2):** UI `RestartGameButton`, `RestartConfirmModal`, интеграция в `DashboardClient`.

---

## 2026-06-22 — Phase 18 / Таск 3 — Скриптовые demo-состояния мини-игр (шаги 4–20)

**Сделано:**

- Реализован **Phase 18, Таск 3**: per-step demo-состояния для всех шагов мини-игр **4–10** (Взломщик), **12–16** (Дешифратор), **18–20** (Удалённый доступ). Шаги **1–3** (эталон) не изменялись. Демо полностью клиентское — без вызовов `/api/missions/*`, `/api/logs/*`, `/api/progress/*`.

**Механизм per-step payload** (изменено):

- **`components/game/onboarding/OnboardingController.tsx`** — колбэк `onStepChange(stepId)` при каждой смене шага.
- **`components/game/DashboardClient.tsx`** — стейт `currentStepId`; `currentStepPayload` из `ONBOARDING_STEPS` → `demoState` активной панели; на шаге 10 — `demoLogEntries` в `<OperationHistory demoEntries={...} />`.

**Типы и константы** (расширено / создано):

- **`types/onboarding.ts`** — фазы `CrackDemoPhase` / `DecipherDemoPhase` / `RdpDemoPhase`; скриптовые поля (попытки Wordle, `wordleSpotlight`, Playfair-таблица, `puzzleField`, демо-пароли, `passwordCopied`); `OnboardingDemoLogEntry` + `demoLogEntries` в `DemoPayload`.
- **`constants/onboardingSteps.ts`** — `demoPayload` и референсные тексты для шагов 4–10, 12–16, 18–20; позиционирование пузырьков (`bubbleAnchor`, `bubbleShift*`); новый target `DECIPHER_CONFIRM` (`decipher-confirm`).
- **`constants/rdpOnboardingDemo.ts`** (новый) — `DEMO_RDP_PUZZLE_FIELD` (фиксированное поле 6×6, seed=19018) и текст инструкции для шага 20.

**Игровые панели — demo-ветка** (изменено):

- **`components/game/crack/CrackGamePanel.tsx`** — фазы `launch` / `playing` / `completed`; скриптовые попытки (ПЕСНЯ → ПЛИТА → ПИЛОТ), переключение подсветки `word-list` / `attempt-panel`; `data-onboarding-id` на `crack-wordle-board`, `crack-result`; короткое замыкание хендлеров.
- **`components/game/decipher/DecipherGamePanel.tsx`** — фазы `launch` / `playing` / `completed`; Playfair + ЛМОПРС → РАКЕТА; `data-onboarding-id` на `decipher-table`, `decipher-result`.
- **`components/game/decipher/DecipherInput.tsx`** — `data-onboarding-id="decipher-confirm"` на кнопке «Подтвердить» (шаг 15).
- **`components/game/rdp/RdpGamePanel.tsx`**, **`rdp/PipesPuzzle.tsx`**, **`rdp/RdpHintButton.tsx`** — фазы `launch` / `puzzle`; скриптовое поле пазла; `data-onboarding-id` на `rdp-puzzle`, `rdp-instruction-button`.
- **`components/game/crack/CrackCompletedView.tsx`**, **`decipher/DecipherCompletedView.tsx`** — проп `initialCopied` для демо «Скопировано» (шаги 10, 16).
- **`components/game/operation-log/OperationHistory.tsx`** — опциональный `demoEntries?`; при наличии — не вызывает `refreshLogs()`.

**Попутно (шаг 22):**

- **`components/game/chat/ChatPanel.tsx`**, **`ChatWindow.tsx`** — проп `demoTyping` для индикатора «Детектив печатает…» на финальном шаге тура.

**Документация** (обновлена):

- **`.docs/modules/onboarding.md`** — per-step payload, типы demo-состояний, внутренние target-id, карта шагов 4–20 → Таск 3.

**Ожидает ручной проверки (DoD Таска 3):** визуальное соответствие каждого шага 4–10 / 12–16 / 18–20 референсам `on_step-N.jpg`; финальный прогон `type-check` / `lint` / консоль.

---

## 2026-06-21 — Phase 18 / Таск 2 — Каркас тура + demo-инфраструктура + dashboard-шаги

**Сделано:**

- Реализован **Phase 18, Таск 2** (части TASK-1 + TASK-2): кастомный overlay-движок 22-шагового инструктажа без `react-joyride`; интеграция в `DashboardClient` с отдельным `demoScene`; demo-проп в `MissionCard` и трёх игровых панелях (короткое замыкание API). Dashboard-уровневые шаги **1, 2, 3, 11, 17, 21, 22** проходятся end-to-end; шаг 22 вызывает `POST /api/onboarding/complete` → `chatStore.refresh()`.

**Часть 1 — каркас тура** (создано):

- **`types/onboarding.ts`** — `OnboardingScene`, `OnboardingStep`, `TooltipPlacement`, `BubbleAnchor`, `DemoPayload`, демо-состояния панелей (`CrackDemoState`, `DecipherDemoState`, `RdpDemoState`).
- **`constants/onboardingSteps.ts`** — реестр `ONBOARDING_TARGETS` (все `data-onboarding-id`); массив `ONBOARDING_STEPS` (22 шага с текстами из референсов); `MISSION_TILES_OVERLAY_STEP_COUNT = 2` для frosted-glass шагов 1–2.
- **`components/game/onboarding/OnboardingController.tsx`** — машина шагов: `onSceneChange(scene)`, пересчёт `targetRect` (80ms после смены шага + `resize`/`scroll` через rAF), блокировка Esc (capture), на последнем шаге → `POST /api/onboarding/complete` → `onComplete()`.
- **`components/game/onboarding/OnboardingTooltip.tsx`** — шаги 1–2: `MissionTilesOverlayStep` (frosted-glass плашка поверх `mission-tiles`, подстановка `{{login}}`); шаги 3–22: делегирует в `OnboardingBubble`.
- **`components/game/onboarding/OnboardingBubble.tsx`** — пузырёк с хвостиком (backdrop-blur, позиционирование от `targetRect` + `placement`/`bubbleAnchor`/`bubbleShift*`), кнопка «далее».

**Часть 2 — интеграция** (изменено):

- **`components/game/DashboardClient.tsx`** — `demoScene` state; `<OnboardingController>` при `!onboardingDone`; `renderDemoMissionsContent(demoScene)` переключает demo-карточки/панели вместо боевых; `data-onboarding-id` на `status-bar`, `mission-tiles`, `hints-button`, `operation-history`, `chat-detective`; `handleOnboardingComplete` → `chatStore.refresh()`.
- **`app/(game)/dashboard/page.tsx`** — передача `playerLogin` (из сессии) в `DashboardClient`.
- **`components/game/MissionCard.tsx`** — пропы `demo?`, `onDemoStart?`; `data-onboarding-id` на карточках (`crack/decipher/rdp-mission-card`); в demo «Открыть» → `onDemoStart`, без `/api/missions/*/launch`.
- **`components/game/crack/CrackGamePanel.tsx`**, **`decipher/DecipherGamePanel.tsx`**, **`rdp/RdpGamePanel.tsx`** — пропы `demo?`, `demoState?`; `if (demo) return` в `loadState` — ноль вызовов `/api/missions/*`.

**Документация** (переписана):

- **`.docs/modules/onboarding.md`** — полная архитектура 22 шагов: кастомный overlay, `demoScene`, паттерн `demo`-пропа, реестр `ONBOARDING_TARGETS`, карта шагов по таскам; убраны `react-joyride` и старый 7-шаговый конфиг.

**Out of scope (Таск 3):** скриптовые demo-состояния полей (Wordle-доска, Playfair-таблица, пазл RDP, демо-пароли, демо-лог); визуальная доводка шагов мини-игр **4–10, 12–16, 18–20**; внутримодальные точки подсветки; кнопки «Назад» / «Завершить инструктаж» на шаге 22 (пока только «далее»); отдельный `OnboardingSpotlight` (подсветка реализована через bubble + frosted overlay).

---

## 2026-06-21 — Phase 18 / Таск 1 — Серверная развязка онбординга (гейт чата Детектива)

**Сделано:**

- Реализован **Phase 18, Таск 1** — серверная развязка: пока `onboardingDone === false` чат Детектива не стартует (`resolveChatSlot` возвращает пустой слот с `isVisible: true`). `POST /api/onboarding/complete` атомарно ставит флаг + пишет лог «Подключение установлено». После завершения — `chatStore.refresh()` → первая реплика без перезагрузки.

**Сервер** (создан / изменён):
- **`app/api/onboarding/complete/route.ts`** (новый) — POST, Player only (`auth()` + `type === 'PLAYER'`), идемпотент (если уже true → 200 + `alreadyCompleted`), транзакция `user.update` + `operationLog.create` через `renderLogMessage('onboarding_completed')`.
- **`lib/chat/state.ts`** — `getChatState(userId, onboardingDone = true)`; для `DETECTIVE` при `!onboardingDone` → `{ currentMessage: null, isVisible: true }` без вызова `ensureChatStarted`.
- **`app/(game)/dashboard/page.tsx`** — запрос `prisma.user.findUniqueOrThrow({ select: { onboardingDone } })`, передача пропа в `DashboardClient`.
- **`components/game/DashboardClient.tsx`** — проп `onboardingDone`; `useEffect` с `refresh()` только при `true`; `handleOnboardingComplete` (заглушка для будущего `OnboardingController`).

**Документация** (обновлена):
- **`.docs/modules/chats.md`** — подраздел «Гейт Детектива по `onboardingDone`» в секции `GET /api/chat/state`.
- **`.docs/modules/onboarding.md`** — явная связь «Первое сообщение Детектива ← завершение онбординга».

**Проверка:** `npm run type-check` — 0 ошибок; `npm run lint` — pre-existing ошибки (не в изменённых файлах).

**Out of scope:** UI тура (`OnboardingController` и т.д. — Таск 2), demoMode мини-игр (Таск 2–3).

---

## 2026-06-20 — Phase 17 / Таск 3 — UI финального отчёта + интеграция в dashboard

**Сделано:**

- Реализован **Phase 17, Таск 3** — клиентский UI финального отчёта без модалки: кнопка под чатом «Анонима», экран вопросов, сдача через API, экран результата; end-to-end интеграция в `DashboardClient`.

**UI-компоненты** (созданы):
- **`components/game/report/FinalReportButton.tsx`** — при монтировании и при смене `detectiveFinished` (из `chatStore`): `GET /api/final-report/availability`; `!available && !alreadySubmitted` → `null` (нет в DOM); «Финальный отчёт» / «Просмотр результата»; `onOpen(alreadySubmitted)`.
- **`components/game/report/ReportQuestion.tsx`** — один контрольный вопрос: нумерация `[N]`, варианты в `grid-cols-2 sm:grid-cols-4`, single-select с терминальными `[  ]` / `[✓]`.
- **`components/game/report/FinalReportView.tsx`** — stage-машина `loading → questions → result`; при `alreadySubmitted` сразу `GET /result`, иначе `GET /questions` (версия хранится локально); контрольные вопросы через `ReportQuestion`, финальный блок «Обвинить / Защитить» отдельно (`[→]`); submit через `fetchWithVersion` + `onConflict: refetchVersion`; 409 → тост (из `fetchWithVersion`); после успеха → `GET /result`; fallback поиск финального вопроса по `REPORT_FINAL_CHOICES`, если `finalReportQuestionId` не задан.
- **`components/game/report/ReportResult.tsx`** — счёт «X из Y»; двухколоночная сетка: слева ответы с `[✓]`/`[✗]` (финальный — без оценки), справа блоки ссылок; концовка; кнопка «Переиграть» → `onClose()`; изображения через `next/image` (200×200).

**Интеграция** (изменён):
- **`components/game/DashboardClient.tsx`** — стейты `reportOpen`, `reportAlreadySubmitted`; при `reportOpen` основная сетка заменяется на `FinalReportView` (`StatusBar` и сайдбар с чатами сохраняются); `FinalReportButton` под `<ChatPanel chatType="MARINA" />`.

**Out of scope (Phase 18–19):** онбординг кнопки «Финальный отчёт»; реальный рестарт по «Переиграть»; мобильная адаптация экрана отчёта.

---

## 2026-06-20 — Phase 17 / Таск 2 — Эндпоинты: `questions` / `submit` / `result`

**Сделано:**

- Реализован **Phase 17, Таск 2** — серверная логика сдачи и просмотра финального отчёта, три Player-auth API-эндпоинта для игрока.

**Серверные lib-функции** (созданы):
- **`lib/final-report/submit.ts`** — `submitReport(userId, body)`: проверка доступности (`NOT_AVAILABLE`, `ALREADY_SUBMITTED`); покрытие всех вопросов (`INCOMPLETE_ANSWERS`); валидация индекса варианта (`INVALID_OPTION_INDEX`); сбор снапшота `{ questionText, selectedLabel, isCorrect, isFinalQuestion }`; подсчёт процента **только по контрольным** (финальный вопрос-указатель исключён); поиск концовки по `finalChoice` (`FINAL_CONTENT_MISSING` → 500); optimistic locking через `where: { userId, version: expectedVersion }` (`P2025` → 409 `VERSION_CONFLICT`); запись `finalReportDone`, `finalScore`, `finalReportChoice`, `finalReportAnswers`; `writeLog` с `type: LogType.SUCCESS`; возврат `{ score, finalContent, version }`.
- **`lib/final-report/result.ts`** — `getResult(userId)`: проверка `finalReportDone` (`NOT_SUBMITTED` → 400); `finalReportChoice` (`NO_FINAL_CHOICE` → 500); концовка по сохранённому выбору; чтение снапшота с фильтром `!isFinalQuestion` для `correctCount` / `totalCount`; блоки `FinalReportLinkBlock` (orderBy `blockIndex`); возврат `{ score, answers, finalContent, linkBlocks }`.

**API Routes** (созданы, Player-auth через `auth()`):
- **`app/api/final-report/questions/route.ts`** — `GET`: `checkAvailability` (400 если недоступен и не сдан); вопросы по `orderIndex` с явным `select` **без** `correctOption`; `finalReportQuestionId` из `AppSettings`.
- **`app/api/final-report/submit/route.ts`** — `POST`: Zod `submitSchema` (422 при ошибке); делегирует в `submitReport`; проброс кодов 400 / 409 / 500.
- **`app/api/final-report/result/route.ts`** — `GET`: делегирует в `getResult`; проброс кодов 400 / 500.

**Документация** (обновлена):
- **`.docs/database.md`** — комментарий к `finalReportAnswers`: добавлен `isFinalQuestion` в формат снапшота.
- **`.docs/modules/final-report.md`** — псевдокод `answerSnapshot.push()`: поле `isFinalQuestion`; `writeLog(...)` с `type: LogType.SUCCESS`.

**Out of scope (Task 3):** UI-компоненты (`FinalReportButton`, `FinalReportView`, `ReportQuestion`, `ReportResult`), интеграция в `DashboardClient.tsx`.

---

## 2026-06-20 — Phase 17 / Таск 1 — Синхронизация доков + миграция + `availability`

**Сделано:**

- Реализован **Phase 17, Таск 1** — синхронизация документации под финальную модель отчёта, миграция БД, Zod-схема submit, серверная функция и API-эндпоинт проверки доступности финального отчёта.

**Документация** (обновлена):
- **`.docs/modules/final-report.md`** — §7 API: добавлен `alreadySubmitted`; §8 UI: скрытая кнопка (нет в DOM), убрана `FinalReportModal`, добавлен `FinalReportView`; `getResult()`: чтение снапшота `finalReportAnswers` вместо backward-расчёта; submit: `finalReportChoice` + `finalReportAnswers` + optimistic locking + `version`; §Файлы: убрана `FinalReportModal.tsx`, добавлены `FinalReportView.tsx`, `lib/final-report/submit.ts`, `lib/final-report/result.ts`; удалено правило 9 о «приближённом `correctCount`».
- **`.docs/prd.md`** — «двойной триггер (все активные миссии пройдены + finalChoice)» → «одиночный триггер `detectiveFinished`».
- **`.docs/phases/_status.md`** — Phase 17: обновлена цель, результат и список тасков (приведён к именам из `phase-17.md`).
- **`.docs/database.md`** — `GameProgress`: добавлены `finalReportChoice String?` и `finalReportAnswers Json?`; в сниппет restart-транзакции добавлен сброс обоих полей на `null`.

**Миграция:**
- **`prisma/schema.prisma`** — в модель `GameProgress` добавлены поля `finalReportChoice String?` и `finalReportAnswers Json?`.
- **`prisma/migrations/20260620152915_phase17_final_report_result/migration.sql`** — сгенерирована и применена командой `npx prisma migrate dev`.

**Новые серверные файлы:**
- **`lib/validations/final-report.ts`** — Zod `submitSchema`: `finalChoice` ∈ `REPORT_FINAL_CHOICES`, `answers: [{questionId, selectedOption}].min(1)`, `expectedVersion: z.number().int().min(0)`; экспорт `SubmitBody` через `z.infer`.
- **`lib/final-report/availability.ts`** — `checkAvailability(userId)`: читает `ChatState.detectiveFinished` + `GameProgress.finalReportDone`, возвращает `{ available, alreadySubmitted, reasonsBlocked? }`.
- **`app/api/final-report/availability/route.ts`** — `GET`, Player-auth через `auth()`, вызывает `checkAvailability`, типизированный `NextResponse`.

---

## 2026-06-19 — Phase 16 / Таск 3 — Тексты концовок (История) + Ссылки + баннер проверки (API + UI)

**Сделано:**

- Реализован **Phase 16, Таск 3** — две подстраницы раздела «Финальный отчёт» (`/admin/report/history`, `/admin/report/links`), баннер проверки конфигурации, миграция БД и REST API под единую кнопку «Сохранить».

**Миграция и сидер:**
- **`prisma/migrations/20260619190426_phase16_report_history_links/migration.sql`** — `AppSettings.finalReportQuestionId` (FK → `FinalReportQuestion`, `onDelete: SetNull`); новая модель `FinalReportLinkBlock` (`blockIndex` 1|2, `text`, `images` JSON).
- **`prisma/schema.prisma`** — поле указателя финального вопроса + модель `FinalReportLinkBlock`.
- **`prisma/seed.ts`** — `seedFinalReportLinkBlock()`: идемпотентный upsert двух пустых блоков по `blockIndex`; вызов в `main()`.

**Документация** (обновлена):
- **`.docs/modules/final-report.md`** — явный указатель `AppSettings.finalReportQuestionId` вместо авто-детекта; раздел «Ссылки» (`FinalReportLinkBlock`, S3, API).
- **`.docs/database.md`** — поле `finalReportQuestionId`, модель `FinalReportLinkBlock`, сидер блоков ссылок.

**Валидация и типы:**
- **`lib/validations/admin-report.ts`** — `updateHistorySchema`, `updateLinksSchema`, `linkImageUploadFieldsSchema`, `linkImageDeleteSchema`, `MAX_LINK_IMAGE_SIZE_BYTES` (5 МБ).
- **`lib/final-report/validate.ts`** — расширен `validateReportConfig()`: коды `NO_FINAL_QUESTION`, `FINAL_QUESTION_NOT_FOUND`, `FINAL_QUESTION_BAD_OPTIONS` (проверка через `isFinalChoiceQuestion`, без обращения к чату).
- **`types/admin-report.ts`** — `ContentItem`, `HistoryData`, `LinkImage`, `LinkBlock`.

**API** (созданы, защита через `adminAuth` → 403):
- **`app/api/admin/report/history/route.ts`** — `GET` (указатель + список вопросов + 2 концовки); `PUT` (Zod `updateHistorySchema`, атомарный `$transaction`: update `AppSettings` + upsert `FinalReportContent` по `ACCUSE`/`PROTECT`; 400 если вопрос не найден или не «Обвинить/Защитить»).
- **`app/api/admin/report/links/route.ts`** — `GET` (2 блока); `PUT` (тексты обоих блоков через `$transaction`).
- **`app/api/admin/report/links/images/route.ts`** — `POST` (multipart → S3 `putObject`, ключ `files/report-links/block-{n}/…`, append в `images`; MIME через `ALLOWED_IMAGE_MIME`, лимит 5 МБ); `DELETE` (`deleteObject` + удаление из массива).

**UI** (созданы):
- **`app/(admin)/admin/report/history/page.tsx`** — SSR: `ReportValidatorBanner` + `HistoryForm`; `loading.tsx`.
- **`app/(admin)/admin/report/links/page.tsx`** — SSR → `LinksForm`; `loading.tsx`.
- **`components/admin/report/HistoryForm.tsx`** — Client: дропдаун финального вопроса (фильтр `isFinalChoiceQuestion`), информативные метки вариантов, 2 блока (`title` + `bodyText`), react-hook-form + Zod, единый Save → `PUT /history`, тост + refetch.
- **`components/admin/report/LinksForm.tsx`** — Client: 2 textarea + дропзоны картинок; upload/delete сразу (POST/DELETE images), текст по Save (`PUT /links`); превью через `next/image`.
- **`components/admin/report/ReportValidatorBanner.tsx`** — Client: SSR-инициализация + refetch `GET /api/admin/report/validate`; человекочитаемые коды `MISSING_CONTENT`, `ORPHAN_CONTENT`, `NO_FINAL_QUESTION` и др.

**Архитектурное решение:** вместо granular CRUD концовок (`POST`/`DELETE /contents`) — комбинированный `PUT /history` (концовок всегда ровно 2 с фиксированными ключами, только редактирование).

**Out of scope (Phase 17):** игровой рендеринг истории/ссылок игроку; защита от удаления вопроса-указателя в UI «Вопросов» (`onDelete: SetNull` уже снимает риск битой ссылки).

---

## 2026-06-19 — Phase 16 / Таск 2 — CRUD контрольных вопросов (API + UI)

**Сделано:**

- Реализован **Phase 16, Таск 2** — полный CRUD контрольных вопросов финального отчёта: REST API, страница `/admin/report`, таблица с переупорядочиванием, форма создания/редактирования.

**API** (созданы, защита через `adminAuth` → 403):
- **`app/api/admin/report/questions/route.ts`** — `GET` (список по `orderIndex`, `correctOption` в ответе допустим для admin); `POST` (Zod `createQuestionSchema`, 201 + `INDEX_TAKEN` при P2002).
- **`app/api/admin/report/questions/[id]/route.ts`** — `PATCH` (partial update, merge + re-validate; запрет `orderIndex` в теле; 404 `NOT_FOUND`); `DELETE` (404 если не найден).
- **`app/api/admin/report/questions/reorder/route.ts`** — `POST` (Zod `reorderQuestionsSchema`; атомарный swap через `$transaction` с временными отрицательными индексами; возвращает обновлённый список).

**UI** (созданы):
- **`app/(admin)/admin/report/page.tsx`** — Server Component: SSR-список вопросов из Prisma → `QuestionsTable`.
- **`components/admin/report/QuestionsTable.tsx`** — Client: таблица (№, вопрос, 4 варианта с иконкой ✓ на правильном), кнопки ↑/↓ / редактировать / удалить, «Добавить» внизу; refetch после save/delete/reorder; блокировка удаления финального вопроса.
- **`components/admin/report/QuestionForm.tsx`** — Client: react-hook-form + Zod; режимы create (Отменить/Сохранить) и edit (Сохранить/Удалить); textarea + 4 инпута + дропдаун «Верный ответ»; заметка «Финальный вопрос нельзя удалить» в edit.
- **`components/admin/report/QuestionsReorderControl.tsx`** — Client: кнопки ↑/↓ по паттерну `HintsReorderControl`; swap соседних `orderIndex` через reorder API.

**Типы и утилиты** (созданы):
- **`types/admin-report.ts`** — `QuestionListItem`, `QuestionDetail`.
- **`lib/final-report/isFinalChoiceQuestion.ts`** — определяет вопрос с вариантами «Обвинить / Защитить» по `REPORT_FINAL_CHOICES`; удаление такого вопроса запрещено в UI.

**Навигация:**
- **`components/admin/layout/AdminNav.tsx`** — пункт «Финальный отчет» с подпунктами (Вопросы / История / Ссылки).

**Проверки:** `npm run type-check` — зелёный.

**Out of scope (следующий таск):** концовки (`FinalReportContent`), баннер-валидатор `ReportValidatorBanner`, игровая часть (Phase 17).

---

## 2026-06-19 — Phase 16 / Таск 1 — Синхронизация доков + серверная база финального отчёта

**Сделано:**

- Реализован **Phase 16, Таск 1** — документация приведена к новой модели финального отчёта; серверная база для админки: константы выбора, Zod-схемы, валидатор конфигурации, защищённый эндпоинт, идемпотентный сидер вопросов.

**Документация** (обновлена):
- **`.docs/modules/final-report.md`** — переписан под новую модель: одиночный триггер `detectiveFinished`, выбор «Обвинить / Защитить» в форме отчёта, процент только по `FinalReportQuestion`, концовка по `finalChoice` из `POST /submit`; валидатор сверяет `FinalReportContent` с `REPORT_FINAL_CHOICES` без обращения к чату Марины / `ChatScript`.
- **`.docs/prd.md`** §11 — убран «двойной триггер» и `ChatState.finalChoice` как источник выбора концовки.
- **`.docs/database.md`** — описание `FinalReportContent` синхронизировано: `finalChoiceValue` из `REPORT_FINAL_CHOICES`, выбор приходит в теле `POST /submit`.

**`constants/reportFinalChoices.ts`** (создан):
- `REPORT_FINAL_CHOICES` (`ACCUSE` / `PROTECT`) и тип `ReportFinalChoiceValue` — единый источник правды для выбора концовки.

**`lib/validations/admin-report.ts`** (создан):
- 5 Zod-схем для Тасков 2–3: `createQuestionSchema`, `updateQuestionSchema`, `reorderQuestionsSchema`, `createContentSchema`, `updateContentSchema`.
- Типы через `z.infer` / `z.input`; `correctOption` валидируется в диапазоне `0..options.length-1`.

**`lib/final-report/validate.ts`** (создан):
- `validateReportConfig()` — проверка покрытия (`MISSING_CONTENT`), orphan-записей (`ORPHAN_CONTENT`) и UPPERCASE-конвенции (`NOT_UPPERCASE`); без обращения к чату.

**`app/api/admin/report/validate/route.ts`** (создан):
- `GET` — защита через `adminAuth`, ответ `{ isValid, issues }`; `try/catch` на ошибки Prisma → 500 `INTERNAL_ERROR`.

**`prisma/seed.ts`** (обновлён):
- `seedFinalReportQuestion()` — 3 нейтральные заглушки; идемпотентность через count-check (как `seedFinalReportContent`); вызов в `main()` после `seedFinalReportContent()`.

**Проверки:** `npm run type-check` и `npm run build` — зелёные.

**Out of scope (следующие таски):** UI `/admin/report`, CRUD API вопросов/концовок, баннер-валидатор, игровая часть (Phase 17).

---

## 2026-06-14 — Phase 15 / Таск 4 — UI финалы RDP + жизненный цикл окна сценария 1

**Сделано:**

- Реализован **Phase 15, Таск 4** — сюжетные финалы обоих сценариев RDP-миссии, завершение через `/complete` и гейтинг кнопки «Закрыть» (✕) в сценарии 1.

**`SessionLostModal.tsx`** (создан):
- Финалка сц.1 «Ошибка / Два активных сеанса» (ref-7/8): Windows 11-style синяя карточка, сворачиваемый блок «Подробнее».
- Копируемый `nextIp` через `navigator.clipboard` (паттерн как в `FolderPasswordPrompt`); feedback «скопировано» на 2 сек.
- «Закрыть» → `onClose` (вызывает `/complete` наверх); `isLoading` + completing overlay в `WindowsSimulation`.
- a11y: `role="dialog"`, `aria-modal`, `aria-label`, `aria-live`, `aria-expanded` на «Подробнее».

**`SessionTerminatedModal.tsx`** (создан):
- Финалка сц.2 «Сеанс прерван»: тёмная карточка, предупреждающая иконка, описание разрыва соединения.
- «Закрыть» → `onClose`; показывается сразу при `triggerActivated` + `session_terminated`.

**`WindowsSimulation.tsx`** (обновлён):
- Стейт `nextIp` из ответов `POST /file-viewed` и `GET /files`.
- Стадия `triggered`: сц.2 → `SessionTerminatedModal` сразу; сц.1 → плашка «Соединение разорвано» → клик → `SessionLostModal`.
- `handleComplete`: `fetchWithVersion('/complete', { expectedVersion: version })`; 409 → тост + рефетч `/files`; success → `onCompleted()`.
- Новый проп `onUnlockedCountChange(count)` — сообщает панели число разблокированных папок после `GET /files` и unlock.
- Seam `onTriggered` заменён на `onCompleted`.

**`RdpGamePanel.tsx`** (обновлён):
- Стейт `unlockedCount`; кнопка «Закрыть» (✕) скрыта при `rdpScenario === 1 && unlockedCount === 0`; «Свернуть» доступна всегда на стадии `files`.
- `handleCompleted` → `setStage('completed')` + `refreshLogs()` / `refreshChat()` → `RdpCompletedView`.

**Сервер — точечная правка `nextIp`:**
- **`types/rdp.ts`**: `RdpFileViewedResult.nextIp?`, `RdpFilesResult.nextIp?`.
- **`lib/rdp/service.ts`**: `nextIp` в outcome SUCCESS для `handleFileViewed` (сц.1, уже вычисленный в транзакции) и `getFiles` (только при `triggerActivated && rdpScenario === 1`, lookup `nextRdpSlotKey → correctIp`, fallback `'—'`); в select `getFiles` добавлены `rdpScenario`, `nextRdpSlotKey`.
- **`app/api/missions/rdp/[slotKey]/file-viewed/route.ts`**: `nextIp` в JSON SUCCESS, если задан.
- **`app/api/missions/rdp/[slotKey]/files/route.ts`**: `nextIp` в JSON SUCCESS, если задан.

**Проверки:** `npm run type-check` и `npm run build` — зелёные.

---

## 2026-06-14 — Phase 15 / Таск 3 — UI «Симуляция Windows» RDP: просмотр файлов + разблокировка папок

**Сделано:**

- Реализован **Phase 15, Таск 3** — клиентская «симуляция рабочего стола Windows» миссии RDP (стадия `files`).

**`WindowsSimulation.tsx`** (создан):
- Оркестратор стадии `files`: фон рабочего стола (`desctop_windows_bg.jpg`), иконки папок из `GET /files`, оконный менеджер с z-порядком.
- Состояние: `version`, `folders`, `openWindows`, `stage` (`loading | browsing | triggered | error`).
- Восстановление при reopen: если `completed` — передаёт управление в `RdpCompletedView`; если `triggerActivated && !completed` — переходит в стадию `triggered`; `scenarioFinal` выводится из `rdpScenario` без серверных правок.
- Optimistic unlocking: папка помечается открытой сразу, `version` фиксируется из ответа сервера; откат + рефетч `GET /files` на ошибке/409.
- `/file-viewed` — ожидает ответ сервера; при `triggered=true` вызывает `onTriggered(scenarioFinal, version)` вверх в `RdpGamePanel`.
- 409 на любой мутации — тост + рефетч `/files` (через `fetchWithVersion`).

**`FolderIcon.tsx`** (создан):
- Иконка папки на рабочем столе: `folder.png` (открытая) / `folder_close.png` (запароленная, с бейджем 🔒).
- Двойной клик: открытая → окно проводника; запароленная → попап пароля.

**`FolderContent.tsx`** (создан):
- Оконный «проводник» с тайтлбаром (свернуть / развернуть / закрыть), хлебными крошками (`Этот компьютер › Рабочий стол › <папка>`), левым сайдбаром (Этот компьютер / Рабочий стол / Загрузки / Документы), контентом с иконками подпапок и документов.
- Клик по документу (`url !== null`) → открывает `PdfViewer`; `url === null` (запароленная неразблокированная папка) — окно не открывается.

**`FolderPasswordPrompt.tsx`** (создан):
- Попап «Введите пароль»: поле ввода + кнопка «Вход»; ошибка `INVALID_PASSWORD` → «Неверный пароль» под полем.
- Строка `folderPath` с кнопкой копирования (`navigator.clipboard`).
- Ссылка «Забыли пароль?» → инлайн-попап с инструкцией (статический, без отдельного файла).
- Вызов `POST /unlock-folder` через `fetchWithVersion`; коллбэк обновления `version`/`folders` в `WindowsSimulation`.

**`PdfViewer.tsx`** (создан):
- Окно-просмотрщик «Скан» по `url` из S3 (`<iframe>`).
- При закрытии окна — `POST /file-viewed` (await); возвращает `triggered`/`scenarioFinal`/`version` наверх.
- Повторный просмотр уже просмотренного файла безопасен (сервер дедуплицирует).

**`RdpGamePanel.tsx`** (обновлён):
- Стадия `solvedPlaceholder` заменена на `files` — рендерит `<WindowsSimulation>`.
- `handleSolved` → переводит в `files`; `loadState` — files-first restore (сначала `GET /files`, при `400 PUZZLE_NOT_SOLVED` — fallback на `GET /puzzle-state`).
- Добавлен seam-callback `onTriggered(scenarioFinal, version)` для Таска 4.
- Импорт `RdpSolvedPlaceholder` удалён.

**`RdpSolvedPlaceholder.tsx`** (удалён):
- Файл-заглушка удалён как мёртвый код.

---

## 2026-06-14 — Phase 15 / Таск 2 — Серверный триггер RDP: `/file-viewed` + `/complete`

**Сделано:**

- Реализован **Phase 15, Таск 2** — серверная триггер-логика миссии RDP: регистрация просмотра PDF и финальное завершение миссии.

**`lib/rdp/service.ts`** (расширен):
- `handleFileViewed(userId, slotKey, fileId, expectedVersion)` — порядок: `puzzleSolved` guard → ранний идемпотентный возврат при `completed || triggerActivated` (до сверки версии, чтобы устаревшая вкладка не получала ложный 409) → версия → `fileId` в слоте → доступность папки. Дозапись `fileId` без дублей. При просмотре **всех** файлов слота — одна атомарная транзакция: сц.1 (`RDP_VICTOR`) → лог `rdp_session_lost` с `{nextIp}` (из связанного `nextRdpSlotKey`), `triggerActivated=true`; сц.2 (`RDP_MARINA`) → `upsert GameProgress.marinaTriggered=true` + `advanceTriggerListeners(tx, 'rdp_marina_triggered')`. P2025 → 409 на обоих путях.
- `handleComplete(userId, slotKey, expectedVersion)` — идемпотентность по `completed`; guard `triggerActivated`; гвардед-транзакция: `completed=true, completedAt`, 2 лога (`rdp_completed` + `mission_completed_overview`), `advanceTriggerListeners(tx, 'rdp_completed:<slotKey>')`. P2025 → 409.
- Outcome-типы: `RdpFileViewedOutcome`, `RdpCompleteOutcome`.

**`lib/validations/missions.ts`** (расширен):
- `rdpFileViewedSchema` (`fileId: string.min(1)`, `expectedVersion`) + `RdpFileViewedInput`.
- `rdpCompleteSchema` (`expectedVersion`) + `RdpCompleteInput`.

**`types/rdp.ts`** (расширен):
- `RdpScenarioFinal = 'session_lost' | 'session_terminated'`.
- `RdpFileViewedResult` (`triggered`, `alreadyTriggered?`, `scenarioFinal?`, `version`).
- `RdpCompleteResult` (`success: true`, `version`).

**`constants/gameConfig.ts`** (расширен):
- `RDP_FILE_VIEWED_RATE_LIMIT = 60`, `RDP_COMPLETE_RATE_LIMIT = 5`.

**`app/api/missions/rdp/[slotKey]/file-viewed/route.ts`** (создан):
- `POST`, Player-only; rate limit 60/мин; Zod; маппинг включая 409 `CONFLICT` + `currentVersion`; exhaustive switch.

**`app/api/missions/rdp/[slotKey]/complete/route.ts`** (создан):
- `POST`, Player-only; rate limit 5/мин; Zod; маппинг включая 409 `CONFLICT` + `currentVersion`; exhaustive switch.

---

## 2026-06-14 — Phase 15 / Таск 1 — Серверная база RDP: `/files` + `/unlock-folder`

**Сделано:**

- Реализован **Phase 15, Таск 1** — серверная база миссии RDP (симуляция Windows): два новых API-роута и расширение сервиса.

**`lib/rdp/service.ts`** (расширен):
- `RdpMetadata` дополнен полями `viewedFileIds: string[]` и `unlockedFolders: string[]`; `parseMetadata` возвращает дефолт `[]` для обоих — фикс латентного бага (старый `MissionProgress` без полей не падает при обращении к массиву).
- `getFiles(userId, slotKey)` — guard `puzzleSolved=true`; группировка `RdpFile` по папкам; `isLocked`/`isUnlocked`; `url=null` для файлов запароленной неразблокированной папки; `folderPath` для запароленных папок (из связанного Decipher-слота по `unlocksRdpFolder`+`unlocksRdpSlotKey`) — для окна ввода пароля; возвращает `version`, `triggerActivated`, `completed`.
- `unlockFolder(userId, slotKey, folderName, password, expectedVersion)` — поиск Decipher-слота по трём FK; guard `folderExists`/`isLocked`; идемпотентность (повторная разблокировка пишет лог без дублирования в массиве); guarded-транзакция с P2025 → 409; лог `rdp_folder_unlocked`.
- Outcome-типы: `RdpFilesOutcome`, `RdpUnlockOutcome`.

**`lib/validations/missions.ts`** (расширен):
- `rdpUnlockFolderSchema` (`folderName`, `password`, `expectedVersion`) + `RdpUnlockFolderInput`.

**`types/rdp.ts`** (расширен):
- `RdpFileView`, `RdpFolderView` (`folderName`, `isLocked`, `isUnlocked`, `folderPath?`, `files[]`), `RdpFilesResult`, `RdpUnlockResult`.

**`constants/logTemplates.ts`** (правка):
- Текст `rdp_puzzle_solved` выровнен: «Доступ к удалённому компьютеру ({logSubjectName}) предоставлен».

**`constants/gameConfig.ts`** (расширен):
- `RDP_UNLOCK_FOLDER_RATE_LIMIT = 10`.

**`app/api/missions/rdp/[slotKey]/files/route.ts`** (создан):
- `GET`, Player-only (`auth()` + проверка роли); маппинг `RdpFilesOutcome` → HTTP.

**`app/api/missions/rdp/[slotKey]/unlock-folder/route.ts`** (создан):
- `POST`, Player-only; rate limit 10/мин на `(userId, slotKey)`; Zod-валидация; маппинг включая 409 `CONFLICT` + `currentVersion`.

---

## 2026-06-13 — Phase 14 / Таск 4 — UI пазла (DOM/CSS Grid) + RdpModal + интеграция

**Сделано:**

- Реализован **Phase 14, Task 4 — игровой UI миссии RDP**: пазл-трубопровод поверх готового API (Таск 3). Лаунчер принимает IP, открывается окно/панель с пазлом. Плитки поворачиваются оптимистично; проверка решения — авто. Сценарий 2: таймер, оверлей «Доступ запрещён», кнопка «Пропустить» при `canSkip`.

**`types/rdp.ts`** (создан):
- Клиентские интерфейсы ответов API: `RdpConnectResult`, `RdpPuzzleState`, `RdpRotateResult`, `RdpCheckPuzzleResult`, `RdpTimerExpiredResult`, `RdpSkipResult`. Тип `RdpScenario = 1 | 2`. Переиспользуют `PuzzleField` из `lib/rdp/types.ts`.

**`lib/rdp/connectivity.ts`** (создан, client-safe):
- `computePuzzleProgress(field): number` — BFS от всех `entry`-плиток по совпадающим коннекторам; метрика = достижимые непустые / все непустые плитки (0–1).
- `isLocallySolved(field): boolean` — 100% достижимость + все `exits` достижимы. Единственный клиентский источник правды о «локальном решении» перед вызовом `/check-puzzle`.

**`components/game/rdp/PipeTile.tsx`** (создан):
- `<button>` с `aria-label`; SVG-трубы через `PIPE_PATH` для `STRAIGHT`, `CORNER`, `TEE`, `CROSS`, `EMPTY`. Геометрия: линии от центра (50,50) к серединам граней — трубы соседних плиток стыкуются ровно по середине общей границы без разрывов. `transform: rotate(${rotation}deg)` + `transition` для анимации. Заблокированные плитки (`isLocked`) визуально выделены (`text-accent`), не кликабельны, `aria-disabled`.

**`components/game/rdp/PipeTimer.tsx`** (создан):
- Обратный отсчёт для сц.2. Принимает `timerStartedAt`/`timerSeconds` — вычисляет `timerRemaining` на клиенте (устойчиво к рефетчу). Формат `MM:SS`; cyan → red при ≤ 30 сек. Колбэк `onExpire` при достижении 0.

**`components/game/rdp/PipesPuzzle.tsx`** (создан):
- CSS Grid `gridSize×gridSize` с плитками `64×64px`, gap `4px`. Оптимистичный поворот (+90° mod 360°) → `fetchWithVersion(/rotate-tile)`; 409 → `onLoadState` (рефетч); ошибка → откат. Авто-проверка через `/check-puzzle` при `isLocallySolved` (защита от параллельных вызовов через `checkingRef`). `busy`-флаг блокирует параллельные повороты. Progress-bar внизу: `computePuzzleProgress` → ширина полосы + `%` в тексте. Таймер и `RdpSkipButton` — только при сц.2. `RdpAccessDeniedOverlay` при `showDeniedOverlay`. `handleRestart` → `/timer-expired` → новое поле + рестарт таймера. Логи рефрешатся после перегенерации.

**`components/game/rdp/RdpAccessDeniedOverlay.tsx`** (создан):
- Абсолютно-позиционированный оверлей поверх пазла (`role="alert"`). Кнопка «Начать заново» → `onRestart`; кнопка «Пропустить» (при `canSkip`) → `onSkip`. Стилизован под референс `error.jpg` (красный заголовок «Доступ запрещён»).

**`components/game/rdp/RdpSkipButton.tsx`** (создан):
- Кнопка «Пропустить» без подтверждения (открывает `RdpSkipConfirmModal` через проп-обёртку).

**`components/game/rdp/RdpSkipConfirmModal.tsx`** (создан):
- Диалог подтверждения (`role="dialog"`, ESC/Отмена/кнопка подтверждения). `POST /skip` → стадия `completed` + `refreshLogs()` + `refreshChat()`. Обработка 400 `CANNOT_SKIP`/`SKIP_NOT_ALLOWED_SCENARIO_1` через тост.

**`components/game/rdp/RdpHintButton.tsx`** (создан):
- Кнопка «ⓘ» по паттерну `CrackHintButton`. При `hintText === null` — скрыта.

**`components/game/rdp/RdpSolvedPlaceholder.tsx`** (создан):
- Заглушка «Доступ получен. Раздел в разработке» (Phase 15 — Windows-симуляция). Кнопка закрытия.

**`components/game/rdp/RdpCompletedView.tsx`** (создан):
- Финальный экран для `isCompleted=true` из `/connect` и после успешного `/skip`. Показывает `displayName` слота. Кнопка закрытия.

**`components/game/rdp/RdpModal.tsx`** (создан):
- Full-screen overlay (`fixed inset-0`, `role="dialog"`, ESC-закрытие). Шапка по референсу: иконка-щит + «Удалённый доступ» + `displayName` + декоративная `////`-полоса + `RdpHintButton` + кнопка закрытия. Стейт-машина: `loading → error | puzzle | solvedPlaceholder | completed`. `loadState` при монтировании (`GET /puzzle-state`); `isCompleted=true` → сразу `completed`. `handleSolved` / `handleSkip` обновляют логи и чат после завершения.

**`components/game/rdp/RdpGamePanel.tsx`** (создан):
- Вариант без overlay — встроенная панель (`<article>`) с аналогичной логикой. Тот же набор стадий и обработчиков, что `RdpModal`. Используется в лаунчере как inline-представление вместо модального окна.

**Интеграция (измененные файлы):**
- `components/game/MissionCard.tsx` — `RdpForm` активирована: `POST /connect`, 400 `INVALID_IP` → «IP не распознан», 429 → «Слишком много попыток»; результат пробрасывается через `onRdpLaunched`.
- `components/game/DashboardClient.tsx` — состояние `activeRdpConnect` (slotKey + connect-данные); рендер `RdpModal`/`RdpGamePanel`; проброс `onRdpLaunched` в `MissionCard`.

**Зафиксированные расхождения с TASK.md:**
- `RdpModal` и `RdpGamePanel` существуют как два отдельных компонента (модальное и inline-представление). В TASK.md был описан только `RdpModal`.
- Двухцветная раскраска путей сц.2 (magenta) — не реализована (серверный секрет, API не отдаёт `solution`). Все трубы — `accent`. Расхождение с референсом зафиксировано, пересмотр после демо заказчику.

**Out of scope (→ Phase 15):** Windows-симуляция (`/files`, `/unlock-folder`, `/complete`), `SessionLostModal`/`SessionTerminatedModal`, UI-инвариант «без кнопки закрыть» для сц.1.

---

## 2026-06-12 — Phase 14 / Таск 3 — API RDP + Zod + optimistic locking

**Сделано:**

- Реализован **Phase 14, Task 3 — серверный флоу пазла RDP**: 6 API-роутов + сервисный слой с optimistic locking, Zod-валидацией и защитой секретов.

**`lib/validations/missions.ts`** (расширен):
- Добавлены `rdpRotateTileSchema` (`tileId`, `expectedVersion`), `rdpCheckPuzzleSchema` (`expectedVersion`), `rdpTimerExpiredSchema` (`expectedVersion`), `rdpSkipSchema` (`expectedVersion?`). `/connect` переиспользует готовую `rdpLaunchSchema`.

**`constants/gameConfig.ts`** (расширен):
- `RDP_CONNECT_RATE_LIMIT = 10`.

**`lib/rdp/service.ts`** (создан, `server-only`):
- Паттерн по образцу `decipher/service.ts`: `parseMetadata`/`metadataToJson`, discriminated-union outcome-типы, транзакции через `$transaction`.
- `handleConnect` — поиск слота по `correctIp + missionType='RDP' + isActive`; промах → лог `rdp_invalid_ip` + `INVALID_IP`; `correctIp` не включён в `SUCCESS`.
- `getOrCreatePuzzleState` — upsert `MissionProgress`, генерирует `puzzleField` при отсутствии; для сц.2 — `timerStartedAt`, поля таймера в ответе; для сц.1 — поля таймера отсутствуют (не null, а omit).
- `rotateTile` — поворот +90° mod 360° (`ROTATION_CYCLE`); двойной optimistic locking: early check `version !== expectedVersion` → `CONFLICT` + `P2025` catch → `CONFLICT`.
- `checkPuzzle` — `checkSolution` из ядра; при успехе — транзакция (`metadata.puzzleSolved=true` + лог `rdp_puzzle_solved`); идемпотентность: если `puzzleSolved` уже `true` — ранний возврат без повторной записи.
- `handleTimerExpired` — guard `rdpScenario===2`; проверка реальности истечения с запасом 1 сек; перегенерация поля + инкремент `timerExpiredCount`; лог `rdp_timer_expired`; `canSkip = timerExpiredCount >= 2`.
- `handleSkip` — guard сц.2 + `timerExpiredCount >= 2`; идемпотентность через `progress.completed`; единая транзакция: `MissionProgress(completed, metadata.skipped/triggerActivated, version++)` + `GameProgress(marinaTriggered=true, version++)` + 2 лога + оба `advanceTriggerListeners(tx, ...)` (атомарность).

**API-роуты** (созданы):
- `rdp/connect/route.ts` — rate limit 10/мин на userId.
- `rdp/[slotKey]/puzzle-state/route.ts` — GET, без тела, без Zod (GET).
- `rdp/[slotKey]/rotate-tile/route.ts` — 409 при конфликте с `currentVersion`.
- `rdp/[slotKey]/check-puzzle/route.ts` — 409 при конфликте.
- `rdp/[slotKey]/timer-expired/route.ts` — 400 `TIMER_NOT_EXPIRED` при досрочном вызове; 400 `NOT_SCENARIO_2` для сц.1.
- `rdp/[slotKey]/skip/route.ts` — тело парсится мягко (`catch → body = {}`), т.к. `expectedVersion` опционален.

**Исправлено после DoD-ревью:**
- Убран мёртвый вариант `SLOT_NOT_FOUND` из `RdpConnectOutcome` (никогда не возвращался `handleConnect`).
- Поля таймера в `RdpPuzzleStateOutcome.SUCCESS` — `?: number / ?: string` (опциональные), не `null`; для сц.1 физически отсутствуют в JSON-ответе.

**Проверки:** линтер чист, нет `any`, нет неиспользуемых импортов. `type-check` и `build` — ручная проверка перед коммитом.

**Out of scope (→ Task 4):** весь UI (RdpModal, PipesPuzzle, PipeTile, PipeTimer, RdpSkipButton и др.), rdpStore.

---

## 2026-06-12 — Phase 14 / Таск 2 — Генератор + solver Pipes (чистое ядро)

**Сделано:**

- Реализован **Phase 14, Task 2 — Генератор + solver Pipes** (чистый серверный TS, без DOM/БД/сети).

**`lib/rdp/pipesSolver.ts`** (создан):
- `checkSolution(field): boolean` — BFS от каждого `entry` до парного `exit` через встречные коннекторы (восток ↔ запад, юг ↔ север); коннектор «в стену» соединением не считается. Для сц.2 проверяются обе пары независимо → «ложная пара» (entry достигает только чужого exit) даёт `false`.
- `getTileConnectors(type, rotation)` — тонкая обёртка над `TILE_CONNECTORS` (единственный способ читать коннекторы в ядре).

**`lib/rdp/pipesPuzzleGenerator.ts`** (создан):
- `generateField(gridSize, scenario, seed?)` — публичный API. Возвращает `PuzzleField` **без поля solution** (правильная ориентация — серверный секрет).
- Принцип `solvable-by-construction`: укладка путей → вывод типов плиток из коннекторов соседей → `EMPTY` для остального → перемешивание только `rotation`.
- Endpoint'ы — `STRAIGHT` с коннектором «наружу» (`OPPOSITE[inward]`, у углов всегда за границей), `isLocked=true`. Внутренние клетки пути — кликабельные; не-путевые — `EMPTY`, `isLocked=true`.
- Укладка путей: рандомизированный DFS с тягой к цели + backtracking + **прунинг по связности** (если цель уже отрезана через свободные клетки — ветка отсекается). Без прунинга DFS на 7×7 уходил в экспоненту (скрипт висел >2 мин) → после правки ~3.5с. Защиты: бюджет шагов, retry-лимит на укладку, fallback-перегенерация поля, явный `throw` при исчерпании (не зависание).
- `shuffleRotations` с guard'ом через сам `checkSolution` → корректно обрабатывает симметрию `STRAIGHT` (0≡180, 90≡270).
- Детерминизм при заданном `seed` (mulberry32) — для воспроизводимых прогонов. Внутренние хелперы `buildSolvedField` / `shuffleRotations` экспортированы только для верификации.

**`scripts/rdp-generator-check.ts`** (создан, остаётся в репо):
- 11 групп проверок по DoD: решаемость `buildSolvedField` (1000×), форма `generateField` (нет solution, `tiles.length`), «не решён на старте» (1000×), guard симметрии STRAIGHT, вершинная непересекаемость путей сц.2 (1000×), негативы (`rotate-all-90 → false`, ложная пара → false, коннектор в стену → false), JSON round-trip, детерминизм при seed.
- Прогон: `OK`, exit 0, ~3.5с.

**Изменено `lib/rdp/types.ts`** (минимально, по необходимости):
- ⚠️ **Исправлено противоречие из Task 1.** Зафиксированные `SCENARIO_ENDPOINTS[2]` диагонали `TL→BR`/`TR→BL` **математически несовместимы** с «вершинно-непересекающиеся пути без CROSS» (теорема Жордана: чередующиеся хорды обязаны пересечься, а пересечение требует плитки степени 4 = `CROSS`, запрещённой в MVP). Поменян порядок `exits` сц.2 на пары `TL→BL` и `TR→BR` (вертикальные коридоры) — не чередуются → непересекающиеся пути существуют без `CROSS`. Решение подтверждено пользователем.
- Добавлен алиас `Scenario = 1 | 2`.
- **Для Task 3:** пары сц.2 теперь «лево-к-лево / право-к-право», НЕ диагонали.

**Проверки:** `npm run type-check` зелёный, `npm run build` зелёный, скрипт `OK`, линтер чист, нет `any`.

**Out of scope (→ Task 3):** API-роуты RDP, Zod-схемы, запись в `MissionProgress.metadata`, optimistic locking, таймер/skip/триггеры.

---

## 2026-06-12 — Phase 14 / Таск 1 — Research + конвенция поворотов + прототип

**Сделано:**

- Реализован **Phase 14, Task 1 — Research + решение по рендеру + прототип-доказательство**.

**`lib/rdp/types.ts`** (создан):
- Финальные типы ядра пазла: `Direction`, `TileType`, `TileRotation`, `Tile`, `GridPosition`, `PuzzleField`.
- `TILE_CONNECTORS` — единственный источник правды для конвенции поворотов (все 4 поворота для `STRAIGHT`/`CORNER`/`TEE`, чтобы `+90°` по модулю 360° всегда был валиден). `CROSS` оставлен в union, но помечен «не используется в MVP».
- `SCENARIO_ENDPOINTS` — зафиксированы координаты entry/exit: сц.1 (6×6) `{0,0}→{5,5}`; сц.2 (7×7) два пути `{0,0}→{6,6}` и `{0,6}→{6,0}`. Это разблокирует Task 2.
- Только типы и константы, без runtime-зависимостей. `type-check` зелёный, нет `any`.

**`scripts/rdp-prototype.ts`** (throwaway, удалён после проверки):
- Мини-генератор 6×6: рандомизированный DFS с backtracking + retry-лимит 100 → вывод типов плиток из соседей по пути → не-path в `EMPTY` → shuffle поворотов с guard'ом.
- Мини-solver `checkSolution`: BFS от entry до exit через `TILE_CONNECTORS` с проверкой взаимного соединения соседей.
- Результат прогона: `100/100` solved-полей решаемы, `100/100` перемешанных нерешаемы; негативы — `rotate-all-90 → false`, retry-лимит → `Error('Generation failed after 100 retries')` (без зависания).

**Решение (Research):**
- Подтверждено решение фазы: подходящей npm-либы под «серверный solvable-генератор + наши типы `Tile`/`PuzzleField` + хранение поля на сервере» нет → **собственная реализация ядра**. Рендер — **DOM + CSS Grid** (`<button>` + `transform: rotate()`); PIXI/Canvas — оверкилл.
- Конвенция поворотов задокументирована в `lib/rdp/types.ts` и подтверждена прототипом (нет разрывов типы↔алгоритм).

**Out of scope (→ Task 2):** полные `pipesPuzzleGenerator.ts` / `pipesSolver.ts`, два вершинно-непересекающихся пути (сц.2).

---

## 2026-06-12 — Phase 13 / Таск 2 — UI страницы /admin/files

**Сделано:**

- Реализован **Phase 13, Task 2 — UI управления файлами RDP** (`/admin/files`).

**`app/(admin)/admin/files/page.tsx`** (создан):
- Server Component. Два Prisma-запроса: RDP-слоты с файлами + Decipher-слоты для маппинга паролей к папкам.
- Строит `FolderPasswordMap` (`"slotKey::folder"` → `folderPassword | null`), сериализует и передаёт в `FilesPageClient`.

**`app/(admin)/admin/files/loading.tsx`** (создан):
- Скелет на базе `AdminPageSkeleton`.

**`types/admin-files.ts`** (создан):
- Интерфейсы `RdpFileItem`, `RdpSlotData`, `RdpFolderGroup`, тип `FolderPasswordMap`.

**`components/admin/files/FilesPageClient.tsx`** (создан):
- Client Component. Держит стейт `openFolder`. `handleMutated` → `router.refresh()`. Вычисляет `modalFiles`, `modalIsLocked`, `modalPassword` из актуальных props перед передачей в `FolderModal`.

**`components/admin/files/FilesTable.tsx`** (создан):
- Плоская таблица файлов: №, Слот миссии, Папка (тёмный бейдж `<button>`), Файл (ссылка в новой вкладке). Пустое состояние «Файлы не загружены».

**`components/admin/files/FileUploadSection.tsx`** (создан):
- Drag-and-drop + file-picker. Выбор RDP-слота и папки (существующая или «Новая папка...»). Клиентская валидация MIME/размер без запроса. Маппинг серверных кодов ошибок → читаемый текст.

**`components/admin/files/FolderModal.tsx`** (создан):
- Модалка папки: disabled-поля Слот/Наименование/Пароль, `FolderLockToggle`, список файлов через `FileActions`, кнопка «Удалить папку» → `DeleteFolderDialog`.

**`components/admin/files/FolderLockToggle.tsx`** (создан):
- `<select>` Да/Нет → `PATCH /api/admin/files/folder/lock`. Показывает `Loader2` во время запроса, оптимистичный локальный стейт.

**`components/admin/files/FileActions.tsx`** (создан):
- Строка файла: idle / renaming / saving. Rename → `PATCH /api/admin/files/[id]`, кнопка Сохранить disabled при пустом имени. Delete → `DeleteFileDialog`.

**`components/admin/files/DeleteFileDialog.tsx`** (создан):
- Confirm-диалог удаления файла. `DELETE /api/admin/files/[id]` → `onDeleted()`.

**`components/admin/files/DeleteFolderDialog.tsx`** (создан):
- Confirm-диалог удаления папки с числом файлов. `DELETE /api/admin/files/folder` → закрыть модалку + `router.refresh()`.

**Фиксы по итогам DoD-ревью:**
- `loading.tsx` — добавлен `import React from 'react'` (отсутствовал при использовании `React.ReactElement` как типа).
- `FileActions.tsx` — удалено мёртвое состояние `'deleting'` из `RowState` (удаление шло через диалог).
- `npm run build` — ✅ зелёный (TypeScript 12.4s, 58 страниц).

---

## 2026-06-12 — Phase 13 / Таск 1 — S3-утилиты (фикс кириллицы) + Zod + API файлов RDP

**Сделано:**

- Реализован **Phase 13, Task 1 — серверный CRUD файлов RDP** (S3 + БД + Zod-валидация).

**`lib/s3.ts`** (изменён):
- `buildPublicUrl(key)` — каждый сегмент пути кодируется через `encodeURIComponent` (сохраняя `/`); ASCII-ключи (аудио чатов) — no-op, обратная совместимость не нарушена.
- `extractKeyFromUrl(url)` — после среза префикса сегменты декодируются через `decodeURIComponent`, возвращая сырой S3-ключ для `deleteObject`. Round-trip корректен для кириллицы и ASCII.

**`lib/validations/admin-files.ts`** (создан):
- `ALLOWED_PDF_MIME` + `MAX_PDF_SIZE_BYTES` (10 МБ) — именованные константы.
- `normalizeFilename(name)` — lowercase + пробелы → `_` (аналог из `admin-chats.ts`).
- `buildRdpFileKey(slotKey, folder, name)` → `pdf/rdp/{slotKey}/{folder}/{name}` (сырой ключ, без кодирования).
- Zod-схемы: `folderLockSchema`, `folderDeleteSchema`, `fileRenameSchema`.

**`app/api/admin/files/route.ts`** (создан):
- `POST` — загрузка PDF в RDP-слот. Порядок: ADMIN-guard → парсинг `formData` → проверка `missionType === 'RDP'` → MIME → размер → уникальность `(slotId, folder, normalizedName)` → наследование `isLocked` от папки (новая папка → `false`) → `putObject(rawKey)` → `rdpFile.create`. Сбой S3 → 502 `S3_ERROR`, строка в БД не создаётся.

**`app/api/admin/files/[id]/route.ts`** (создан):
- `GET` — детали файла (404 если не найден).
- `PATCH` — переименование только поля `name` через `fileRenameSchema`; `url`, `folder`, `slotId`, `isLocked` не меняются.
- `DELETE` — удаление строки `RdpFile` + best-effort `deleteObject(extractKeyFromUrl(url))` в try/catch.

**`app/api/admin/files/folder/lock/route.ts`** (создан):
- `PATCH` — атомарный toggle `isLocked` для всей папки через `rdpFile.updateMany`. Ответ: `{ count }`.

**`app/api/admin/files/folder/route.ts`** (создан):
- `DELETE` — `findMany` файлов папки → best-effort `deleteObject` по каждому → `deleteMany`. Ответ: `{ count }`.

**Ключевые решения:**
- Кириллица в S3-путях (`Шантаж`, `Маркова`) теперь корректно кодируется в публичных URL и декодируется при удалении.
- `isLocked` клиентом при загрузке не передаётся — только сервер наследует значение от папки.
- Запрет дубликата имени в папке: 400 `FILE_NAME_EXISTS` до обращения к S3.
- Все 5 эндпоинтов защищены ADMIN-сессией (defense in depth).
- Аудит не пишется — рутинные файловые операции (`admin.md` §6).

---

## 2026-06-10 — Phase 12 / Таск 1 — Алгоритмы шифров (Playfair + Vigenere)

**Сделано:**

- Реализован **Phase 12, Task 1 — чистые функции алгоритмов шифрования** (изолированы от БД и сети).

**`constants/russianAlphabet.ts`** (изоморфный):
- `ALPHABET_RU` — 32-буквенный русский алфавит (без Ё, Е=Ё).
- `ALPHABET_LEN = 32`.
- `normalizeRu(s)` — `toUpperCase().replace(/Ё/g, 'Е')`; переиспользуется в обоих шифрах.

**`lib/decipher/playfair.ts`**:
- `buildPlayfairTable(key)` — изоморфная, строит матрицу 6×6. Нормализует ключ, удаляет дубликаты, дописывает оставшиеся буквы алфавита. Ячейки 32..35 (строка 5, колонки 2–5) = `''`.
- `decipherPlayfair(encryptedWord, key)` — **только сервер**. Нормализует слово, проверяет чётность длины, применяет три правила попарно.
- Именованные ошибки: `PLAYFAIR_ODD_LENGTH` (нечётная длина), `PLAYFAIR_CHAR_NOT_FOUND` (буква не в алфавите), `PLAYFAIR_EMPTY_CELL` (результат любого из трёх правил — пустая ячейка; покрывает row-shift, col-shift и rectangle-case).

**`lib/decipher/vigenere.ts`**:
- `decipherVigenere(encryptedWord, key)` — **только сервер**. Формула: `(encIdx - keyIdx + 32) % 32` для каждой позиции.
- `getVigenereDigits(encryptedWord)` — изоморфная, возвращает 0-индексированные позиции букв (числа над символами в UI).
- Именованные ошибки: `VIGENERE_EMPTY_KEY` (пустой ключ после нормализации), `VIGENERE_INVALID_CHAR` (символ вне алфавита в слове или ключе).

**`types/decipher.ts`**:
- `DecipherState` — discriminated union `DecipherStateActive | DecipherStateCompleted`.
- `DecipherAttemptResult`, `DecipherCompleteResult` — контракты ответов API.
- `DecipherAttemptOutcome`, `DecipherCompleteOutcome`, `DecipherSkipOutcome` — дискриминируемые union'ы исходов сервисных функций (для Task 2).

**Зафиксированные решения:**
- Пустая ячейка как результат прямоугольного case Playfair технически возможна (например, Ю на (5,0) + партнёр не в строке 5/столбце 0 → `table[5][col>1]` = `''`) → `PLAYFAIR_EMPTY_CELL` бросается во всех трёх case'ах.
- Пустой ключ Vigenere: `i % 0` → NaN — добавлен guard `VIGENERE_EMPTY_KEY` (в исходном модуле не описан, выявлен анализом).
- `decipherPlayfair` / `decipherVigenere` — **не импортируются** ни в один `'use client'`-файл; `buildPlayfairTable` / `getVigenereDigits` — допустимо на клиенте.
- Обновлён `tsconfig.json` — добавлен алиас пути для `lib/decipher/`.
- Обновлён `.docs/modules/missions-decipher.md` — синхронизированы зафиксированные решения по `PLAYFAIR_EMPTY_CELL` (все три case), `VIGENERE_EMPTY_KEY` и барьеру серверных функций.

**Следующее:**

- Phase 12, Task 2: API миссии Decipher (`launch`, GET, `attempt`, `complete`, `skip`) + фикс `decipherLaunchSchema`.

**Проблемы / Заметки:**

- N/A

---

## 2026-06-10 — Phase 12 / Таск 2 — API миссии Decipher

**Сделано:**

- Реализован **Phase 12, Task 2 — полный серверный флоу миссии Decipher** (launch → GET → attempt → complete → skip).

**`lib/decipher/launch.ts`**:
- `findActiveDecipherSlot(folderPath, cipherKey)` — точное совпадение обоих полей (`DECIPHER` + `isActive`), регистрозависимо. Возвращает `{ slotKey, slotId }` или `null`. Не принимает `userId` — по образцу `lib/crack/launch.ts`.

**`lib/decipher/service.ts`**:
- `getDecipherState(userId, slotKey)` — возвращает публичные поля + `playfairTable` (PLAYFAIR) или `vigenereDigits` (VIGENERE); для завершённой миссии — `folderPassword` + `folderPath`. Расшифрованное слово никогда не возвращается.
- `applyDecipherAttempt(userId, slotKey, decryptedWord)` — сравнивает через `normalizeRu`; upsert `MissionProgress.metadata`; `failedAttemptsCount` инкрементируется при ошибке, сбрасывается в 0 при верном ответе. Исходы: `CORRECT | INCORRECT | SLOT_NOT_FOUND | BAD_SLOT_CONTENT`.
- `completeDecipher(userId, slotKey)` — предусловие `lastAttemptCorrect === true`; идемпотентен при `completed=true`.
- `skipDecipher(userId, slotKey)` — предусловие `failedAttemptsCount >= DECIPHER_SKIP_THRESHOLD (2)`; идемпотентен при `completed=true`.
- `finalizeDecipherMission` (приватная) — транзакция: UPDATE `MissionProgress` + два лога (`decipher_access_granted` + `mission_completed_overview`) + `advanceTriggerListeners(tx, userId, DECIPHER_COMPLETED(slotKey))` **внутри транзакции**.
- `parseMetadata` (локальная) — парсит `Prisma.JsonValue` → `{ lastAttemptCorrect, failedAttemptsCount, skipped }`.

**API Routes (все — тип `PLAYER`):**
- `POST /api/missions/decipher/launch` — rate limit 30/мин по `userId`; промах → лог `decipher_launch_failed` + 400 `INVALID_LAUNCH_DATA`; список валидных ключей клиенту не раскрывается.
- `GET /api/missions/decipher/[slotKey]` — состояние миссии (публичные поля + хелпер шифра).
- `POST /api/missions/decipher/[slotKey]/attempt` — rate limit 20/мин по `(userId, slotKey)`; ответ `{ isCorrect, canSkip }`.
- `POST /api/missions/decipher/[slotKey]/complete` — 400 `NOT_SOLVED` / 200 `{ success, folderPassword, folderPath }`.
- `POST /api/missions/decipher/[slotKey]/skip` — 400 `CANNOT_SKIP` / 200 `{ success, folderPassword, folderPath }`.

**`lib/validations/missions.ts`**:
- Добавлен `decipherAttemptSchema = { decryptedWord: z.string().min(1).max(50) }` (без `expectedVersion` — Решение A).
- `decipherLaunchSchema` **не изменена** — оба поля `{ folderPath, cipherKey }` остаются (финальное решение фазы, расходится со старым планом в `phase-12.md` п.2).

**`constants/gameConfig.ts`**:
- `DECIPHER_SKIP_THRESHOLD = 2`, `DECIPHER_ATTEMPT_RATE_LIMIT = 20`, `DECIPHER_LAUNCH_RATE_LIMIT = 30`.

**Зафиксированные решения:**
- Решение A: `expectedVersion` не применяется (см. `phase-12.md`); защита через бизнес-инварианты.
- Плохой контент слота → 500 `BAD_SLOT_CONTENT`/`INVALID_CIPHER_TYPE`, а не 400 и не стектрейс.
- `cipherKey` в launch-схеме оставлен (оба поля обязательны) — решение принято в TASK.md, расходится с формулировкой `phase-12.md` п.2 (обновлено в phase-12.md).
- `npm run build` ✅ зелёный, TypeScript без ошибок, все 5 эндпоинтов отображаются в роут-таблице.

**Следующее:**

- Phase 12, Task 3: UI миссии Decipher (`DecipherGamePanel` + компоненты).

**Проблемы / Заметки:**

- Оговорка по `ChatTransition.conditionValue`: ключи в БД могут содержать старые значения слотов (`decipher-1`/`decipher-2`) — чат не сдвинется при ручном тесте. Правка данных БД, не логики; проверить после фазы.

---

## 2026-06-10 — Phase 12 / Таск 3 — UI миссии Decipher

**Сделано:**

- Реализован **Phase 12, Task 3 — игровая панель Decipher**, встроенная в dashboard по образцу `CrackGamePanel`.

**Созданы компоненты (`components/game/decipher/`):**

- `DecipherGamePanel.tsx` — главный контейнер. Union-состояние `View` (loading / error / playing / completed). `useEffect` → GET `/api/missions/decipher/[slotKey]` → заполнение стейта. `handleSubmit` → `/attempt` → при `isCorrect` авто-вызов `/complete`. `handleSkip` → `/skip`. После завершения и пропуска — `Promise.all([refreshLogs(), refreshChat()])`.
- `PlayfairTable.tsx` — таблица 6×6 из `playfairTable: string[][]`. Пустые ячейки (`''`) — неактивный `<div>` с `border-white/20`; буквы — кликабельные кнопки (`onLetterClick?`). `role="grid"`, `aria-label`.
- `VigenereView.tsx` — зашифрованное слово с числами рядом с каждой буквой; `cipherKey` принимается в пропсах (используется вызывающей стороной для type-safety).
- `DecipherInput.tsx` — `react-hook-form` + `decipherAttemptSchema` (Zod, `z.string().min(1).max(50)`). `isError` → `border-semantic-error` + `role="alert"` «Неверно». `autoFocus`. Поддержка внешнего значения (`externalValue` / `onExternalChange`) для вставки букв из `PlayfairTable`.
- `DecipherCompletedView.tsx` — «Доступ предоставлен». Read-only input `folderPath` + `type="password"` input `folderPassword` + кнопка copy → тултип «скопировано» (`setTimeout 2000ms`, `aria-live="polite"`).
- `DecipherSkipButton.tsx` — кнопка «Пропустить миссию» → открывает `DecipherSkipConfirmModal`.
- `DecipherSkipConfirmModal.tsx` — модалка подтверждения, `Escape` → закрытие (при `!busy`), клик по оверлею → закрытие.
- `DecipherHintButton.tsx` — кнопка «?» → тултип с `hintText`, `aria-expanded`.

**Изменены:**

- `components/game/DashboardClient.tsx` — добавлен `activeDecipherSlotKey` state; рендер с приоритетом: `activeCrackSlotKey` → `activeDecipherSlotKey` → сетка карточек; `onDecipherLaunched={setActiveDecipherSlotKey}` передаётся в `MissionCard`.
- `components/game/MissionCard.tsx` — `DecipherForm` подключена к POST `/api/missions/decipher/launch`; 429 → «Слишком много попыток»; 400 → «Путь или ключ не распознаны»; 200 → `onLaunched(slotKey)`. `handleLaunched` ветвится по `missionType` между `onCrackLaunched` и `onDecipherLaunched`. `PLACEHOLDER_FORM_BY_TYPE` оставлен только для RDP.

**Зафиксированные решения:**

- `DecipherCipherText.tsx` не создаётся — зашифрованное слово рендерится как read-only input напрямую в `DecipherGamePanel` (левая колонка).
- `decipherPlayfair` / `decipherVigenere` не импортируются ни в один `'use client'`-файл — расшифровка строго серверная.
- `expectedVersion` / HTTP 409 не реализованы — Решение A (идемпотентные инварианты вместо OCC).
- TypeScript-ошибка устранена: `cipherKey` передаётся в `VigenereView` из `DecipherGamePanel`.

**Следующее:**

- Phase 12 завершена. Следующая: Phase 13 — Админка: файлы RDP.

**Проблемы / Заметки:**

- Оговорка сохраняется: ключи `decipher_*` в `ChatTransition.conditionValue` могут содержать старые значения — чат не сдвинется при ручном тесте. Правка данных БД, не логики; проверить отдельной задачей.

---

## 2026-06-08 — Phase 11 / Полная фаза (Таски 1–4)

**Сделано:**

- Реализована **Phase 11 — Миссия Crack** целиком (Wordle-механика на 5-буквенных русских словах).

**Таск 1 — Алгоритмы, словник, чистые функции:**
- Создан `constants/wordList5letters.ts` — ~230 русских 5-буквенных слов, UPPERCASE, без Ё. Стартовая заглушка для расширения.
- Создан `lib/crack/compareWords.ts` — двухпроходный Wordle-алгоритм с корректной обработкой дублирующихся букв (`correct` → `wrong-position` → `absent`).
- Создан `lib/crackFieldGenerator.ts` — `generateCrackField(): { targetWord, wordList }`: случайный target + распределение отвлекающих слов по числу позиционных совпадений (`4→1, 3→4, 2→8, 1→10, 0→6`), Fisher-Yates shuffle, graceful degradation при нехватке слов в группе.
- Создан `types/crack.ts` — типы `LetterStatus`, `AttemptEntry`, `CrackField`, состояния и ответы API.
- Обновлён `constants/gameConfig.ts` — добавлены `CRACK_WORD_LENGTH=5`, `CRACK_DEFAULT_MAX_ATTEMPTS=6`, `CRACK_SKIP_THRESHOLD=2`.

**Таск 2 — API + Zod:**
- Обновлён `lib/validations/missions.ts` — `crackLaunchSchema` переименованы поля (`targetUrl`/`targetEmail`); добавлена `crackAttemptSchema` (`word.length(5)` + `expectedVersion`).
- Создан `lib/crack/launch.ts` — `findActiveCrackSlot(targetUrl, targetEmail)`.
- Создан `lib/crack/service.ts` — вся серверная логика: `getCrackState`, `applyAttempt`, `completeCrack`, `skipCrack`. Дискриминируемые юнионы результатов, optimistic locking, `finalizeMission` (атомарная транзакция завершения).
- Созданы API-эндпоинты:
  - `POST /api/missions/crack/launch` — rate limit 30/мин.
  - `GET /api/missions/crack/[slotKey]` — состояние / создание сессии.
  - `POST /api/missions/crack/[slotKey]/attempt` — попытка (409 при конфликте версии).
  - `POST /api/missions/crack/[slotKey]/complete` — завершение (идемпотентно).
  - `POST /api/missions/crack/[slotKey]/skip` — пропуск (идемпотентно, при `failedSessionsCount >= 2`).

**Таск 3 — UI: запуск + ядро мини-игры:**
- Обновлён `components/game/MissionCard.tsx` — `CrackForm` функционален: POST `/launch`, открывает `CrackModal`; обработка 400/429.
- Создан `components/game/crack/CrackModal.tsx` — оркестратор: загрузка состояния, цикл попыток через `fetchWithVersion` (409 → тост + рефетч), пересоздание поля при провале, авто-`/complete` при угадывании.
- Созданы `components/game/crack/WordGrid.tsx`, `WordCell.tsx`, `AttemptHistory.tsx`, `AttemptRow.tsx`.

**Таск 4 — UI: пропуск, завершение, подсказка:**
- Создан `components/game/crack/CrackSkipButton.tsx` — видна при `canSkip`.
- Создан `components/game/crack/CrackSkipConfirmModal.tsx` — модалка-предупреждение.
- Создан `components/game/crack/CrackCompletedView.tsx` — пароль/URL/логин с копированием в буфер.
- Создан `components/game/crack/CrackHintButton.tsx` — попап правил из `hintText` слота.

**Ключевые защиты реализованы:**
- `targetWord` не возвращается клиенту ни в одном ответе.
- `/attempt` валидирует наличие слова в серверном `wordList`.
- Optimistic locking на `/attempt` (`expectedVersion` + `P2025` → HTTP 409); `/complete` и `/skip` идемпотентны.
- Транзакция завершения: upsert `MissionProgress` + удаление `CrackSession` + 2 лога + `advanceTriggerListeners(tx, ...)`.
- `advanceTriggerListeners` вызывается **внутри** транзакции с передачей `tx` — атомарность гарантирована.

**Синхронизация документации:**
- `.docs/modules/missions-crack.md` — правило триггера (с `tx`), locking только на `/attempt`.
- `.docs/database.md` — §«Критичные транзакции» #4: новый `targetWord` при пересоздании, сигнатура `generateCrackField()`.
- `.docs/modules/concurrency.md` — complete/skip помечены идемпотентными в таблице.

**Проверки пройдены:** `npm run type-check` → exit 0; `eslint` по файлам фазы → чисто; `npm run build` → exit 0, все 5 роутов зарегистрированы.

**Следующее:**

- Phase 12 — Миссия Decipher.

**Проблемы / Заметки:**

- Контентное наполнение словника — заглушка ~230 слов, расширяется заказчиком.
- Известное расхождение данных (не кода): ключи в `ChatTransition.conditionValue` в БД содержат старые значения (`crack-1`/`crack-2`) вместо новых (`CRACK_P2`/`CRACK_VUZ`) — чат не движется после прохождения. Отдельная задача (правка данных в БД, не логики).
- 3 предсуществующие `eslint` ошибки вне scope фазы остаются: `Toast.tsx`, `AdminDetail.tsx`, `KeyRowDetails.tsx`.

---

## 2026-06-07 — Phase 10 / Таск 5

**Сделано:**

- Создан `types/admin-mission-slots.ts` — расширение существующего файла: добавлены `MissionSlotDetail` (все поля слота + `targetWord` для CRACK) и `ActiveRdpSlot` (для select-полей `nextRdpSlotKey` / `unlocksRdpSlotKey`).
- Обновлён `lib/validations/admin-mission-slots.ts` — фикс бага Таска 1: `targetWordSchema` использует кириллицу (`/^[А-Я]{5}$/`) вместо ошибочной латиницы, добавлено `.toUpperCase().replace(/Ё/g, 'Е')`.
- Обновлён `app/api/admin/mission-slots/[id]/route.ts` — `GET` теперь возвращает `targetWord` для CRACK-слотов через второй условный Prisma-запрос (не включён в `MISSION_SLOT_SELECT` чтобы не сломать тип `PublicMissionSlot`).
- Создан `app/(admin)/admin/mission-slots/new/page.tsx` — Server Component: загружает список активных RDP-слотов через Prisma, рендерит `MissionSlotForm` в режиме `create`.
- Создан `app/(admin)/admin/mission-slots/[id]/page.tsx` — Server Component: загружает детали слота + `targetWord` (CRACK), список активных RDP-слотов (исключая текущий), рендерит `MissionSlotForm` в режиме `edit`. При `notFound` → `notFound()`.
- Создан `components/admin/mission-slots/MissionSlotForm.tsx` — Client Component. Единая форма для create/edit. `useForm` без `zodResolver`; `schema.safeParse()` при submit с `setError` для inline-ошибок полей. В create: `<select>` типа + `<input>` для `slotKey`; в edit: read-only badge типа + mono-поле `slotKey`. Общие поля: `displayName`, `orderIndex`, `isActive`, `hintText`. Динамическая секция по `missionType`. После успешного save — `router.push('/admin/mission-slots')`.
- Создан `components/admin/mission-slots/CrackSlotFields.tsx` — поля: `targetWord` (с uppercase-хинтом), `targetUrl`, `targetEmail`, `resultPassword`, `crackMaxAttempts` (3..10).
- Создан `components/admin/mission-slots/DecipherSlotFields.tsx` — поля: `cipherType` (PLAYFAIR / VIGENERE), `encryptedWord`, `cipherKey`, `folderPassword`, `folderPath`, `unlocksRdpFolder`, `unlocksRdpSlotKey` (select из `activeRdpSlots`, nullable).
- Создан `components/admin/mission-slots/RdpSlotFields.tsx` — поля: `rdpScenario` (1 / 2), `correctIp`, `logSubjectName`. По сценарию: сц.1 → `timerSeconds` скрыт, `rdpPuzzleGridSize` read-only=6, `nextRdpSlotKey` обязателен; сц.2 → `timerSeconds` (30..600), `rdpPuzzleGridSize` read-only=7, `nextRdpSlotKey` скрыт.
- Создан `components/admin/mission-slots/SlotWarningBanner.tsx` — рендерит жёлтые баннеры по массиву `warnings[]`; НЕ блокирует сохранение.

**Следующее:**

- Phase 11 — Миссия Crack: `crackFieldGenerator.ts`, API (`GET /[slotKey]`, `POST /attempt`, `POST /complete`), UI (`CrackModal`, `WordGrid`, `AttemptHistory`).

**Проблемы / Заметки:**

- Стратегия `react-hook-form` без `zodResolver` выбрана осознанно: union-схема по `missionType` плохо работает с `zodResolver` для inline-ошибок полей.

---

## 2026-06-07 — Phase 10 / Таск 4

**Сделано:**

- Создан `types/admin-mission-slots.ts` — интерфейс `MissionSlotListItem` (id, slotKey, missionType, displayName, orderIndex, isActive, completionsCount, createdAt, updatedAt).
- Создан `app/(admin)/admin/mission-slots/page.tsx` — Server Component: Prisma-запрос с `_count.missionProgresses` (completed=true), маппинг в `MissionSlotListItem[]`, даты сериализованы в ISO-строки. Один запрос вместо N+1.
- Создан `app/(admin)/admin/mission-slots/loading.tsx` — Suspense-заглушка через `AdminPageSkeleton`.
- Создан `components/admin/mission-slots/MissionSlotsTable.tsx` — Client Component. Таблица с колонками: slotKey (mono), displayName, тип (бейдж с цветом), orderIndex, статус (`ToggleActiveControl`), прохождений, действия (Редактировать / Удалить). Фильтры по `missionType` (CRACK / DECIPHER / RDP / Все) и `isActive` (Все / Активен / Отключён) — client-side через `useMemo`. Кнопка «Создать слот» → `/admin/mission-slots/new`. Рефетч после мутаций через `GET /api/admin/mission-slots`.
- Создан `components/admin/mission-slots/ToggleActiveControl.tsx` — Client Component. Кликабельный бейдж «Активен» (зелёный) / «Отключён» (серый). `PATCH /api/admin/mission-slots/[id]/toggle-active`, disabled во время запроса, при `LAST_ACTIVE_SLOT_OF_TYPE` вызывает `onError` с человекочитаемым сообщением.
- Создан `components/admin/mission-slots/DeleteSlotDialog.tsx` — Client Component. Показывает предупреждение «N игроков потеряют прогресс» если `completionsCount > 0`. `DELETE /api/admin/mission-slots/[id]`. Обрабатывает оба кода ошибок: `SLOT_HAS_ACTIVE_SESSIONS` и `LAST_ACTIVE_SLOT_OF_TYPE` — показывает inline-сообщение в диалоге.

**Следующее:**

- Phase 10 / Таск 5 — UI: одностраничная форма создания + поля по типу + редактирование (`MissionSlotForm`, `CrackSlotForm`, `DecipherSlotForm`, `RdpSlotForm`, `SlotWarningBanner`).

**Проблемы / Заметки:**

- N/A

---

## 2026-06-07 — Phase 10 / Таск 3

**Сделано:**

- Реализован `DELETE /api/admin/mission-slots/[id]` с двойной защитой:
  - `SLOT_HAS_ACTIVE_SESSIONS` — блокировка при наличии активных `CrackSession` для слота.
  - `LAST_ACTIVE_SLOT_OF_TYPE` — блокировка если слот является последним активным в своём типе.
  - При успехе — каскадное удаление через Prisma (удаляются `MissionProgress`, `CrackSession`, `RdpFile`), аудит `mission_slot_deleted` с `slotKey` + `displayName` в metadata.
- Создан `PATCH /api/admin/mission-slots/[id]/toggle-active/route.ts` — отдельный эндпоинт переключения `isActive`:
  - При деактивации — защита `LAST_ACTIVE_SLOT_OF_TYPE` (нельзя отключить единственный активный слот в типе).
  - При реактивации — аудит `mission_slot_reactivated` через `writeAuditLog`.
  - При деактивации — аудит намеренно не пишется (рутинное действие).
  - Ответ возвращает обновлённый слот без `targetWord` + `completionsCount`.
- Оба эндпоинта защищены двойной проверкой: `proxy.ts` + явный `session.user.type === 'ADMIN'` в handler.
- Zod-валидация body через `toggleActiveSchema` (`isActive: z.boolean()`).
- Полный `try/catch` с `console.error` на оба эндпоинта, `targetWord` в ответах не фигурирует.

**Следующее:**

- Phase 10 / Таск 4 — UI: список слотов + действия (`MissionSlotsTable`, `ToggleActiveControl`, `DeleteSlotDialog`).

**Проблемы / Заметки:**

- N/A

---

## 2026-06-07 — Phase 10 / Таск 2

**Сделано:**

- Создан `app/api/admin/mission-slots/route.ts`: `GET` (список слотов с фильтрами по `missionType` и `isActive`, `completionsCount` через отдельный `count` на каждый слот, без `targetWord`) + `POST` (создание слота через `createMissionSlotSchema`, защита от дубликата `slotKey` → 400 `SLOT_KEY_EXISTS`, предупреждения через `getMissionSlotWarnings`, ответ 201 `{ slot, warnings }`).
- Создан `app/api/admin/mission-slots/[id]/route.ts`: `GET` (детали слота без `targetWord`, `completionsCount`) + `PATCH` (запрет смены `slotKey`/`missionType` → 400 `IMMUTABLE_FIELD`; валидация через под-схему по `missionType` из БД: `updateCrackMissionSlotSchema` / `updateDecipherMissionSlotSchema` / `updateRdpMissionSlotSchema`; защита `LAST_ACTIVE_SLOT_OF_TYPE` при `isActive=false`; предупреждения в ответе 200 `{ slot, warnings }`).
- Создан `lib/admin/missionSlotWarnings.ts`: функция `getMissionSlotWarnings(slot, prismaClient?)` с 6 проверками: `DUPLICATE_CRACK_LAUNCHER`, `DUPLICATE_DECIPHER_FOLDER`, `DUPLICATE_RDP_IP`, `DECIPHER_RDP_FOLDER_NOT_FOUND`, `RDP_NEXT_SLOT_MISSING`, `PLAYFAIR_RESTRICTED_LETTERS`. Предупреждения не бросают исключений, не блокируют сохранение.
- Все эндпоинты: явная проверка `session.user.type === 'ADMIN'`, полный try/catch, `console.error` для полной ошибки.
- `npm run type-check` — без ошибок, нет `any`.

**Следующее:**

- Таск 3: `DELETE /api/admin/mission-slots/[id]` + `PATCH /api/admin/mission-slots/[id]/toggle-active` + аудит.

---

## 2026-06-07 — Phase 10 / Таск 1

**Сделано:**

- Переписан `seedMissionSlots` в `prisma/seed.ts`: устранены все 8 расхождений со спецификацией (`database.md §3`). `createMany` заменён на `upsert` по `slotKey` — повторный запуск безопасен. Контентные поля заполнены заглушками.
- Создан `constants/missionSlotLimits.ts`: именованные константы диапазонов (`CRACK_MAX_ATTEMPTS_MIN/MAX`, `RDP_TIMER_SECONDS_MIN/MAX`, `RDP_GRID_SIZES`, `RdpGridSize`).
- Создан `lib/validations/admin-mission-slots.ts`: discriminated Zod-схемы для `POST` (`createMissionSlotSchema`) и `PATCH` (`updateMissionSlotSchema`). Внутри RDP — `z.discriminatedUnion` по `rdpScenario`. `updateMissionSlotSchema` не содержит `slotKey` и `missionType`. Экспортированы `z.infer` типы `CreateMissionSlotInput` / `UpdateMissionSlotInput`.
- `cipherType` в `decipherSlotSchema` переведён на `z.nativeEnum(CipherType)` (из `@prisma/client`) вместо хардкодного `z.enum`.
- `z.literal(6)` / `z.literal(7)` заменены на `z.literal(RDP_GRID_SIZES[0])` / `z.literal(RDP_GRID_SIZES[1])` — устранены магические числа.
- `npm run type-check` — без ошибок.

**Следующее:**

- Таск 2: API-эндпоинты `GET/POST /api/admin/mission-slots` и `GET/PATCH /api/admin/mission-slots/[id]`.

**Проблемы / Заметки:**

- `createMissionSlotSchema` использует `z.union` вместо `z.discriminatedUnion('missionType')` — техническое ограничение Zod v3: RDP-ветка является `z.intersection` (вложенный discriminated union по `rdpScenario` — не `ZodObject`), что несовместимо с `z.discriminatedUnion` на верхнем уровне. Зафиксировано в комментарии к схеме.

---

## 2026-06-06 — Phase 9 / Таск 2 — UI подсказок (кнопка + модалка)

**Сделано:**

- Реализован **Phase 9, Таск 2**: клиентский UI системы подсказок Детектива. Игрок может открыть модалку, листать подсказки по одной через «Далее» и видеть финальный экран. Ошибки (сетевые и rate-limit) обрабатываются дружелюбным текстом с кнопкой «Повторить».

**Созданные файлы:**

- `components/game/hints/DetectiveHintsButton.tsx` — `'use client'`; кнопка-иконка с `aria-label="Подсказка от Детектива"` и `data-onboarding-id="hints-button"` (задел под Phase 18); локальный `useState(open)`; при `open === true` рендерит `<DetectiveHintsModal onClose={...} />`. Спиннер/иконка — инлайн Tailwind, без новых зависимостей.
- `components/game/hints/DetectiveHintsModal.tsx` — `'use client'`; 4 состояния (`loading | active | finished | error`); `loadCurrent()` (`GET /api/hints/current`) вызывается на маунте; `handleAdvance()` (`POST /api/hints/advance`) с явной проверкой `res.ok` перед `res.json()` — обрабатывает 429 и сетевые ошибки как `'error'`-состояние; `role="dialog" aria-modal="true"`; кнопки «Далее», «Закрыть», «Повторить» с focus-стейтами.

**Изменённые файлы:**

- `components/game/DashboardClient.tsx` — disabled-заглушка кнопки «Подсказка» (стр. 40–48) заменена на `<DetectiveHintsButton />`; на dashboard ровно одна кнопка подсказок.

**Проверки:**

- `npm run type-check` — ✅, нет `any`.
- `npm run lint` — ✅.

**Следующее:**

- Phase 10 — Админка: слоты миссий.

**Проблемы / Заметки:**

- Нет.

---

## 2026-06-06 — Phase 9 / Таск 1 — Серверная логика + API подсказок

**Сделано:**

- Реализован **Phase 9, Таск 1**: серверная логика выдачи подсказок Детектива и два API-эндпоинта.

**Созданные файлы:**

- `lib/hints/service.ts` — серверный сервис с типом `HintResult` (дискриминированный union `{ isFinished: true } | { isFinished: false; hint: { id, orderIndex, text } }`). Функция `getCurrentHint(userId)`: UPSERT `UserHintProgress` с `lastSeenHintIndex: 0` при первом обращении + `findFirst` первой активной подсказки (`isActive: true`, `orderIndex >= lastSeenHintIndex`). Функция `advanceHint(userId)`: находит текущую и следующую активные подсказки, обновляет `lastSeenHintIndex = next.orderIndex`, возвращает следующую или `{ isFinished: true }`. Неактивные/удалённые подсказки пропускаются автоматически через фильтр.
- `app/api/hints/current/route.ts` — `GET`, Player-only (`auth()` + проверка `session.user.type`), без rate-limit, `try/catch` → 500.
- `app/api/hints/advance/route.ts` — `POST`, Player-only, тело не читается (пустое body — принятое исключение из `phase-9.md`), rate-limit 30/мин на `userId` (`checkRateLimit('hints-advance:{userId}', 30, 60_000)`) → 429 `RATE_LIMIT_EXCEEDED`, `try/catch` → 500.

**Проверки:**

- `npm run type-check` — exit code 0, нет `any`.
- `eslint` на трёх файлах — 0 ошибок, 0 предупреждений.
- `npm run build` — успешно, оба роута скомпилированы (`/api/hints/advance`, `/api/hints/current`).
- Исправлено: `let progress` → `const` в `service.ts:46` по итогам DoD-ревью.

**Следующее:**

- Phase 9, Таск 2: `DetectiveHintsButton`, `DetectiveHintsModal`, замена disabled-заглушки в `DashboardClient.tsx`.

**Проблемы / Заметки:**

- Преексистирующие ошибки линтера в других файлах (3 ошибки, вне scope таска) — не трогались.

---

## 2026-06-06 — Phase 8 / Таск 2 — UI страницы `/admin/hints`

**Сделано:**

- Реализован **Phase 8, Таск 2**: клиентский UI управления подсказками Детектива на странице `/admin/hints`.

**Созданные файлы:**

- `app/(admin)/admin/hints/page.tsx` — Server Component; Prisma-запрос `findMany({ orderBy: { orderIndex: 'asc' } })`, маппинг дат в ISO-строки, рендер `<HintsTable initialHints={...} />`. Экспортирует `metadata.title`.
- `components/admin/hints/HintsTable.tsx` — `'use client'`; таблица с колонками: `№` (orderIndex), `Текст` (truncate 80 символов), `Активна` (toggle-badge), `Порядок` (HintsReorderControl), `Действия` (Редактировать / Удалить). Два раздельных error state: `fetchError` (ошибка рефетча), `actionError` (ошибки toggle и reorder — оба показываются как красный баннер над таблицей). После каждой мутации вызывает `GET /api/admin/hints` и обновляет локальный state.
- `components/admin/hints/HintForm.tsx` — `'use client'`; модалка создания/редактирования. `react-hook-form` + Zod-резолвер. Создание: поля `text`, `orderIndex`, `isActive`; `INDEX_TAKEN` → inline-ошибка под `orderIndex`. Редактирование: `orderIndex` disabled (только чтение), поля `text` и `isActive`. Все поля связаны с `<label>` через `htmlFor`/`id`.
- `components/admin/hints/DeleteHintDialog.tsx` — `'use client'`; диалог подтверждения удаления с `role="dialog" aria-modal aria-labelledby`. Вызывает `DELETE /api/admin/hints/[id]`, inline-ошибка при сбое.
- `components/admin/hints/HintsReorderControl.tsx` — `'use client'`; кнопки ↑/↓ для строки. `disabled` если первая/последняя строка или в процессе запроса. Ошибки поднимаются через `onError(message)` callback в `HintsTable`.

**Доработки после DoD-ревью:**

- `HintsTable.tsx` — `handleToggleActive`: заменён `console.error` на `setActionError(...)` — пользователь видит сообщение об ошибке.
- `HintsReorderControl.tsx` — `move`: заменён `console.error` на `onError(...)` callback — ошибки всплывают в `HintsTable` и отображаются в `actionError`-баннере.
- `HintForm.tsx` — `Field` компонент получил `htmlFor?: string` prop; все `<textarea>` и `<input>` получили соответствующие `id` (`create-hint-text`, `create-hint-order`, `edit-hint-text`, `edit-hint-order`).
- `page.tsx` — добавлен `import React from 'react'` для консистентности.

**Проверки:**

- `npm run type-check` — ✅
- `npm run lint` — ✅

**Следующее:**

- Phase 8 завершена. Следующая фаза по роадмапу.

**Проблемы / Заметки:**

- Нет.

---

## 2026-06-06 — Phase 8 / Таск 1 — Сидер + Zod + API эндпоинты (hints)

**Сделано:**

- Реализован **Phase 8, Таск 1**: серверная инфраструктура управления подсказками Детектива — идемпотентный сидер-заглушка, Zod-схемы валидации, пять API-эндпоинтов (CRUD + переупорядочивание).

**Созданные файлы:**

- `lib/validations/admin-hints.ts` — Zod-схемы: `createHintSchema` (`text`, `orderIndex ≥ 1`, `isActive`), `updateHintSchema` (`text?`, `isActive?`; `.refine` — хотя бы одно поле обязательно), `reorderSchema` (массив `{ id: cuid, newOrderIndex: int ≥ 1 }`); экспортированы `z.input<>`/`z.infer<>` типы.
- `app/api/admin/hints/route.ts` — `GET` (список `orderBy orderIndex asc`) + `POST` (создание; `P2002 → 400 INDEX_TAKEN`; успех → `201`). Локальные хелперы `forbiddenResponse`, `validationErrorResponse`, `isPrismaUniqueError` по образцу `chats/scripts`.
- `app/api/admin/hints/[id]/route.ts` — `PATCH` (`text`, `isActive`; явная блокировка `orderIndex` в теле → `400`; пустой body `{}` → `400` через `refine`) + `DELETE` (`findUnique` + `delete` в одной `$transaction`; аудит `hint_deleted` через `writeAuditLog({ adminId, message, metadata: { hintId, orderIndex } })`).
- `app/api/admin/hints/reorder/route.ts` — `POST`, двухфазный апдейт в `$transaction`: фаза 1 — сдвиг всех затронутых строк в отрицательный диапазон (`-(i+1)`), фаза 2 — финальные `newOrderIndex`. Устраняет `P2002` при свапе соседних `orderIndex` с `@unique` на PostgreSQL.

**Изменённые файлы:**

- `prisma/seed.ts` — добавлена `seedDetectiveHint()` (idempotent `upsert` по `orderIndex: 1`, `update: {}`); вызов в `main()` после `seedFinalReportContent()`.

**Доработки после DoD-ревью:**

- `app/api/admin/hints/[id]/route.ts` — `findUnique` + `delete` обёрнуты в `$transaction` (устранение race condition при concurrent delete).
- `lib/validations/admin-hints.ts` — добавлен `.refine()` на `updateHintSchema`: пустой body `{}` возвращает `400 VALIDATION_ERROR`, не доходя до Prisma.

**Следующее:**

- Phase 8, Таск 2 — UI страницы `/admin/hints`.

**Проблемы / Заметки:**

- Нет.

---

## 2026-06-04 — Phase 7 / Таск 3 — Серверная подстановка `{{user.email}}` в репликах

**Сделано:**

- Реализован **Phase 7, Таск 3**: серверная подстановка токена `{{user.email}}` в тексте реплик чата перед отправкой клиенту. Lib-функции чатов остались чистыми.

**Созданные файлы:**

- `lib/chat/template.ts` — серверная утилита (`server-only`). Константа `USER_EMAIL_TOKEN = '{{user.email}}'`. Три экспорта: `applyChatTemplate(text, vars)` — замена с replacement-функцией `() => vars.email` (защита от `$&`/`$$`), `null`-safe; `applyTemplateToView(view, vars)` — копия `ChatMessageView` с подставленным `text`; `applyTemplateToAdvanceResult(result, vars)` — обрабатывает ветки `ok`/`waiting`/`choice_required`, ветки `invalid_choice`/`conflict`/`no_start` возвращает без изменений; exhaustive check через `never`.

**Изменённые файлы:**

- `app/api/chat/state/route.ts` — после `getChatState`: запрос `User.email` по `session.user.id` (`findUniqueOrThrow`), `applyTemplateToView` на `detective.currentMessage` и `marina.currentMessage` (с null-guard).
- `app/api/chat/messages/route.ts` — после `getChatHistory`: запрос `User.email`, `messages.map(applyTemplateToView)` по всей ленте (включая «эхо»-реплики игрока).
- `app/api/chat/advance/route.ts` — после `advanceChatState`: запрос `User.email`, `applyTemplateToAdvanceResult` перед `mapAdvanceResult`.
- `app/api/chat/choice/route.ts` — аналогично `advance`.
- `.docs/modules/chats.md` — добавлен раздел «Подстановка переменных» (токен, источник email, слой применения, таблица edge-cases, пометка про `marina_01_intro` как ручной контент).

**Проверки:**

- `npm run type-check` — ✅
- `npm run build` — ✅
- `npm run lint` — ошибки только в файлах вне scope (AdminDetail, Toast, KeyRowDetails), новый код чистый.

**Следующее:**

- Phase 8 — Админка: подсказки Детектива.

**Проблемы / Заметки:**

- `marina_01_intro` с `{{user.email}}` — ручная контент-правка в БД через админку (не в сиде).

---

## 2026-06-04 — Phase 7 / Таск 2 — Движок TRIGGER + проводка `final_choice_made`

**Сделано:**

- Реализован **Phase 7, Таск 2**: создан универсальный серверный движок TRIGGER-переходов; триггер `final_choice_made` проводится в одной транзакции с фиксацией `finalChoice`.

**Созданные файлы:**

- `lib/chat/triggers.ts` — серверная утилита (`server-only`). `advanceTriggerListeners(tx: Prisma.TransactionClient, userId: string, triggerCode: string): Promise<void>`: обходит оба чата (`DETECTIVE`, `MARINA`), для текущего указателя каждого ищет исходящее `TRIGGER`-ребро с `conditionValue === triggerCode` (`orderBy priority desc`), при совпадении переводит указатель на `toMessage.id`, инкрементирует `version: { increment: 1 }`, при `toMessage.isEnd` выставляет `detectiveFinished`/`marinaFinished`; идемпотентен — при повторном вызове совпадающего ребра уже нет.

**Изменённые файлы:**

- `lib/chat/advance.ts` — заменён `// TODO Phase 7` (стр. 342): после успешного guarded-update, при `current.code === MARINA_FINAL_CHOICE_CODE && options.choiceValue !== undefined`, в той же транзакции вызывается `advanceTriggerListeners(tx, userId, CHAT_TRIGGER_EVENTS.FINAL_CHOICE_MADE)`; затем пере-читается `ChatState` (`findUniqueOrThrow`) и в ветке `status: 'ok'` клиенту возвращается итоговая `version` (отражает и переход выбора, и срабатывание триггера).

**Следующее:**

- Phase 7, Таск 3 — Серверная подстановка `{{user.email}}` в репликах.

**Проблемы / Заметки:**

- Миграций, Zod-схем, UI и `OperationLog` не затронуто. Вызовы движка из миссий и запись `marinaTriggered` — фазы 11–15.

---

## 2026-06-04 — Phase 7 / Таск 1 — Аудио в чатах + расшифровка

**Сделано:**

- Реализован **Phase 7, Таск 1**: аудио-реплики воспроизводятся через нативный `<audio controls>`; под плеером — аккордеон расшифровки для слабослышащих.

**Созданные файлы:**

- `components/ui/AudioPlayer.tsx` — Client-компонент: нативный `<audio controls preload="metadata">` с отображением имени файла из URL; `aria-label` на элементе. Props: `src`, опц. `className`.
- `components/game/chat/TranscriptToggle.tsx` — Client-компонент: кнопка «текстовая версия» / «скрыть текстовую версию»; локальный `useState(false)`; `aria-expanded` + `aria-controls` (связь с блоком `id="transcript-{messageId}"`); текст рендерится через React (XSS-защита).

**Изменённые файлы:**

- `components/game/chat/ChatMessage.tsx` — добавлены props `id: string` и `audioUrl: string | null`; guard изменён с `!text` на `!text && !audioUrl`; при `audioUrl !== null` рендерится пузырь с `AudioPlayer` + опциональный `TranscriptToggle` (если `text` есть); иначе — прежний текстовый пузырь. Выравнивание и цвета `IS_RIGHT` сохранены в обоих режимах.
- `components/game/chat/ChatWindow.tsx` — условие фильтрации сообщений расширено до `msg.text || msg.audioUrl`; в `<ChatMessage>` пробрасываются `id` и `audioUrl`.

**Попутно:**

- `tsconfig.json` — удалена строка `.next/dev/types/**/*.ts` из `include` (Next.js 16 добавляет её автоматически при `build`; сталые файлы от dev-сервера вызывали ошибки `TS1434`/`TS1128` при `type-check`). После `npm run build` файл пересоздан корректно.

**Следующее:**

- Phase 7, Таск 2 — Движок TRIGGER + проводка `final_choice_made`.

**Проблемы / Заметки:**

- Нет.

---

## 2026-06-04 — Phase 6 / Таск 3 — UI чатов + Zustand + интеграция в dashboard

**Сделано:**

- Реализован **Phase 6, Таск 3**: клиентский UI чатов поверх готовых эндпоинтов (Таск 2); создан общий паттерн optimistic locking (первый потребитель в проекте). Phase 6 завершена.

**Созданные файлы:**

- `types/chat.ts` — общие клиентские типы `ChatMessageView`, `ChatChoice`, `ChatType` (не `server-only`; переиспользуются стором и компонентами).
- `components/ui/Toast.tsx` — модульный pub/sub: `toast.success/warning/error/info(msg)` как синглтон; `<ToastContainer/>` подписывается через `useEffect`, авто-скрывает тосты через 4с; `aria-live="polite"`, `role="alert"` на каждом тосте.
- `lib/api/fetchWithVersion.ts` — POST-обёртка с обработкой optimistic locking: при `409` → `toast.warning(...)` + `await onConflict()`; без авто-ретрая; возвращает `Response`.
- `store/chatStore.ts` — Zustand-стор: общая `version` на оба чата; `refresh()` (GET `/state` + GET `/messages` параллельно); `advance(chatType)` / `choice(chatType, value)` через `fetchWithVersion`; защита от дублей по `id` при append; `status: 'idle'|'loading'|'ready'|'error'` на каждый слот.
- `components/game/chat/ChatMessage.tsx` — реплика: выравнивание пузыря по `author` (PLAYER → правый teal; DETECTIVE/MARINA/ANONYMOUS → левый тёмный); текст через React (XSS-защита).
- `components/game/chat/ChatAdvanceButton.tsx` — кнопка «Далее»; блокировка при `status:'loading'`.
- `components/game/chat/ChatChoices.tsx` — список кнопок выбора; блокировка при `status:'loading'`; `role="group"`.
- `components/game/chat/ChatWindow.tsx` — лента с авто-скроллом вниз; loading/error/empty состояния; индикатор ожидания при `isWaiting` (`aria-live`); аффордансы (кнопки/выбор) только если `!isWaiting && !isFinished`.
- `components/game/chat/ChatPanel.tsx` — контейнер: заголовок с `aria-expanded` + toggle `isOpen`; фиксированная высота окна `h-[420px]`.

**Изменённые файлы:**

- `lib/chat/advance.ts` — аддитивно добавлен `author: ChatAuthor` в `ChatMessageView` и `toChatMessageView`; существующая логика и сигнатуры не тронуты.
- `components/game/DashboardClient.tsx` — удалён локальный плейсхолдер `ChatPanel`; `useEffect` вызывает `refresh()` на маунте; рендерит `<ChatPanel chatType="DETECTIVE" />` всегда + `<ChatPanel chatType="MARINA" />` при `marina.isVisible`.
- `app/(game)/layout.tsx` — добавлен `<ToastContainer/>`.

**Архитектурные решения:**

- **Optimistic locking pattern:** `fetchWithVersion` + `toast` — создан как переиспользуемый паттерн; будет применён в миссиях и финальном отчёте.
- **Общая `version`:** одно поле на оба чата на верхнем уровне стора — исключает ложный `409` при действиях в двух чатах подряд.
- **Видимость Марины из `/api/chat/state`:** `marina.isVisible` из стора, без отдельного `GET /api/progress`.
- **Без SSR:** начальное состояние грузится fetch'ем на маунте (паттерн как у `logStore`).

**Следующее:**

- Phase 7 — Чаты: аудио (`<audio>`) + TRIGGER-переходы + активация Марины.

**Проблемы / Заметки:**

- `npm run type-check` — exit 0; `npm run build` — exit 0; ReadLints по всем файлам — чисто.
- Аудио-рендер (`audioUrl`) и подстановка `{{user.email}}` намеренно отложены в Phase 7.

---

## 2026-06-04 — Phase 6 / Таск 2 — API-эндпоинты чатов (state, messages, advance, choice)

**Сделано:**

- Реализован **Phase 6, Таск 2**: четыре тонких HTTP-эндпоинта поверх ядра `lib/chat/` (Таск 1).

**Созданные файлы:**

- `lib/chat/state.ts` (`import 'server-only'`) — `getChatState(userId)`: оркестратор состояния обоих чатов; читает `GameProgress.marinaTriggered`; для DETECTIVE (всегда) и MARINA (только если `marinaTriggered`) вызывает `ensureChatStarted`; статус `no_start` → `currentMessage: null` без 500; статус `conflict` (гонка автостарта) → перечитывает свежий `ChatState`, возвращает текущую реплику без 500; читает `isWaiting` через `isChatMessageWaiting`; читает финальный `version` и `finalChoice` после всех автостартов.
- `app/api/chat/state/route.ts` — `GET`: `auth()` + PLAYER → 401; вызов `getChatState`; ответ `{ detective, marina, finalChoice, version }`.
- `app/api/chat/messages/route.ts` — `GET`: `auth()` + PLAYER → 401; валидация query `chatType` через `messagesQuerySchema` → 400; вызов `getChatHistory`; ответ `{ messages: ChatMessageView[] }`.
- `app/api/chat/advance/route.ts` — `POST`: `auth()` + PLAYER → 401; `advanceSchema.safeParse` → 400; `advanceChatState` без `choiceValue`; exhaustive-switch маппинг `AdvanceResult` → HTTP-коды.
- `app/api/chat/choice/route.ts` — `POST`: `auth()` + PLAYER → 401; `choiceSchema.safeParse` → 400; `advanceChatState` с `choiceValue`; тот же маппинг.

**Изменённые файлы:**

- `lib/chat/advance.ts` — аддитивно добавлен экспорт `isChatMessageWaiting(messageId)` (обёртка над приватным `messageIsWaitingOnly`); существующая логика не тронута.
- `lib/validations/chat.ts` — аддитивно добавлен `messagesQuerySchema` + infer-тип `MessagesQueryInput`.

**Маппинг AdvanceResult → HTTP:**

| status            | HTTP | Тело                                                              |
| ----------------- | ---- | ----------------------------------------------------------------- |
| `ok`              | 200  | `{ currentMessage, isWaiting, isFinished, version }`              |
| `waiting`         | 200  | `{ currentMessage, isWaiting: true, isFinished: false, version }` |
| `choice_required` | 400  | `{ error: 'CHOICE_REQUIRED' }`                                    |
| `invalid_choice`  | 400  | `{ error: 'INVALID_CHOICE' }`                                     |
| `conflict`        | 409  | `{ error: 'CONFLICT', currentVersion }`                           |
| `no_start`        | 500  | `{ error: 'NO_START_MESSAGE' }`                                   |

**Следующее:**

- Phase 6 / Таск 3 — UI чатов + Zustand + интеграция в dashboard.

**Проблемы / Заметки:**

- Гонка автостарта на `/state` (два устройства одновременно) обрабатывается перечитыванием стейта без 500 — аналогично паттерну `ensureChatStarted`.
- Автостарт детектива и Марины выполняется **последовательно** (не параллельно) — иначе два `ensureChatStarted` конкурируют за одну строку `ChatState` при первом `/state`.
- TRIGGER-переходы и `advanceTriggerListeners` по-прежнему отложены в Phase 7.
- Добавлен `DEBT-001` в `.docs/backlog.md` — запуск чата Детектива должен зависеть от завершения онбординга (флаг `onboardingCompleted`); реализуется в Phase 18.
- `npm run type-check` — exit 0; `npm run build` — exit 0; eslint на файлах таска — exit 0.

---

## 2026-06-04 — Phase 6 / Таск 1 — Серверная логика чатов + Zod + optimistic locking

**Сделано:**

- Реализован **Phase 6, Таск 1**: алгоритмическое ядро чатов — серверные функции обхода графа диалога и Zod-схемы валидации входа.

**Созданные файлы:**

- `lib/chat/advance.ts` (`import 'server-only'`) — `advanceChatState(userId, chatType, { choiceValue?, expectedVersion })`:
  - выбор перехода по `priority desc` + типу условия (`ALWAYS` безусловно; `CHOICE` по `conditionValue`; `TRIGGER` → `waiting`);
  - двойная version-guard: явная проверка `state.version !== expectedVersion` + атомарная `where: { id, version }` — `P2025 → conflict`;
  - чтение + guarded-update обёрнуты в `prisma.$transaction`;
  - запись `playerChoices[current.code] = choiceValue` при CHOICE-переходе;
  - фиксация `finalChoice = choiceValue.toUpperCase()` при `current.code === 'marina_final_choice'`; `// TODO Phase 7: advanceTriggerListeners`;
  - выставление `detectiveFinished`/`marinaFinished` при `next.isEnd`;
  - авто-старт при `currentMessageId === null` → ставит указатель на `isStart`;
  - экспортируемые типы: `ChatMessageView`, `AdvanceResult`, `EnsureChatStartedResult`;
  - экспортируемый хелпер `ensureChatStarted` — переиспользуется в Таске 2 (`GET /api/chat/state`);
  - экспортируемый маппер `toChatMessageView` — переиспользуется в `history.ts`.
- `lib/chat/history.ts` (`import 'server-only'`) — `getChatHistory(userId, chatType)`:
  - обход `isStart → currentMessage` по `playerChoices` с visited-set + `MAX_HISTORY_WALK_ITERATIONS = 500` (защита от цикла в графе, фикс G);
  - текущая реплика гарантированно включается в ленту.
- `lib/validations/chat.ts` — `advanceSchema` / `choiceSchema` (с `expectedVersion: int().nonnegative()`, фиксы B/C/D) + infer-типы `AdvanceInput` / `ChoiceInput`.

**Дополнительно:**

- Создан `.docs/backlog.md` — зафиксирован технический долг Phase 6 (5 пунктов: pre-existing lint-ошибки, дублирование `parsePlayerChoices`).
- `npm run type-check` — чисто (exit 0).
- `npm run lint` — в новых файлах нуль замечаний; 2 pre-existing ошибки и 6 варнингов в `components/admin/` (задокументированы в backlog).

**Следующее:**

- Phase 6 / Таск 2 — API-эндпоинты чатов (`state`, `messages`, `advance`, `choice`).

**Проблемы / Заметки:**

- TRIGGER-переходы и `advanceTriggerListeners` намеренно отложены в Phase 7 (есть `// TODO`).
- Phase 6 — первый потребитель optimistic locking в проекте; паттерн `version-guard + P2025` установлен как образец для последующих фаз.

---

## 2026-06-02 — Phase 5 / Таск 5 — Загрузка аудио: S3-клиент + endpoint + UI

**Сделано:**

- Реализован **Phase 5, Таск 5: Загрузка аудио: S3-клиент + endpoint + UI** — первичная настройка S3-клиента и полный цикл загрузки/удаления аудио для реплик чата. Завершает Phase 5.

**Библиотеки:**

- Установлен `@aws-sdk/client-s3` — первая зависимость от AWS SDK в проекте.

**S3-клиент:**

- Создан `lib/s3.ts` — синглтон `S3Client` (`forcePathStyle: true` для Beget) + хелперы `putObject`, `deleteObject`, `buildPublicUrl`, `extractKeyFromUrl`. ENV читаются только на сервере, без `NEXT_PUBLIC_*`.
- Выбран публичный path-style URL (`${S3_ENDPOINT}/${S3_BUCKET}/${key}`); presigned URL — отложено.

**Валидации:**

- Расширен `lib/validations/admin-chats.ts`: добавлены `ALLOWED_AUDIO_MIME`, `MAX_AUDIO_SIZE_BYTES` (5 МБ именованной константой), `normalizeFilename` (lowercase + пробелы → `_`).

**API:**

- Создан `app/api/admin/chats/scripts/[id]/audio/route.ts`:
  - `POST` — multipart, валидация типа/размера на сервере, ключ `audio/chat/{id}/{filename}`, порядок «залить → обновить `audioUrl` → удалить старый (best-effort, только если ключ изменился)».
  - `DELETE` — идемпотентный (при `audioUrl=null` → `{ success: true }`), сначала обнуляет БД, затем best-effort удаляет из S3.
  - Оба защищены `adminAuth` + ADMIN → 403.

**UI:**

- Создан `components/admin/chats/AudioUploader.tsx` — Client Component: кнопка загрузки (скрытый `<input type="file">`), нативный `<audio controls>` для превью, кнопка удаления, loading/error states с `role="alert"` (a11y). `MAX_AUDIO_SIZE_BYTES` импортируется из `lib/validations/admin-chats` — единый источник правды.
- Изменён `components/admin/chats/ChatScriptForm.tsx` — `AudioUploader` встроен в `EditForm` (режим `create` не затронут — нет `id` до сохранения реплики).

**Архитектурные решения:**

- Optimistic locking к `ChatScript` не применяется (контент, не игровое состояние) — audio-эндпоинты без `expectedVersion`/`version`.
- Загрузка только в режиме `edit` — нужен `id` реплики для ключа объекта.

**Проблемы / Заметки:**

- `lib/s3.ts` разблокирует Phase 7 (PDF RDP — тот же S3-клиент).
- Воспроизведение аудио требует публичного доступа к бакету Beget — активируется в панели управления Cloud Storage (переключатель публичного доступа). Проблемы с VPS решены на стороне инфраструктуры.

---

## 2026-06-02 — Phase 5 / Таск 4 — CRUD переходов (ChatTransition) + TRIGGER + affected-users

**Сделано:**

- Реализован **Phase 5, Таск 4: CRUD переходов (ChatTransition) + TRIGGER + affected-users** — полный CRUD рёбер графа диалога с контролируемым списком TRIGGER-событий, живым счётчиком затронутых игроков, рефакторингом оркестрации вкладок и мелкими UI-правками.

**API:**

- Создан `app/api/admin/chats/transitions/route.ts` — `GET` (список переходов с `from.code`/`from.chatType`/`to.code`/`to.chatType`; сортировка по `from.code` asc, `priority` desc) + `POST` (создать переход; Zod discriminated union по `conditionType`; для `TRIGGER` — проверка membership в Set из БД → иначе 400 `INVALID_TRIGGER_VALUE`; для `ALWAYS` — `conditionValue = null`; FK-ошибка Prisma `P2003` → 400 `INVALID_REFERENCE`; успех → 201). Оба защищены `adminAuth` + ADMIN → 403.
- Создан `app/api/admin/chats/transitions/[id]/route.ts` — `PATCH` (merge: читает существующую запись, вычисляет effective `conditionType`/`conditionValue`, валидирует, обновляет; нет записи → 404 `NOT_FOUND`; `P2025` в update → 404; `P2003` → 400) + `DELETE` (pre-check `findUnique` → 404; успех → `{ success: true }`). Оба защищены.
- Создан `app/api/admin/chats/affected-users/[scriptId]/route.ts` — `GET`: `prisma.chatState.count({ OR: [currentDetectiveMessageId, currentMarinaMessageId] })`; без побочных эффектов; секретов в ответе нет. Защищён.
- Создан `app/api/admin/chats/trigger-values/route.ts` — `GET`: читает все `missionSlot` (без фильтра `isActive`), строит список через `buildTriggerValues`. Защищён.

**Библиотеки:**

- Создан `constants/chatTriggerEvents.ts` — `CHAT_TRIGGER_EVENTS` (фабрики `CRACK_COMPLETED(slotKey)`, `DECIPHER_COMPLETED`, `RDP_COMPLETED` + фиксированные `RDP_MARINA_TRIGGERED`, `FINAL_CHOICE_MADE`); `buildTriggerValues(slotKeys): string[]` (чистая функция, безопасна для клиента); `fetchValidTriggerValueSet()` (async, читает Prisma через dynamic import — используется только в server-side коде).
- Создан `lib/admin/chatTransitionApi.ts` — переиспользуемые утилиты: `TRANSITION_SELECT` (константа select с include), `serializeTransition()` (Date → ISO string, касты типов), `validateTransitionPayload()` (ALWAYS/CHOICE/TRIGGER валидация + проверка TRIGGER-листа), `normalizeConditionValue()`, `isPrismaForeignKeyError()`, `isPrismaNotFoundError()`.

**Валидации:**

- Расширен `lib/validations/admin-chats.ts` — добавлены `createTransitionSchema` (discriminated union по `conditionType`: ветки ALWAYS/CHOICE/TRIGGER), `updateTransitionSchema` (flat schema для PATCH; handler компенсирует), экспорт типов `CreateTransitionInput`/`CreateTransitionOutput`/`UpdateTransitionInput`/`UpdateTransitionOutput`.

**Типы:**

- Расширен `types/admin-chats.ts` — добавлены `ConditionType`, `ChatTransitionScriptRef`, `ChatTransitionListItem`, `TriggerValueOption`.

**UI:**

- Создан `components/admin/chats/ChatsTabs.tsx` — `'use client'`: оркестрация вкладок «Реплики»/«Переходы»; держит state `scripts`/`transitions`/`triggerValues`/`validatorReloadKey`; колбэки `handleScriptsMutated`/`handleTransitionsMutated` (рефетч данных + `refreshValidator()`); монтирует `<ChatGraphValidatorBanner reloadKey={validatorReloadKey} />` и обе таблицы.
- Создан `components/admin/chats/ChatTransitionsTable.tsx` — `'use client'`: таблица переходов (колонки: откуда/куда с `code`+`chatType`, бейдж `conditionType` с цветами, `conditionValue`, `priority`); кнопки создать/редактировать/удалить; монтирует `ChatTransitionForm`/`DeleteTransitionDialog`.
- Создан `components/admin/chats/ChatTransitionForm.tsx` — `'use client'` (rhf + `zodResolver(createTransitionSchema)`): режимы create/edit; поля `fromMessageId`/`toMessageId` (select из реплик), `conditionType` (select); динамика по типу: `CHOICE` → select из choices `from`-реплики (с мягким предупреждением через `useChoiceWarning`), `TRIGGER` → select из `triggerValues` (свободный ввод исключён), `ALWAYS` → `conditionValue` скрыт; серверные ошибки `INVALID_TRIGGER_VALUE`/`INVALID_REFERENCE` → сообщение под формой.
- Создан `components/admin/chats/DeleteTransitionDialog.tsx` — `'use client'`: подтверждение удаления перехода; loading/error states.
- Изменён `components/admin/chats/ChatGraphValidatorBanner.tsx` — добавлен prop `reloadKey?: number`; `useEffect` зависит от него → `ChatsTabs` управляет пересчётом баннера после CRUD.
- Изменён `components/admin/chats/ChatScriptsTable.tsx` — вынута оркестрация вкладок/рефетча в `ChatsTabs`; пробрасывается колбэк `onScriptsMutated`.
- Изменён `components/admin/chats/DeleteScriptDialog.tsx` — подключён живой счётчик `affected-users`: `useEffect` при открытии фетчит `/api/admin/chats/affected-users/${scriptId}`; показывает loading / «N игроков…» / fallback-текст при ошибке запроса.
- Изменён `app/(admin)/admin/chats/page.tsx` — SSR грузит scripts + transitions + slots через `Promise.all`; строит `triggerValues`; передаёт всё в `<ChatsTabs>`.

**UI-правки:**

- `components/admin/chats/ChatScriptForm.tsx` — добавлен `text-gray-900` ко всем `<select>`, `<input>`, `<textarea>` и `<input>` в `ChoicesEditor` (не было явного цвета в light mode — текст наследовал светло-серый из родительского `Field`).
- `components/admin/chats/ChatTransitionForm.tsx` — аналогично добавлен `text-gray-900` ко всем 4 `<select>`.

**Архитектурные решения (зафиксированные развилки):**

- **Источник TRIGGER — все слоты** (`findMany` без фильтра `isActive`): TRIGGER-ребро должно переживать временную деактивацию слота. Расхождение `admin.md` (все) ↔ `phase-5.md` (активные) разрешено в пользу `admin.md`.
- **Генератор TRIGGER data-driven**: читает `slotKey` из БД, не хардкодит `CRACK_P2`/`RDP_VICTOR` — т.к. реальные slotKeys сидера сейчас `crack-1`/`rdp-1` (баг Phase 10, FIXME в seed.ts).
- **UI-оркестрация через `ChatsTabs`**: выделен новый Client Component — убирает дублирование state и делает корректный рефетч баннера после любого CRUD.
- **`updateTransitionSchema` — flat schema** (не discriminated union): для PATCH допустимо, т.к. handler вычисляет effective conditionType/conditionValue самостоятельно и затем вызывает `validateTransitionPayload`.
- **Optimistic locking не применяется**: `ChatTransition` — контент (не игровое состояние). Эндпоинты не принимают `expectedVersion` и не возвращают `version`.

**Изменённые файлы:**

- `constants/chatTriggerEvents.ts` — **создан**
- `lib/admin/chatTransitionApi.ts` — **создан**
- `lib/validations/admin-chats.ts` — **расширен** (schemas + types переходов)
- `types/admin-chats.ts` — **расширен** (ConditionType, ChatTransitionListItem, TriggerValueOption)
- `app/api/admin/chats/transitions/route.ts` — **создан**
- `app/api/admin/chats/transitions/[id]/route.ts` — **создан**
- `app/api/admin/chats/affected-users/[scriptId]/route.ts` — **создан**
- `app/api/admin/chats/trigger-values/route.ts` — **создан**
- `components/admin/chats/ChatsTabs.tsx` — **создан**
- `components/admin/chats/ChatTransitionsTable.tsx` — **создан**
- `components/admin/chats/ChatTransitionForm.tsx` — **создан**
- `components/admin/chats/DeleteTransitionDialog.tsx` — **создан**
- `components/admin/chats/ChatGraphValidatorBanner.tsx` — **изменён** (prop `reloadKey`)
- `components/admin/chats/ChatScriptsTable.tsx` — **изменён** (оркестрация → ChatsTabs)
- `components/admin/chats/DeleteScriptDialog.tsx` — **изменён** (affected-users счётчик)
- `app/(admin)/admin/chats/page.tsx` — **изменён** (SSR transitions + triggerValues → ChatsTabs)

---

## 2026-06-01 — Phase 5 / Таск 3 — CRUD реплик (ChatScript): API + UI

**Сделано:**

- Реализован **Phase 5, Таск 3: CRUD реплик (ChatScript): API + UI** — полный CRUD администратора для реплик чата с защитами от опасных правок, динамическим редактором `choices` и монтажом баннера валидатора графа.

**API:**

- Расширен `lib/validations/admin-chats.ts` — добавлены `createScriptSchema` (поля `chatType`, `code`, `text`, `isStart`, `isEnd`, `hasChoices`, `choices`; `.refine`: `hasChoices=true` ⇒ непустой валидный `choices`; `hasChoices=false` ⇒ `choices → null`) и `updateScriptSchema` (частичная схема без `code` и `chatType` — их смена архитектурно запрещена на уровне типа).
- Создан `app/api/admin/chats/scripts/route.ts` — `GET` (список с опциональным фильтром `?chatType=`; невалидный `chatType` → 400 `VALIDATION_ERROR`; сортировка по `chatType`, затем `code`; включает признак наличия аудио) + `POST` (создать реплику; дубль `code` через Prisma `P2002` → 400 `CODE_EXISTS`; успех → 201). Оба метода защищены `adminAuth` + `ADMIN` → 403.
- Создан `app/api/admin/chats/scripts/[id]/route.ts` — `GET` (деталь; нет записи → 404 `NOT_FOUND`) + `PATCH` (редактирование; попытка сменить `code`/`chatType` → 400; нет записи → 404) + `DELETE` (каскадное удаление `ChatTransition` по схеме; указатели `ChatState` обнуляются через `SetNull`; нет записи → 404; успех → `{ success: true }`). Все методы защищены.

**UI:**

- Создан `types/admin-chats.ts` — интерфейс `ChatScriptListItem` (сериализованный тип для props таблицы, паттерн как `types/admin-keys.ts`).
- Создан `app/(admin)/admin/chats/page.tsx` — Server Component: загружает реплики через Prisma, рендерит `<ChatGraphValidatorBanner>` (первый монтаж баннера из Таска 2) + каркас вкладок «Реплики» / «Переходы» (вторая вкладка — плейсхолдер «Доступно в следующем обновлении»; переключение — клиентский state).
- Создан `app/(admin)/admin/chats/loading.tsx` — Loading UI (скелетон, паттерн как у `keys/loading.tsx`).
- Создан `components/admin/chats/ChatScriptsTable.tsx` — `'use client'`: таблица с колонками `code`, `chatType`, `text` (truncate), `isStart`, `isEnd`, `hasChoices`, значок аудио, действия. Фильтр по `chatType` (client-side). Кнопка «Создать» и действия «Редактировать» / «Удалить» открывают `ChatScriptForm` / `DeleteScriptDialog`. После мутаций — `router.refresh()` (баннер пересчитывается).
- Создан `components/admin/chats/ChatScriptForm.tsx` — `'use client'` (react-hook-form + `zodResolver`): поля `chatType` (disabled при редактировании), `code` (disabled при редактировании), `text`, чекбоксы `isStart`/`isEnd`/`hasChoices`. При `hasChoices=true` — динамический список пар `{label, value}` (кнопки добавить/удалить строку). Серверные ошибки (`CODE_EXISTS`) → сообщение под формой. Используется для создания и редактирования через единый компонент.
- Создан `components/admin/chats/DeleteScriptDialog.tsx` — `'use client'` (Вариант A без живого счётчика): обобщённый текст «Реплика и её переходы будут удалены. Игроки, остановившиеся на этой реплике, вернутся к началу чата.» Живой счётчик (`affected-users`) подключается в Таске 4.

**Изменённые файлы:**

- `lib/validations/admin-chats.ts` — расширен (`createScriptSchema`, `updateScriptSchema`)
- `app/api/admin/chats/scripts/route.ts` — создан
- `app/api/admin/chats/scripts/[id]/route.ts` — создан
- `types/admin-chats.ts` — создан
- `app/(admin)/admin/chats/page.tsx` — создан
- `app/(admin)/admin/chats/loading.tsx` — создан
- `components/admin/chats/ChatScriptsTable.tsx` — создан
- `components/admin/chats/ChatScriptForm.tsx` — создан
- `components/admin/chats/DeleteScriptDialog.tsx` — создан

**Следующее:**

- Phase 5, Таск 4: CRUD переходов (ChatTransition) + TRIGGER + affected-users.

**Проблемы / Заметки:**

- Optimistic locking к `ChatScript` не применяется — контент, не игровое состояние; эндпоинты без `expectedVersion`/`version` (HTTP 409 неактуален).
- Вариант A по `affected-users`: модалка удаления в Таске 3 — обобщённый текст без живого счётчика. Эндпоинт `GET /api/admin/chats/affected-users/[scriptId]` и точный счётчик подключаются в Таске 4.
- Вкладка «Переходы» на `/admin/chats` — плейсхолдер; наполняется в Таске 4.
- `ChatGraphValidatorBanner` (Таск 2) впервые смонтирован здесь.
- **Постфактум — расширение scope:** в процессе реализации к `ChatScript` добавлено поле `author` типа enum `ChatAuthor` (`DETECTIVE` / `PLAYER` / `MARINA` / `ANONYMOUS`), `NOT NULL` с `@default(DETECTIVE)` — для атрибуции реплики (от чьего лица показывается в UI чата, Phase 6–7). Поле присутствует в `createScriptSchema` / `updateScriptSchema`, отображается в таблице и форме. **Потребовалась миграция** `20260601193722_add_chat_script_author` (`CREATE TYPE "ChatAuthor"` + `ALTER TABLE "ChatScript" ADD COLUMN`); за счёт `DEFAULT 'DETECTIVE'` существующие строки заполнились без даунтайма. `database.md` обновлён (enum + поле).

---

## 2026-06-01 — Phase 5 / Таск 2 — Валидатор связности графа + endpoint

**Сделано:**

- Реализован `lib/admin/chatGraphValidator.ts` — чистая серверная функция `validateChatGraph()` без сайд-эффектов. Загружает все `ChatScript` + `ChatTransition` одним батчем, строит индексы (`Map`) и прогоняет 5 инвариантов для каждого `chatType` (`DETECTIVE`, `MARINA`):
  - `NO_OUTGOING` — реплика не `isEnd` и не `hasChoices`, но без исходящих рёбер;
  - `CHOICE_NOT_COVERED` — `hasChoices=true`, но нет перехода `CHOICE` для какого-то `value`;
  - `END_UNREACHABLE` — BFS от `isStart` не достигает ни одной `isEnd`;
  - `NO_START` / `MULTIPLE_START` — 0 или >1 реплики с `isStart` на тип;
  - `DANGLING_EDGE` — переход ссылается на несуществующий узел.
- BFS реализован с `visited`-сетом (защита от циклов); `TRIGGER`-переходы участвуют в обходе как валидные «ждущие» рёбра.
- Созданы и экспортированы типы `ChatGraphIssueType`, `ChatGraphIssue`, `ChatGraphValidationResult` прямо из `chatGraphValidator.ts` — единый источник для route и banner.
- Создан `lib/validations/admin-chats.ts` — Zod-схема `choicesSchema` (`{ label: string, value: string }[]`) + type-guard `parseChoices()` для безопасного чтения `ChatScript.choices` (`Json?`) без `any`. При `hasChoices=true` и невалидных данных — issue `INVALID_CHOICES`, функция не бросает исключение.
- Создан `app/api/admin/chats/validate/route.ts` — `GET`, ADMIN-only (403 для не-ADMIN и неаутентифицированных), вызывает `validateChatGraph()`, возвращает `NextResponse.json(result)`. Без побочных эффектов, без записи в БД.
- Создан `components/admin/chats/ChatGraphValidatorBanner.tsx` — `'use client'`, `fetch('/api/admin/chats/validate')` на монтировании. Три состояния: loading (анимированный скелетон), error (`role="alert"`), success — зелёная карточка «Граф связен» / красная с таблицей issues (`type`, `chatType`, `code`, `message`). Tailwind + `dark:`, семантические теги, a11y (`role="status"` / `role="alert"`). На странице пока не монтируется — подключается в Таске 3.
- На сидовом графе (Таск 1) `GET /api/admin/chats/validate` возвращает `{ valid: true, issues: [] }`.
- `npm run type-check` и `npm run build` — без ошибок; нет `any`, нет неиспользуемых импортов.

**Следующее:**

- Phase 5, Таск 3: CRUD реплик (ChatScript) — `POST/GET /api/admin/chats/scripts`, `app/(admin)/admin/chats/page.tsx` + монтаж `ChatGraphValidatorBanner`.

**Проблемы / Заметки:**

- Баннер создан и компилируется, но **не монтирован** на `/admin/chats` — страница создаётся в Таске 3.
- Известный баг сидера `seedMissionSlots` (некорректные `slotKey` и `rdpPuzzleGridSize: 4`) на валидатор графа не влияет — чинится в Phase 10.

---

## 2026-06-01 — Phase 5, Task 1: Сидер чат-графа + `FinalReportContent`-стабы

**Сделано:**

- Реализован **Phase 5, Task 1: Сидер чат-графа + `FinalReportContent`-стабы** — в `prisma/seed.ts` добавлены две идемпотентные функции, наполняющие БД минимальным связным графом обоих чатов и заглушками концовок финального отчёта.

**Изменения в `prisma/seed.ts`:**

- Добавлены именованные константы `FINAL_CHOICE`, `CHAT_SCRIPTS` (6 реплик), `CHAT_TRANSITIONS` (4 ребра по `code`), `FINAL_REPORT_CONTENT` (2 записи) — единый источник правды, рассинхрон `value` ↔ `finalChoiceValue` невозможен на уровне кода.
- Добавлена `seedChatGraph()`: гард `chatScript.count() > 0 → skip`; внутри `prisma.$transaction` — `createMany` реплик → поиск `code → id` карты → `createMany` переходов. Транзакция гарантирует «всё или ничего» (частичного графа не остаётся при сбое).
- Добавлена `seedFinalReportContent()`: гард `finalReportContent.count() > 0 → skip`; `createMany` двух стабов (`PROTECT`/`ACCUSE`).
- Обе функции вызываются из `main()` после существующих `seedAdminUser` / `seedAppSettings` / `seedMissionSlots` — порядок соблюдён.

**Граф после сидера:**

```
DETECTIVE:  detective_greeting (isStart) --ALWAYS--> detective_end (isEnd)

MARINA:     marina_greeting (isStart) --ALWAYS--> marina_final_choice (hasChoices)
              marina_final_choice --CHOICE PROTECT--> marina_end_protect (isEnd)
              marina_final_choice --CHOICE ACCUSE --> marina_end_accuse  (isEnd)
```

**Изменённые файлы:**

- `prisma/seed.ts` — обновлён (добавлены `seedChatGraph`, `seedFinalReportContent`, константы)

**Следующее:**

- Phase 5, Task 2: Валидатор связности графа (алгоритм) + endpoint.

**Проблемы / Заметки:**

- Известный баг `seedMissionSlots` (вне scope таска): slotKeys `crack-1`/`rdp-1` вместо `CRACK_P2`/`RDP_VICTOR`, `rdpPuzzleGridSize: 4` нарушает инвариант «6 или 7» — исправляется в **Phase 10**, на чат-граф не влияет.

---

## 2026-05-30 — Phase 4, Task 5: Аудит-лог

**Сделано:**

- Реализован **Phase 4, Task 5: Аудит-лог** — read-only просмотр `AdminAuditLog` с cursor-пагинацией, фильтрами по типу/дате/инициатору и обогащением email из `User`/`AdminUser`.

**API:**

- Создан `lib/validations/admin-audit-log.ts` — Zod `querySchema`: фильтры `type`, `userId`, `adminId`, `fromDate`, `toDate`; `limit` через `z.coerce.number()` (1..200, default 50); `cursor` (cuid). Экспорт типа `AuditLogQuery`.
- Создан `app/api/admin/audit-log/route.ts` — только `GET` (нет POST/PATCH/DELETE). Защита `adminAuth` + `ADMIN` → 403. Cursor-пагинация (`take: limit + 1`, если длиннее — последний элемент становится `nextCursor`). Batch-обогащение email: параллельный `findMany` по всем `userId`/`adminId` из результата; если запись удалена — `'<deleted>'`. Ответ: `{ logs: AuditLogItem[], nextCursor: string | null }`.

**UI:**

- Создан `app/(admin)/admin/audit-log/page.tsx` — Server Component: прямой Prisma-запрос первых 50 записей (`orderBy: { createdAt: 'desc' }`); batch-обогащение email на сервере; передаёт `initialLogs` и `initialNextCursor` в `<AuditLogTable>`.
- Создан `app/(admin)/admin/audit-log/loading.tsx` — Skeleton-заглушка на время загрузки страницы.
- Создан `components/admin/audit-log/AuditLogTable.tsx` — `'use client'`; state: `logs`, `nextCursor`, `filters`, `isLoading`; рендерит `<AuditLogFilters>`; таблица: `createdAt`, `type`, инициатор (userId/email или adminId/email), `message`, `metadata`; `metadata` раскрывается по клику строки (`<pre>` с `JSON.stringify`); при смене фильтров — сброс cursor + новый fetch; кнопка «Загрузить ещё» аппендит следующие записи; кнопка скрыта если `nextCursor === null`.
- Создан `components/admin/audit-log/AuditLogFilters.tsx` — `'use client'`; поля: `type`, `userId`, `adminId`, `fromDate`, `toDate`; кнопки «Применить» и «Сбросить»; `fromDate`/`toDate` преобразуются в ISO datetime перед передачей в `onFilter`.

**Типы:**

- Создан `types/admin-audit-log.ts` — интерфейс `AuditLogItem` (поля `AdminAuditLog` + обогащённые `userEmail`/`adminEmail`).

**Изменённые файлы:**

- `lib/validations/admin-audit-log.ts` — создан
- `app/api/admin/audit-log/route.ts` — создан
- `types/admin-audit-log.ts` — создан
- `app/(admin)/admin/audit-log/page.tsx` — создан
- `app/(admin)/admin/audit-log/loading.tsx` — создан
- `components/admin/audit-log/AuditLogTable.tsx` — создан
- `components/admin/audit-log/AuditLogFilters.tsx` — создан

**Следующее:**

- Phase 4 завершена. Следующая фаза согласно `.docs/phases/_status.md`.

**Проблемы / Заметки:**

- N/A

---

## 2026-05-30 — Phase 4, Task 4: Настройки приложения (AppSettings)

**Сделано:**

- Реализован **Phase 4, Task 4: Настройки приложения (AppSettings)** — просмотр и редактирование глобальных настроек приложения (`supportEmail`, `privacyPolicyUrl`, `defaultMarketingConsent`) с юридическими предупреждениями (152-ФЗ/GDPR).

**API:**

- Создан `lib/validations/app-settings.ts` — Zod `updateSettingsSchema`: все три поля опциональны (`email().optional()`, `url().optional()`, `boolean().optional()`).
- Создан `app/api/admin/app-settings/route.ts` — `GET` (findFirst → полный singleton-объект; 500 если запись не инициализирована) + `PATCH` (Zod-валидация → 400 `VALIDATION_ERROR`; findFirst → update → обновлённый объект). Нет `POST`/`DELETE`. Оба метода защищены `adminAuth` + `ADMIN` → 403.

**UI:**

- Создан `app/(admin)/admin/settings/page.tsx` — Server Component: читает `AppSettings` через Prisma напрямую; передаёт `initialData` в `<AppSettingsForm>`; показывает ошибку если singleton не инициализирован.
- Создан `components/admin/app-settings/AppSettingsForm.tsx` — `'use client'`; react-hook-form + Zod; двухколоночный layout (label / input); кнопки «Отменить» (сброс формы) и «Сохранить» (активны только при `isDirty`); toast-уведомления успех/ошибка без перезагрузки страницы; `reset()` с данными ответа после успешного PATCH; отображение `updatedAt`.
- Создан `components/admin/app-settings/PlaceholderWarningBanner.tsx` — `'use client'`; реактивно обновляется через `watch()`; показывается если хотя бы одно поле содержит `example.com`; ссылается на 152-ФЗ ст. 9 ч. 4.
- Создан `components/admin/app-settings/MarketingConsentWarningModal.tsx` — `'use client'`; модалка с предупреждением о нарушении 152-ФЗ (РФ) и GDPR (ЕС); кнопки «Отмена» и «Я понимаю и сохраняю»; срабатывает только при переключении `false → true`.

**Изменённые файлы:**

- `lib/validations/app-settings.ts` — создан
- `app/api/admin/app-settings/route.ts` — создан
- `app/(admin)/admin/settings/page.tsx` — создан
- `components/admin/app-settings/AppSettingsForm.tsx` — создан
- `components/admin/app-settings/PlaceholderWarningBanner.tsx` — создан
- `components/admin/app-settings/MarketingConsentWarningModal.tsx` — создан

**Следующее:**

- Phase 4, Task 5: Аудит-лог — API + UI.

---

## 2026-05-30 — Phase 4, Task 3: Администраторы — API + UI

**Сделано:**

- Реализован **Phase 4, Task 3: Администраторы — API + UI** — полный CRUD администраторов с защитами от потери доступа к системе, генерацией паролей с показом один раз и детальной страницей управления.

**API:**

- Создан `lib/validations/admin-admins.ts` — Zod `createAdminSchema`: email с `trim().toLowerCase()`.
- Создан `app/api/admin/admins/route.ts` — `GET` (список без `passwordHash`, `createdAt desc`) + `POST` (`generatePassword(12)` → `hashPassword`; дубль email → 400 `EMAIL_EXISTS`; plain-пароль в ответе один раз; аудит `admin_created`).
- Создан `app/api/admin/admins/[id]/route.ts` — `GET` (детали) + `DELETE` (защиты: 400 `CANNOT_DELETE_SELF` / 400 `CANNOT_DELETE_LAST_ADMIN`; 404 если не найден; аудит `admin_deleted`).
- Создан `app/api/admin/admins/[id]/password/route.ts` — `PATCH` (новый `generatePassword(12)`, plain-пароль один раз; 404 если не найден; аудит `admin_password_changed`).

**UI:**

- Создан `types/admin-admins.ts` — интерфейсы `AdminListItem`, `AdminDetail`, `CreateAdminResponse`, `ResetPasswordResponse`, `AdminAuditLogItem`.
- Создан `app/(admin)/admin/admins/page.tsx` — Server Component: список администраторов через Prisma, рендер `<AdminsTable>`.
- Создан `app/(admin)/admin/admins/new/page.tsx` — страница создания администратора, рендер `<AdminForm>`.
- Создан `app/(admin)/admin/admins/[id]/page.tsx` — Server Component: детальная карточка, рендер `<AdminDetail>` с данными администратора и передачей `currentAdminId`.
- Создан `components/admin/admins/AdminsTable.tsx` — таблица (Email, Статус, Дата регистрации, кнопка «Детали»), кнопка «Добавить» внизу.
- Создан `components/admin/admins/AdminForm.tsx` — форма создания (react-hook-form + Zod), при успехе открывает `NewPasswordModal`, при EMAIL_EXISTS — инлайн-ошибка.
- Создан `components/admin/admins/NewPasswordModal.tsx` — модалка показа сгенерированного пароля один раз с кнопкой «Скопировать» (clipboard API).
- Создан `components/admin/admins/AdminDetail.tsx` — детальная страница: информация об администраторе, кнопка «Сгенерировать пароль» (показывает `NewPasswordModal`), история операций, кнопка «Удалить» (открывает `ConfirmDeleteModal`).
- Создан `components/admin/admins/ConfirmDeleteModal.tsx` — модалка подтверждения удаления с обработкой ошибок `CANNOT_DELETE_SELF` / `CANNOT_DELETE_LAST_ADMIN`.

**Дополнительный функционал (сверх таска):**

- Создан `app/api/admin/admins/[id]/audit-logs/route.ts` — `GET`: история операций конкретного администратора (`adminId = id`); cursor-based пагинация (20 записей); серверный поиск по `message ILIKE`; query-параметры: `cursor` (CUID), `search` (string, max 100).
- В `AdminDetail.tsx` реализован блок «История операций»: клиентский fetch при монтировании; поисковое поле с debounce 400ms (сброс списка при новом поиске); кнопка «Загрузить ещё» (появляется только при наличии `nextCursor`); состояния loading / error / empty / данные.
- Обновлён `admin.md` — в раздел «Подраздел: Администраторы» добавлен новый эндпоинт `GET /api/admin/admins/[id]/audit-logs` с описанием query-параметров и формата ответа.

**Изменённые файлы:**

- `lib/validations/admin-admins.ts` — создан
- `types/admin-admins.ts` — создан
- `app/api/admin/admins/route.ts` — создан
- `app/api/admin/admins/[id]/route.ts` — создан
- `app/api/admin/admins/[id]/password/route.ts` — создан
- `app/api/admin/admins/[id]/audit-logs/route.ts` — создан (дополнительно)
- `app/(admin)/admin/admins/page.tsx` — создан
- `app/(admin)/admin/admins/new/page.tsx` — создан
- `app/(admin)/admin/admins/[id]/page.tsx` — создан
- `components/admin/admins/AdminsTable.tsx` — создан
- `components/admin/admins/AdminForm.tsx` — создан
- `components/admin/admins/NewPasswordModal.tsx` — создан
- `components/admin/admins/AdminDetail.tsx` — создан
- `components/admin/admins/ConfirmDeleteModal.tsx` — создан
- `.docs/modules/admin.md` — обновлён (новый эндпоинт audit-logs)

**Следующее:**

- Phase 4, Task 4: Настройки приложения (AppSettings).

---

## 2026-05-30 — Phase 4, Task 2.1: Auth — изоляция сессий admin/player

**Сделано:**

- Реализован **Phase 4, Task 2.1: Auth — изоляция сессий admin/player** — устранён конфликт сессий между игровой и административной зонами при одновременном использовании в одном браузере.
- Создан `lib/auth-admin.ts` — отдельный NextAuth-инстанс только с admin Credentials-провайдером, `basePath: '/api/auth-admin'`, кастомное имя cookie (`__Secure-admin.session-token` в production, `admin.session-token` в dev).
- Создан `app/api/auth-admin/[...nextauth]/route.ts` — обработчик admin auth (`GET`/`POST`).
- Создан `components/auth/AdminAuthProvider.tsx` — клиентский `SessionProvider` с `basePath="/api/auth-admin"` для корректной работы `signIn` в форме логина администратора.
- Обновлён `lib/auth.ts` — удалён Credentials-провайдер `id: 'admin'`, в `session`-callback сужена проверка типа до `token.type === 'PLAYER'`.
- Обновлён `proxy.ts` — для `/admin/*` зоны admin-JWT декодируется напрямую через `decode()` из `@auth/core/jwt` (нельзя обернуть двумя `auth()`-врапперами одновременно); для `/dashboard/*` — `req.auth` из player-враппера без изменений.
- Обновлён `app/(admin)/admin/layout.tsx` — `auth()` заменён на `adminAuth()` из `lib/auth-admin`.
- Обновлён `app/(auth-admin)/layout.tsx` — `children` обёрнуты в `<AdminAuthProvider>`, добавлен явный возвращаемый тип `React.ReactElement`.
- Обновлены все 10 admin API-роутов (`keys/route.ts`, `keys/[id]/route.ts`, `keys/import/route.ts`, `keys/export/route.ts`, `users/route.ts`, `users/[id]/route.ts`, `users/[id]/state/route.ts`, `users/[id]/reset-mission/route.ts`, `users/[id]/complete-mission/route.ts`, `users/export/route.ts`) — импорт заменён на `adminAuth as auth` из `lib/auth-admin`.
- `npm run type-check` — без ошибок.

**Исправлено в ходе DoD-ревью:**

- Критический production-баг: имя cookie в `lib/auth-admin.ts` было захардкожено как `'admin.session-token'`, а `proxy.ts` в production ожидал `'__Secure-admin.session-token'`. Несовпадение имён (они же используются как `salt` при `decode`) приводило к тому, что любой администратор с валидной сессией всегда получал редирект на `/admin-login` на VPS. Исправлено введением константы `ADMIN_COOKIE_NAME` с условием по `NODE_ENV`.

**Следующее:**

- Phase 4, Task 3: Администраторы — API + UI.

**Проблемы / Заметки:**

- Auth.js v5 при кастомном `cookies.sessionToken.name` **не добавляет** `__Secure-` автоматически — prefix является частью имени по умолчанию, а пользовательский конфиг полностью перетирает дефолт через deep-merge (`@auth/core/lib/init.js:69`). Имя задаётся явно.

---

## 2026-05-30 — Phase 4, Task 1: Пользователи — API + утилиты

**Сделано:**

- Реализован **Phase 4, Task 1: Пользователи — API + утилиты** — полный REST API управления игроками в админке: список с пагинацией/фильтрами, детали, бан/разбан с аудитом, удаление, диагностический snapshot, экспорт email в CSV, 501-заглушки для отложенных операций коррекции прогресса.
- Создан `lib/validations/admin-users.ts` — три Zod-схемы: `listUsersQuerySchema` (пагинация, поиск, фильтр статуса, сортировка), `updateUserSchema` (только `isBlocked`), `exportUsersQuerySchema` (фильтры для экспорта).
- Создан `app/api/admin/users/route.ts` — `GET`: offset-пагинация, поиск по `email`/`name` (OR через `contains`), фильтр `status=all|active|blocked`, сортировка по `createdAt desc`; `passwordHash` исключён явным `select`; `accessKey.key` включён; ответ `{ users, total, page, limit, totalPages }`.
- Создан `app/api/admin/users/[id]/route.ts` — `GET` (детали + `accessKey.key/isBlocked`, 404 при отсутствии) + `PATCH` (только `isBlocked` через `updateUserSchema`; `writeAuditLog('user_blocked'/'user_unblocked')`) + `DELETE` (каскадное удаление через `onDelete: Cascade` в схеме; `AccessKey.currentActivations` не изменяется).
- Создан `app/api/admin/users/[id]/state/route.ts` — `GET` полный диагностический snapshot: `user`, `gameProgress`, `chatState` (с join `ChatScript` по `currentDetectiveMessageId`/`currentMarinaMessageId` для получения `code` и `text`), `missionProgress` (с join `MissionSlot` для `slotKey`), `crackSessions` (с join `MissionSlot`, **без** `targetWord`), `hintProgress`, `logsCount`, `recentLogs` (10 последних). Никогда: `passwordHash`, `targetWord`, `correctOption`.
- Создан `app/api/admin/users/export/route.ts` — `GET`: применяет фильтры `exportUsersQuerySchema`, запрашивает только `email`, вызывает `generateUsersEmailCsv` из `lib/admin/csvExport.ts`, отдаёт с заголовком `Content-Disposition: attachment; filename="users-emails.csv"`.
- Создан `app/api/admin/users/[id]/reset-mission/route.ts` — `POST`-заглушка: сначала проверка `auth()` + `ADMIN` → 403, затем 501 `{ error: "NOT_IMPLEMENTED: доступно после реализации миссий (Фаза 10+)" }`.
- Создан `app/api/admin/users/[id]/complete-mission/route.ts` — аналогичная `POST`-заглушка → 501.
- Все 7 эндпоинтов защищены двойным слоем: `proxy.ts` (ветка ADMIN) + явная проверка `auth()` + `session.user.type === 'ADMIN'` → 403.
- `npm run type-check` — без ошибок.

**Изменённые файлы:**

- `lib/validations/admin-users.ts` — создан
- `app/api/admin/users/route.ts` — создан
- `app/api/admin/users/[id]/route.ts` — создан
- `app/api/admin/users/[id]/state/route.ts` — создан
- `app/api/admin/users/export/route.ts` — создан
- `app/api/admin/users/[id]/reset-mission/route.ts` — создан
- `app/api/admin/users/[id]/complete-mission/route.ts` — создан

**Проблемы / Заметки:**

- `PATCH isBlocked=true` не разлогинивает игрока мгновенно — блокировка вступает в силу при следующей попытке входа (проверка через `check-block` endpoint в `LoginForm`).
- `AccessKey.currentActivations` намеренно не декрементируется при удалении пользователя — ключ уже был активирован, слот потрачен.
- Snapshot (`/state`) не включает `targetWord` из `CrackSession` — только `attemptsUsed`/`maxAttempts`/`slotKey`. Это принципиальное архитектурное ограничение (секрет игры не должен утекать через админку).

---

## 2026-05-27 — Phase 3, Task 3: UI ключей доступа

**Сделано:**

- Реализован **Phase 3, Task 3: UI ключей доступа** — полноценный интерфейс управления ключами доступа в зоне `/admin/keys`: таблица с поиском, фильтрацией и пагинацией, inline-аккордеон деталей ключа, форма добавления и CSV-импорт.
- Создан `app/(admin)/admin/keys/page.tsx` — Server Component, выполняет начальную выборку через прямой Prisma-запрос (`buildAccessKeysWhere` + `findMany`), передаёт `initialKeys`, `initialTotal`, `initialPage` в `<KeysTable>`.
- Создан `app/(admin)/admin/keys/new/page.tsx` — Server Component-обёртка, рендерит `<AddKeyForm />` и `<BulkImportForm />` рядом.
- Создан `components/admin/keys/KeysTable.tsx` — `'use client'`, таблица с поиском (debounce 300ms через `useEffect`), `KeysFiltersPanel`, offset-пагинацией (нумерные кнопки), кешированием деталей в `Map<string, details>`, открытием inline-аккордеона `<KeyRowDetails />`.
- Создан `components/admin/keys/KeyRowDetails.tsx` — `'use client'`, содержимое раскрытой строки: список email'ов пользователей ключа, редактируемый лимит активаций (`PATCH /api/admin/keys/[id]`), кнопки «Заблокировать» / «Активировать» / «Удалить» с открытием соответствующих диалогов.
- Создан `components/admin/keys/KeysFiltersPanel.tsx` — `'use client'`, фильтры: сортировка по дате (новые/старые), статус (all / active / blocked), активации (all / lt5 / eq5 / gt5). Смена фильтра сбрасывает пагинацию на стр. 1.
- Создан `components/admin/keys/ExportKeysModal.tsx` — `'use client'`, модалка выбора фильтров (`status` + `activations`) перед скачиванием, триггерит `window.location.href = GET /api/admin/keys/export?...`.
- Создан `components/admin/keys/AddKeyForm.tsx` — `'use client'`, react-hook-form + `zodResolver(createKeySchema)`, поля `key` (обязательный) и `maxActivations` (1..100), `POST /api/admin/keys`, после успеха — редирект на `/admin/keys`.
- Создан `components/admin/keys/BulkImportForm.tsx` — `'use client'`, drag-and-drop через `onDragOver`/`onDrop` + `<input type="file">`, предпросмотр первых строк файла, `POST /api/admin/keys/import` (multipart), отображение `{ created, skipped, errors }`.
- Создан `components/admin/keys/BlockKeyDialog.tsx` — `'use client'`, диалог с текстовым полем `blockReason` (обязательное), `PATCH /api/admin/keys/[id]` с `{ isBlocked: true, blockReason }`.
- Создан `components/admin/keys/DeleteKeyDialog.tsx` — `'use client'`, диалог подтверждения, `DELETE /api/admin/keys/[id]`.
- Обновлён `components/admin/layout/AdminNav.tsx` — добавлен тип `NavGroup` с полем `children[]`; пункт «Ключи доступа» переведён в аккордеон с подпунктами «Список» (`/admin/keys`) и «Добавление» (`/admin/keys/new`); состояние открытости — `useState<string | null>`, при монтировании автоматически раскрывается группа, чей `basePath` совпадает с текущим `pathname`.
- `npm run type-check` и `npm run lint` — без ошибок.

**Изменённые файлы:**

- `app/(admin)/admin/keys/page.tsx` — создан
- `app/(admin)/admin/keys/new/page.tsx` — создан
- `components/admin/keys/KeysTable.tsx` — создан
- `components/admin/keys/KeyRowDetails.tsx` — создан
- `components/admin/keys/KeysFiltersPanel.tsx` — создан
- `components/admin/keys/ExportKeysModal.tsx` — создан
- `components/admin/keys/AddKeyForm.tsx` — создан
- `components/admin/keys/BulkImportForm.tsx` — создан
- `components/admin/keys/BlockKeyDialog.tsx` — создан
- `components/admin/keys/DeleteKeyDialog.tsx` — создан
- `components/admin/layout/AdminNav.tsx` — обновлён (аккордеон для группы «Ключи»)

**Проблемы / Заметки:**

- `blockReason` без `isBlocked` в PATCH-запросе молча игнорируется на уровне API (Task 2) — в UI `BlockKeyDialog` всегда отправляет оба поля вместе, так что кейс не достижим через интерфейс.
- Аккордеон в `AdminNav` реализован только для группы «Ключи» — остальные пункты навигации остаются flat-ссылками (по scope таска).

---

## 2026-05-27 — Phase 3, Task 2: API ключей доступа + серверные утилиты

**Сделано:**

- Реализован **Phase 3, Task 2: API ключей доступа + серверные утилиты** — полный REST API для CRUD ключей, CSV-импорт/экспорт с фильтрами, универсальная утилита аудит-лога.
- Создан `lib/validations/admin-keys.ts` — 5 Zod-схем: `listKeysQuerySchema` (пагинация + поиск + фильтры + сортировка), `createKeySchema`, `updateKeySchema` (refine: минимум одно поле), `importCsvRowSchema`, `exportQuerySchema`.
- Создан `lib/admin/auditLog.ts` — `writeAuditLog(type, params)`, пишет в `AdminAuditLog`. Принимает `userId?` и `adminId?` независимо, `metadata` типизирован через `Prisma.InputJsonValue`.
- Создан `lib/admin/csvImport.ts` — `parseKeysCsv(text)`, ручной парсинг без зависимостей. Валидирует заголовок, опциональная колонка `maxActivations` (default 5), каждая строка через `importCsvRowSchema.safeParse`.
- Создан `lib/admin/csvExport.ts` — `generateKeysCsv(keys)` (колонки: key, maxActivations, currentActivations, isBlocked, createdAt) + заготовка `generateUsersEmailCsv` для будущих фаз.
- Создан `lib/admin/accessKeyFilters.ts` — `buildAccessKeysWhere` (Prisma-фильтр по q/status/activations) + `buildWhereFromExportQuery` для экспорта.
- Создан `app/api/admin/keys/route.ts` — `GET` (список с offset-пагинацией, поиск по key/user.email, фильтры, сортировка; возвращает `{ keys, total, page, totalPages }`) + `POST` (создание; дубль → 400 `KEY_EXISTS`).
- Создан `app/api/admin/keys/[id]/route.ts` — `GET` (детали ключа + пользователи; `passwordHash` не включён через явный `select`) + `PATCH` (обновление maxActivations с защитой `MAX_BELOW_CURRENT`; блокировка/разблокировка с записью `blockedAt` и аудитом) + `DELETE` (запрет при наличии пользователей → 400 `HAS_USERS`).
- Создан `app/api/admin/keys/import/route.ts` — `POST`, читает `multipart/form-data` или `text/plain`, парсит CSV, создаёт ключи параллельно через `Promise.allSettled`, возвращает `{ created, skipped, errors }`.
- Создан `app/api/admin/keys/export/route.ts` — `GET`, применяет фильтры `status` + `activations`, отдаёт CSV с заголовком `Content-Disposition: attachment`.
- Все эндпоинты защищены двумя слоями: `proxy.ts` (страницы `/admin/*`) + явная проверка `auth()` + `session.user.type === 'ADMIN'` → 403.
- `npm run type-check` и `npm run lint` — без ошибок.

**Изменённые файлы:**

- `lib/validations/admin-keys.ts` — создан
- `lib/admin/auditLog.ts` — создан
- `lib/admin/csvImport.ts` — создан
- `lib/admin/csvExport.ts` — создан
- `lib/admin/accessKeyFilters.ts` — создан
- `app/api/admin/keys/route.ts` — создан
- `app/api/admin/keys/[id]/route.ts` — создан
- `app/api/admin/keys/import/route.ts` — создан
- `app/api/admin/keys/export/route.ts` — создан

**Проблемы / Заметки:**

- `writeAuditLog` вызывается до `prisma.accessKey.update` в PATCH-хендлере (вне транзакции). При сбое апдейта аудит-запись сохранится. Намеренное решение — лог фиксирует «намерение» действия; критичным не считается.
- `blockReason` без `isBlocked` в PATCH-запросе молча игнорируется — по спеке корректно (поле устанавливается только вместе с блокировкой). Актуально при разработке UI в Task 3.

---

## 2026-05-27 — Phase 3, Task 1: Admin layout + навигация

**Сделано:**

- Реализован **Phase 3, Task 1: Admin layout + навигация** — полноценный layout для зоны `/admin/*` с sidebar-навигацией, баннером продакшен-предупреждений и статистикой на главной.
- Создан `app/(admin)/admin/layout.tsx` — Server Component, двойная защита сессии (дополнительная к `proxy.ts`): проверяет `session.user.type === 'ADMIN'`, иначе редирект на `/admin-login`. Оркестрирует `<AdminNav />` + `<AdminBanners />` + `{children}`.
- Создан `components/admin/layout/AdminNav.tsx` — `'use client'`, sidebar с 11 пунктами навигации (главная «Панель» + 10 разделов). Активный пункт определяется через `usePathname()`: точное совпадение для `/admin`, `startsWith` для вложенных роутов. Использует новые Tailwind-токены `admin.sidebar-*` / `admin.nav-*`.
- Создан `components/admin/layout/AdminBanners.tsx` — Server Component, читает `AppSettings` через Prisma. Отображает предупреждающий баннер (ссылка на `/admin/settings`) если `supportEmail` или `privacyPolicyUrl` содержат `example.com`. При отсутствии записи в БД — баннер не рендерится.
- Обновлён `app/(admin)/admin/page.tsx` — заглушка заменена на реальную статистику: три Prisma-запроса параллельно через `Promise.all` (`AccessKey.count`, `User.count`, `MissionSlot.count` с `isActive: true`). Отображает три карточки-счётчика.
- Обновлён `tailwind.config.ts` — добавлены 6 токенов в секцию `[ADMIN-DASHBOARD]`: `sidebar-bg`, `sidebar-border`, `nav-text`, `nav-active-bg`, `nav-active-text`, `nav-hover-bg`.

**Изменённые файлы:**

- `app/(admin)/admin/layout.tsx` — создан
- `components/admin/layout/AdminNav.tsx` — создан
- `components/admin/layout/AdminBanners.tsx` — создан
- `app/(admin)/admin/page.tsx` — обновлён (статистика вместо заглушки)
- `tailwind.config.ts` — добавлены admin sidebar-токены

**Проблемы / Заметки:**

- N/A

---

## 2026-05-25 — Phase 2: постфактум-правки и доработки

**Сделано:**

- Создан `app/(game)/dashboard/loading.tsx` — Loading UI для dashboard. Полноэкранная заглушка на тёмном фоне с текстом «Loading...» и анимированным прогресс-баром (cyan, fake-progress от 0% до ~92%, `cubic-bezier(0.05, 0.85, 0.2, 1)`, 2.8s).
- Исправлен `lib/device-detection-client.ts` — убрана проверка высоты (`h < MIN_VIEWPORT_HEIGHT`) и детекция `unknown`-устройств по touch-признакам. Оставлена только проверка ширины `innerWidth < 1024`. Причина: проверка высоты давала ложные срабатывания на десктопе при открытых DevTools; проверка `maxTouchPoints > 1` ошибочно блокировала Windows-ноутбуки с тачскрином.
- Обновлён `components/game/StatusBar.tsx` — убраны хардкодные значения, компонент теперь принимает `targetName: string` пропом.
- Создан `constants/gameConfig.ts` — константа `GAME_TARGET_NAME = 'ВИКТОР ПАК'`.
- Обновлён `components/game/DashboardClient.tsx` — передаёт `targetName={GAME_TARGET_NAME}` в `StatusBar`; убран временный `DEMO_MISSION_TYPES`, восстановлена фильтрация по `activeMissionTypes` из БД.
- Обновлён `components/game/MissionCard.tsx` — убрана иконка `info-icon` из футера модального окна; адаптивность: `min-h-[200px]` + иконка `100px` до `2xl`, `min-h-[480px]` + `170px` от `2xl`.
- Обновлён `components/game/DashboardClient.tsx` — сайдбар чатов `w-[320px]` до `2xl`, `w-[455px]` от `2xl`; сетка миссий `grid-cols-1` до `2xl`, `grid-cols-3` от `2xl`.
- `npm run type-check` — ✅ без ошибок.

**Изменённые файлы:**

- `app/(game)/dashboard/loading.tsx` — создан
- `lib/device-detection-client.ts` — изменён
- `constants/gameConfig.ts` — создан
- `components/game/StatusBar.tsx` — изменён
- `components/game/DashboardClient.tsx` — изменён
- `components/game/MissionCard.tsx` — изменён

**Проблемы / Заметки:**

- Высота (`MIN_VIEWPORT_HEIGHT = 700`) намеренно исключена из клиентской проверки — осознанное решение, расходится с оригинальным DoD таска 2, но обосновано ложными срабатываниями на десктопе.
- Loading-компонент использует fake-progress (без реального источника данных) — стандартный паттерн для `loading.tsx` в Next.js App Router.

---

## 2026-05-25 — Phase 2, Task 3: OperationLog + API прогресса и логов

**Сделано:**

- Реализован **Phase 2, Task 3: OperationLog + API прогресса и логов** — история операций на dashboard, два API-эндпоинта, серверная утилита логирования.
- Создан `constants/logTemplates.ts` — объект `logTemplates` с 17 шаблонами из спецификации `logs.md` (onboarding, crack, decipher, rdp, final-report, mission overview, restart, admin-corrections) + тип `LogTemplateKey`.
- Создан `lib/operationLog.ts` — `writeLog({ userId, templateKey, params?, type })` — единая точка записи в `OperationLog`; `renderLogMessage(templateKey, params)` — подстановка параметров по имени через regex `{key}`, экспортирован отдельно для использования внутри `prisma.$transaction`.
- Создан `app/api/logs/route.ts` — `GET`: чтение логов текущего игрока, auth PLAYER only, query param `limit` (default 100, max 500), сортировка `createdAt DESC`.
- Создан `app/api/progress/route.ts` — `GET`: параллельный запрос `gameProgress` + `completedMissions` + `activeMissionTypes`; auth PLAYER only; возвращает 404 если `GameProgress` не существует.
- Создан `store/logStore.ts` — Zustand store `{ logs, setLogs, refreshLogs() }`; `refreshLogs` дёргает `GET /api/logs` и обновляет state; `'use client'` директива.
- Создан `components/game/operation-log/LogEntry.tsx` — `'use client'`, форматирует строку `[ЧЧ:ММ] сообщение` через `Intl.DateTimeFormat`, цвет по `LogType`: `SUCCESS → text-green-400`, `ERROR → text-red-400`, `INFO → text-slate-400`.
- Создан `components/game/operation-log/OperationHistory.tsx` — `'use client'`, вызывает `refreshLogs()` на маунте, рендерит список `LogEntry`, пустое состояние «Нет записей», скролл внутри контейнера `max-h-[40vh]`.
- Обновлён `components/game/DashboardClient.tsx` — заглушка `OperationHistoryPlaceholder` заменена на `<OperationHistory />`; удалён неиспользуемый локальный компонент.
- Установлен `zustand` как зависимость проекта.

**Изменённые файлы:**

- `constants/logTemplates.ts` — создан
- `lib/operationLog.ts` — создан
- `app/api/logs/route.ts` — создан
- `app/api/progress/route.ts` — создан
- `store/logStore.ts` — создан
- `components/game/operation-log/LogEntry.tsx` — создан
- `components/game/operation-log/OperationHistory.tsx` — создан
- `components/game/DashboardClient.tsx` — обновлён (интеграция `OperationHistory`)
- `package.json` — добавлена зависимость `zustand`

**Проблемы / Заметки:**

- `POST /api/logs` намеренно не создан — архитектурный запрет (клиент не может писать логи напрямую).
- `renderLogMessage` экспортируется отдельно для атомарных транзакций: внутри `prisma.$transaction` вызов `writeLog()` невозможен (транзакционный контекст), поэтому будущие игровые эндпоинты используют `renderLogMessage` для сборки сообщения, а затем `prisma.operationLog.create` внутри транзакции.
- Пункты DoD, требующие ручной проверки: корректность JSON `/api/progress` для нового юзера, `writeLog()` через Prisma Studio, отсутствие ошибок в консоли браузера.

---

## 2026-05-25 — Phase 2, Task 2: MobileBlock + MobileGuard

**Сделано:**

- Реализован **Phase 2, Task 2: MobileBlock + MobileGuard** — трёхслойная защита от мобильных устройств и малых экранов.
- Создан `lib/device-detection.ts` — тип `Device` (`'phone' | 'tablet' | 'desktop' | 'unknown'`), функция `detectDeviceFromHeaders(h: Headers): Device`; парсит `User-Agent` (regex `PHONE_REGEX` / `TABLET_REGEX`) + заголовок `Sec-CH-UA-Mobile` (Client Hints).
- Создан `lib/device-detection-client.ts` — функция `isBlockedByViewport(device: Device): boolean`; проверяет `window.innerWidth`/`window.innerHeight` против `MIN_VIEWPORT_WIDTH`/`MIN_VIEWPORT_HEIGHT`, а также `(pointer: coarse)` + `navigator.maxTouchPoints` для `unknown`-устройств.
- Создан `components/mobile-block/MobileBlock.tsx` — статичная Server Component-заглушка с текстом из констант.
- Создан `components/mobile-block/MobileGuard.tsx` — `'use client'`, финальная проверка viewport при монтировании + реакция на `resize`/`orientationchange`; если `isBlockedByViewport` → рендерит `<MobileBlock />`, иначе — `{children}`.
- Создан `constants/mobileBlockText.ts` — `MOBILE_BLOCK_TITLE`, `MOBILE_BLOCK_SUBTITLE`.
- Обновлён `app/layout.tsx` — добавлен `await headers()` + `detectDeviceFromHeaders`; `phone` → немедленный возврат `<MobileBlock />` без рендера приложения (FOUC = 0); остальные устройства → `<MobileGuard initialDevice={device}>{children}</MobileGuard>`.
- Обновлён `app/globals.css` — добавлена CSS-страховка `.mobile-block-fallback` для планшетов с медленной гидрацией.

**Изменённые файлы:**

- `lib/device-detection.ts` — создан
- `lib/device-detection-client.ts` — создан
- `components/mobile-block/MobileBlock.tsx` — создан
- `components/mobile-block/MobileGuard.tsx` — создан
- `constants/mobileBlockText.ts` — создан
- `app/layout.tsx` — обновлён (серверная детекция + MobileGuard)
- `app/globals.css` — обновлён (CSS-страховка)

**Проблемы / Заметки:**

- Три слоя детекции: сервер (UA + Client Hints) → клиент (viewport + pointer) → CSS (FOUC-страховка).
- DoD: часть пунктов требует ручной проверки на реальных устройствах (iPhone Safari, Chrome Android, iPad portrait) — отмечены как pending в TASK.md.

---

## 2026-05-25 — Phase 2, Task 1: Dashboard layout + StatusBar + MissionCards

**Сделано:**

- Реализован **Phase 2, Task 1: Dashboard layout + StatusBar + MissionCards**.
- Создан `app/(game)/layout.tsx` — Server Component, содержит `LogoutButton` в фиксированном положении `bottom-4 right-4`.
- Обновлён `app/(game)/dashboard/page.tsx` — Prisma-запрос активных типов миссий (`missionSlot.findMany` с `distinct: ['missionType']`), передача `activeMissionTypes` в `DashboardClient`.
- Создан `components/game/DashboardClient.tsx` — `'use client'`, фильтрует миссии по `activeMissionTypes`, оркестрирует `StatusBar` + `MissionCard` × N + placeholder `OperationHistoryPlaceholder` (Task 3) + placeholder чат-панелей (будущие фазы); кнопка «Подсказка» в `disabled` (Phase 9).
- Создан `components/game/StatusBar.tsx` — `'use client'`, три статичных индикатора: СТАТУС / ЦЕЛЬ / ДОСТУП (станут динамическими в будущих фазах).
- Создан `components/game/MissionCard.tsx` — `'use client'`, карточка миссии с кнопкой «Открыть», при клике открывает `MissionModal` с формой запуска; Escape и клик по backdrop закрывают модал; `mode: 'onChange'` для немедленной валидации; все `<label>` связаны с `<input>` через `htmlFor`/`id`.
- Создан `lib/validations/missions.ts` — Zod-схемы: `crackLaunchSchema` (url + login), `decipherLaunchSchema` (folderPath + cipherKey), `rdpLaunchSchema` (ip); экспортированы inferred-типы.
- Создан `constants/screenRequirements.ts` — `MIN_VIEWPORT_WIDTH = 1024`, `MIN_VIEWPORT_HEIGHT = 700`.

**DoD-правки в ходе ревью:**

- Добавлен `mode: 'onChange'` в `useForm` всех трёх форм — клиентская валидация работает при вводе без submit.
- Убраны inline styles: `letterSpacing: '-0.05em'` заменён на `tracking-[-0.05em]`; `radial-gradient` заменён на Tailwind arbitrary property `[background:radial-gradient(...)]`.
- Добавлены `htmlFor` на все `<label>` и `id` на все `<input>` в формах миссий.

**Изменённые файлы:**

- `app/(game)/layout.tsx` — создан
- `app/(game)/dashboard/page.tsx` — обновлён (был заглушкой)
- `components/game/DashboardClient.tsx` — создан
- `components/game/StatusBar.tsx` — создан
- `components/game/MissionCard.tsx` — создан
- `lib/validations/missions.ts` — создан
- `constants/screenRequirements.ts` — создан

**Проблемы / Заметки:**

- `decipherLaunchSchema` расширена полем `cipherKey` относительно TASK.md — осознанное решение, требует ключ дешифрования по игровой механике.
- Кнопки «Начать» в формах визуально активны (по референсу), функционально не подключены — submit-handler добавляется в Phase 11/12/14.

---

## 2026-05-24 — Bugfix: Admin reset password

**Сделано:**

- Обнаружен и исправлен баг: `AdminResetPasswordForm` вызывала игровой эндпоинт
  `POST /api/auth/reset-password`, который ищет email в таблице `User` (игроки).
  При совпадении email администратора и игрока — сбрасывался пароль игрока.
- Создан отдельный эндпоинт `POST /api/admin/auth/reset-password` — ищет исключительно
  в таблице `AdminUser`. При несуществующем email возвращает явную ошибку `ADMIN_NOT_FOUND`
  (без enumeration-защиты, как у игрового эндпоинта).
- `update` пароля и `AdminAuditLog.create` обёрнуты в `$transaction` — атомарность гарантирована.
- В `lib/resend.ts` добавлена функция `sendAdminPasswordResetEmail` с отдельной темой письма.
- `AdminResetPasswordForm` переключена на новый эндпоинт, добавлена обработка `ADMIN_NOT_FOUND`
  с сообщением `'Администратор с таким email не найден'`.
- Исправлено success-сообщение формы: `'Пароль отправлен на указанный Email'`.
- Игровой `POST /api/auth/reset-password` не затронут.

**Изменённые файлы:**

- `app/api/admin/auth/reset-password/route.ts` — создан
- `lib/resend.ts` — добавлена `sendAdminPasswordResetEmail`
- `components/auth/AdminResetPasswordForm.tsx` — новый URL, обработка `ADMIN_NOT_FOUND`, новый success-текст

**Проблемы / Заметки:**

- N/A

---

## 2026-05-23 — Session 8

**Сделано:**

- Реализован **Phase 1, Task 6: Rate limiting**.
- Создан `lib/rateLimit.ts` — in-memory rate limiter: `Map<string, { count: number; resetAt: number }>` как хранилище, экспортируемая функция `checkRateLimit(key, max, windowMs): boolean` (возвращает `true` если OK, `false` если лимит исчерпан), `setInterval` для автоочистки устаревших buckets каждые 5 минут (`CLEANUP_INTERVAL_MS = 5 * 60 * 1000`).
- Обновлён `app/api/auth/register/route.ts` — добавлен `checkRateLimit(ip, 5, 10 * 60 * 1000)` до бизнес-логики (до `request.json()`). IP извлекается из заголовков `x-forwarded-for` → `x-real-ip` → `'unknown'`. При превышении — `429 { success: false, error: 'RATE_LIMIT_EXCEEDED' }`.
- Обновлён `app/api/auth/reset-password/route.ts` — добавлен `checkRateLimit(\`${ip}:${data.email}\`, 3, 10 _ 60 _ 1000)`после парсинга Zod-схемы (email нужен для составного ключа). При превышении —`429 { success: false, error: 'RATE_LIMIT_EXCEEDED' }`.
- `npm run type-check` и `npm run lint` — без ошибок.

**Следующее:**

- Phase 1 завершена. Следующая задача по роадмапу.

**Проблемы / Заметки:**

- `signIn` (`/api/auth/callback/credentials`) не лимитируется через код — rate limit на этот эндпоинт реализован через Nginx в Phase 0.5, дублировать не нужно.

---

## 2026-05-23 — Session 7

**Сделано:**

- Реализован **Phase 1, Task 5: Admin login + seed**.
- Создан `components/auth/AdminLoginForm.tsx` — Client Component: react-hook-form + zodResolver (`loginFormSchema`), `signIn('admin', { redirect: false })`, toggle видимости пароля (SVG eye/eye-off, `aria-pressed`), обработка ошибок (`CredentialsSignin` → «Неверный email или пароль»), ссылка «Забыли пароль?» → `/admin-reset-password`. Использует светлую admin-тему (белая карточка 730px, контент-колонка 330px).
- Создан `prisma/seed.ts` — идемпотентный сидер: `seedAdminUser()` (проверяет `adminUser.count() > 0` перед созданием, ENV `ADMIN_INITIAL_EMAIL`/`ADMIN_INITIAL_PASSWORD`) + `seedAppSettings()` (проверяет `appSettings.count() > 0`, дефолты: `defaultMarketingConsent: false`, `supportEmail: 'support@example.com'`, `privacyPolicyUrl: 'https://example.com/privacy'`).
- Создан `app/(auth-admin)/admin-login/page.tsx` — рендерит `<AdminLoginForm />`.
- Создан `components/auth/AdminResetPasswordForm.tsx` — admin-стилизованная форма сброса пароля: заголовок «Забыли пароль?», подзаголовок «Отправим его на почту», поле email с валидацией (`resetSchema`), кнопка «Сбросить пароль», ссылка «Назад» → `/admin-login`. Использует тот же API-эндпоинт `POST /api/auth/reset-password`.
- Создан `app/(auth-admin)/admin-reset-password/page.tsx` — рендерит `<AdminResetPasswordForm />`.
- `npm run type-check` — без ошибок.

**Изменения в layout (вне scope таска, архитектурное решение):**

- Создан `app/(auth-admin)/layout.tsx` — отдельный layout для admin auth-страниц: фоновое изображение `public/assets/img/admin/auth-layout-bg.jpg` (`bg-cover`), лого `public/assets/img/admin/logo-admin-login.png` (520×74px, absolute-позиционирование `top-[114px]`), форма центрируется через `flex items-center justify-center`.
- `app/(auth)/layout.tsx` — восстановлен оригинальный player layout (фоновое изображение `auth-bg.png`). До этого был случайно перезаписан admin-стилем в ходе итераций.
- `app/(auth)/admin-login/` — удалён (страница перенесена в `(auth-admin)` группу). URL `/admin-login` не изменился — route groups не влияют на URL.
- Добавлены admin-токены в `tailwind.config.ts`: `admin.accent`, `admin.accent-hover`, `admin.accent-muted`, `admin.card-bg`, `admin.card-border`, `admin.input-bg`, `admin.input-text`, `admin.label`, `admin.placeholder`; тень `shadow-admin-card`.
- Добавлено в `globals.css`: `.admin-input:-webkit-autofill` — переопределяет глобальный webkit-autofill (тёмный фон игры) для светлых инпутов admin-форм.

**Следующее:**

- Phase 1, Task 6: Rate limiting на публичных эндпоинтах.

**Проблемы / Заметки:**

- `{...register('email')}` был случайно потерян на email-инпуте AdminLoginForm в ходе рефакторинга — форма отправляла пустую строку, Zod падал с «Введите корректный email». Исправлено.
- webkit-autofill глобальное правило в `globals.css` применяет тёмный фон `#0D1117` ко всем инпутам — перекрывало светлые admin-инпуты. Решение: класс `.admin-input` с переопределяющим autofill-стилем.

---

## 2026-05-23 — Session 6

**Сделано:**

- Реализован **Phase 1, Task 4: Восстановление пароля (API + UI)**.
- Добавлены `resetSchema` + тип `ResetInput` в `lib/validations/auth.ts` — схема для одного поля `email` (toLowerCase + trim).
- Создан `app/api/auth/reset-password/route.ts` — `POST`: валидация через Zod → поиск пользователя → если не найден или заблокирован — немедленный `{ success: true }` (защита от enumeration attack) → генерация нового пароля (`generatePassword(12)`) → `hashPassword` → `prisma.user.update` → `sendPasswordResetEmail` в try/catch (ошибка письма не прерывает ответ). Всегда возвращает `{ success: true }` при прохождении валидации.
- Создан `components/auth/ResetPasswordForm.tsx` — Client Component: react-hook-form + zodResolver, одно поле email, loading state (`isSubmitting` → «ОТПРАВКА…»), server error state с `role="alert"`, success-экран с текстом «Если такой email зарегистрирован, на него отправлено письмо с новым паролем» + кнопка «ВЕРНУТЬСЯ К ЛОГИНУ» → `/login`. Ссылка «Вернуться к логину» присутствует и в форме, и в success-состоянии.
- Обновлена `app/(auth)/reset-password/page.tsx` — убрана заглушка, рендерит `<ResetPasswordForm />`.
- `npm run type-check` — без ошибок.

**Следующее:**

- Phase 1, Task 5: Сид первого администратора.

**Проблемы / Заметки:**

- При DB-сбое Prisma-запросы не обёрнуты в try/catch — в крайнем случае вернётся 500, но это не штатный сценарий. Клиент корректно обработает ошибку через catch блок формы.

---

## 2026-05-23 — Session 5

**Сделано:**

- Реализован **Phase 1, Task 3: Логин + Логаут (UI)**.
- Создан `components/auth/LoginForm.tsx` — Client Component: react-hook-form + zodResolver (`loginFormSchema`), `signIn('player', { redirect: false })`, обработка ошибок (`CredentialsSignin` → «Неверный email или пароль», прочие → «Произошла ошибка»), кнопка disabled + текст «ВХОД…» в состоянии submit, ссылки на `/register` и `/reset-password`.
- Создан `components/auth/LogoutButton.tsx` — Client Component: `signOut({ callbackUrl: '/login' })`, нигде не размещён (Phase 2).
- Обновлена `app/(auth)/login/page.tsx` — Server Component, рендерит `<LoginForm />` (было — заглушка).
- Добавлена `loginFormSchema` + тип `LoginFormInput` в `lib/validations/auth.ts`.
- Ширина базового класса `.auth-card` изменена с `760px` на `840px` в `globals.css` — применяется ко всем auth-формам (логин, регистрация).
- Добавлен toggle видимости пароля в `components/ui/Input.tsx` (prop `showPasswordToggle`): SVG-иконки eye/eye-off, `aria-label`, `aria-pressed`, отдельный padding `pr-10` при toggle.
- Исправлена обработка ошибок блокировки: Auth.js v5 beta.31 не передаёт `code` из `CredentialsSignin`-подклассов клиенту — реализован pre-check подход.
- Создан `app/api/auth/check-block/route.ts` — `POST`: принимает email, возвращает `{ status: 'ok' | 'USER_BLOCKED' | 'KEY_BLOCKED' }`. При не найденном пользователе возвращает `ok` (не раскрывает существование email).
- Добавлены `checkBlockSchema` + `CheckBlockInput` в `lib/validations/auth.ts`.
- `LoginForm` обновлён: перед `signIn` делает pre-check; при `USER_BLOCKED` / `KEY_BLOCKED` показывает конкретное сообщение с `supportEmail` (загружается из `/api/settings/registration-defaults`), не вызывая `signIn` вообще.
- `npm run type-check` — без ошибок.

**Следующее:**

- Phase 1, Task 4: Восстановление пароля (`ResetPasswordForm.tsx`, `POST /api/auth/reset-password`).

**Проблемы / Заметки:**

- Auth.js v5 beta.31: `CredentialsSignin` subclass `code` не передаётся клиенту — клиент всегда получает `'CredentialsSignin'`. Обход — pre-check эндпоинт до `signIn`.
- Auth.js v5 beta.31: `result.error` при `CallbackRouteError` содержит полную строку с URL (`'CallbackRouteError: Read more at...'`), а не просто `'CallbackRouteError'` — точное сравнение ломается.

---

## 2026-05-23 — Session 4

**Сделано:**

- Реализован **Phase 1, Task 2: Регистрация (API + UI)**.
- Создан `lib/validations/auth.ts` — `registerSchema` (Zod): поля `name` (regex + min 3), `email` (toLowerCase + trim), `accessKey` (min 1 + trim), `consentPolicy` (literal true), `consentMarketing` (boolean). Отдельная `registerFormSchema` для клиентской формы с superRefine для проверки чекбокса.
- Создан `lib/resend.ts` — Resend client singleton + `sendPasswordEmail()` + `sendPasswordResetEmail()`. Обе env-переменные (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) проверяются при первом вызове.
- Создан `app/api/auth/register/route.ts` — `POST`: валидация через Zod → проверка ключа → проверка уникальности email → генерация пароля → `$transaction` (User + GameProgress + ChatState + `updateMany` с guard от race condition) → Resend вне транзакции. При падении Resend регистрация не откатывается, возвращается `{ success: true, emailSent: false }`.
- Создан `app/api/settings/registration-defaults/route.ts` — публичный `GET`: возвращает `{ defaultMarketingConsent, supportEmail, privacyPolicyUrl }` из `AppSettings`; при отсутствии записи — фолбэк-дефолты.
- Создан `components/auth/RegisterForm.tsx` — Client Component: react-hook-form + zodResolver, загрузка дефолтов при mount, поля `name`/`email`/`accessKey` через `Input`-компонент (aria-accessible), чекбоксы `consentPolicy` (обязательный, со ссылкой) и `consentMarketing` (необязательный). Тексты ошибок `INVALID_KEY`/`KEY_BLOCKED` подставляют `supportEmail`. Success-экран с редиректом на `/login` через 10 сек.
- Создана `app/(auth)/register/page.tsx` — Server Component, рендерит `<RegisterForm />`.
- Установлены пакеты: `resend`, `react-hook-form`, `@hookform/resolvers`.

**Следующее:**

- Phase 1, Task 3: Логин игрока (форма + Auth.js credentials).

**Проблемы / Заметки:**

- Время редиректа на success-экране изменено с 5 до 10 секунд по решению продукта.

---

## 2026-05-22 — Session 3

**Сделано:**

- Реализован **Phase 1, Task 1: Инфраструктура Auth.js v5 + базовые UI-компоненты**.
- Установлен пакет `next-auth@beta` (v5.0.0-beta.31).
- Создан `lib/auth.ts` — Auth.js v5 конфиг с двумя изолированными credentials-провайдерами (`player` и `admin`), JWT-стратегия 24 ч, callbacks `jwt`/`session` с записью `user.id` и `user.type`.
- Создан `app/api/auth/[...nextauth]/route.ts` — экспорт `GET`/`POST` handlers.
- Создан `types/next-auth.d.ts` — расширение `Session.user` полями `id: string` и `type: 'PLAYER' | 'ADMIN'`; аугментация `JWT` в `@auth/core/jwt` и `next-auth/jwt`.
- Создан `lib/password.ts` — `generatePassword(length)`, `hashPassword(plain)`, `comparePassword(plain, hash)` (bcrypt rounds=10, `crypto.randomInt` для генерации).
- Обновлён `proxy.ts` — реальная защита роутов через `auth((req) => ...)`, проверка `session.user.type` для `/dashboard` (PLAYER only) и `/admin/*` (ADMIN only).
- Создан `components/ui/Button.tsx` — варианты `primary` / `secondary` / `ghost`, состояния `loading` (спиннер + `disabled`) и `disabled`, `aria-busy`, типизированные props через интерфейс.
- Создан `components/ui/Input.tsx` — label, placeholder, error state по токенам из `tailwind.config.ts` (`border-border-error`, `shadow-game-error`, `text-semantic-error`), автогенерация `id` через `useId`, `aria-invalid`/`aria-describedby`.
- Исправлена конфигурация ESLint: `next lint` удалён из Next.js 16, переписан `eslint.config.mjs` под flat config с `eslint-config-next`, скрипт `lint` обновлён на `eslint .`.

**Следующее:**

- Phase 1, Task 2: Регистрация (API + UI) — `POST /api/auth/register`, `lib/resend.ts`, `RegisterForm.tsx`.

**Проблемы / Заметки:**

- `next lint` удалён из Next.js 16 — заменён на прямой вызов `eslint .`.
- Для корректной типизации JWT в Auth.js v5 потребовалась аугментация `@auth/core/jwt` дополнительно к `next-auth/jwt`.

---

## 2026-05-20 — Session 2

**Сделано:**

- Реализован Task 2: `proxy.ts + базовый layout + health-check`.
- Создан `proxy.ts` для упрощенной защиты роутов (редиректы `/dashboard/*` на `/login`, `/admin/*` на `/admin-login`).
- Создан `app/globals.css` с Tailwind directives и базовыми стилями для тёмной темы.
- Обновлен `app/layout.tsx` для использования `next/font` (Inter) и подключения `globals.css`.
- Обновлен `app/page.tsx` для редиректа на `/login`.
- Созданы страницы-заглушки для всех route groups: `(auth)`, `(game)`, `(admin)`.
- Реализован `app/api/health/route.ts` с проверкой подключения к БД через Prisma.$queryRaw.
- Обновлена конфигурация ESLint до `eslint.config.mjs` для совместимости с ESLint 9.
- Проведены все автоматические и ручные проверки DoD для Task 2. Все пункты, поддающиеся автоматической проверке, выполнены. Ручные проверки подтверждены пользователем.

**Следующее:**

- Следующая фаза разработки согласно `.docs/phases/_status.md`.

**Проблемы / Заметки:**

- Необходимость обновления конфигурации ESLint для новой версии.

---

## 2026-05-19 — Session 1

**Сделано:**

- Инициализирован проект Next.js 16 с TypeScript strict.
- Создана полная схема Prisma (18 моделей + 5 enum'ов) из `database.md`.
- Настроено подключение к PostgreSQL и создан singleton Prisma Client.
- `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `.env.example`, `.gitignore` настроены согласно требованиям.
- Проведены ручные проверки: `npm install`, `npx prisma migrate dev --name init`, `npx prisma generate`, `npx prisma studio`, `npm run type-check`, `npm run build`, `npm run lint` — все выполнены без ошибок.

**Следующее:**

- N/A

**Проблемы / Заметки:**

- N/A
