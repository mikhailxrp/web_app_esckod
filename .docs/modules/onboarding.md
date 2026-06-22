# Модуль: Онбординг

## Обзор

При первом входе игрок проходит 22-шаговый интерактивный инструктаж:  
приветствие → демонстрация трёх мини-игр (Взломщик, Дешифратор, Удалённый доступ) в demo-режиме → подсказки по интерфейсу.

**Первое сообщение в чате Детектива приходит только по завершении инструктажа.**  
Повторный вход (если `onboardingDone === true`) — инструктаж не показывается.

---

## Логика показа

1. `app/(game)/dashboard/page.tsx` считывает `user.onboardingDone` из БД и передаёт в `DashboardClient` пропом.
2. `DashboardClient` рендерит `<OnboardingController>` **только при `!onboardingDone`**.
3. При завершении (шаг 22, «Завершить инструктаж») `OnboardingController` вызывает `POST /api/onboarding/complete`, затем — колбэк `onComplete` в `DashboardClient`.
4. `onComplete` вызывает `chatStore.refresh()`, чтобы первая реплика Детектива пришла без перезагрузки страницы.
5. При перезапуске игры `onboardingDone` **не сбрасывается** (учитывается в Phase 19).

---

## Архитектура — кастомный overlay на Tailwind

Инструктаж реализован без `react-joyride`. Причина: `react-joyride@2.x` несовместим с React 19 / Next 16 и не поддерживает управление внутренним состоянием модальных панелей миссий.

### Компоненты

| Компонент | Файл | Описание |
|---|---|---|
| `OnboardingController` | `components/game/onboarding/OnboardingController.tsx` | Машина текущего шага; управляет сценой; вызывает `/complete` на финале |
| `OnboardingTooltip` | `components/game/onboarding/OnboardingTooltip.tsx` | Тултип: текст, прогресс-полоса, кнопки «Назад / Далее / Завершить инструктаж» |
| `OnboardingSpotlight` | `components/game/onboarding/OnboardingSpotlight.tsx` | Затемнение через `clip-path` с «окном» подсветки целевого элемента |

### Типы

Файл `types/onboarding.ts`:

```ts
type OnboardingScene =
  | 'base' | 'crack-launch' | 'crack-game' | 'crack-done'
  | 'decipher-launch' | 'decipher-game' | 'decipher-done'
  | 'rdp-launch' | 'rdp-game' | 'chat-final';

interface OnboardingStep {
  id: number;
  scene: OnboardingScene;
  target?: string;          // data-onboarding-id целевого элемента
  text: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  blurBackground?: boolean;
  demoPayload?: DemoPayload;
}
```

---

## Реестр целевых элементов (ONBOARDING_TARGETS)

Все `data-onboarding-id` сосредоточены в `constants/onboardingSteps.ts`:

```ts
export const ONBOARDING_TARGETS = {
  STATUS_BAR:              'status-bar',
  MISSION_TILES:           'mission-tiles',
  CRACK_MISSION_CARD:      'crack-mission-card',
  DECIPHER_MISSION_CARD:   'decipher-mission-card',
  RDP_MISSION_CARD:        'rdp-mission-card',
  CHAT_DETECTIVE:          'chat-detective',
  OPERATION_HISTORY:       'operation-history',
  HINTS_BUTTON:            'hints-button',
  CRACK_FORM:              'crack-form',
  CRACK_WORDLE_BOARD:      'crack-wordle-board',
  CRACK_RESULT:            'crack-result',
  DECIPHER_FORM:           'decipher-form',
  DECIPHER_TABLE:          'decipher-table',
  DECIPHER_RESULT:         'decipher-result',
  RDP_FORM:                'rdp-form',
  RDP_PUZZLE:              'rdp-puzzle',
  RDP_INSTRUCTION_BUTTON:  'rdp-instruction-button',
} as const;
```

Атрибуты навешаны в:
- `DashboardClient.tsx` — `status-bar`, `mission-tiles`, `chat-detective`, `operation-history`, `hints-button`
- `MissionCard.tsx` — `crack-mission-card`, `decipher-mission-card`, `rdp-mission-card` (через `data-onboarding-id` на `article`)
- `CrackGamePanel.tsx`, `DecipherGamePanel.tsx`, `RdpGamePanel.tsx` — игровые цели (добавляются в Таске 3)

---

## Интеграция в DashboardClient

```ts
// Стейт сцены и текущего шага
const [demoScene, setDemoScene] = useState<OnboardingScene | null>(null);
const [currentStepId, setCurrentStepId] = useState<number>(1);
const [onboardingActive, setOnboardingActive] = useState(!onboardingDone);

// Payload текущего шага — достаём из реестра по ID
const currentStepPayload = ONBOARDING_STEPS.find(
  (s) => s.id === currentStepId,
)?.demoPayload;

// Рендер тура
{onboardingActive && (
  <OnboardingController
    playerLogin={playerLogin}
    onSceneChange={setDemoScene}
    onStepChange={setCurrentStepId}   // per-step demo-состояние
    onComplete={handleOnboardingComplete}
  />
)}

// Показываем demo-панель когда сцена активна (не 'base' и не 'chat-final')
const showDemoPanel =
  onboardingActive &&
  demoScene !== null &&
  demoScene !== 'base' &&
  demoScene !== 'chat-final';
```

Когда `showDemoPanel === true`, секция миссий показывает соответствующую demo-панель вместо боевых панелей. `currentStepPayload` передаётся в панель как `demoState` — панель рендерит строго скриптовое состояние этого шага:

| `demoScene` | Что рендерится |
|---|---|
| `'crack-launch'` / `'crack-game'` / `'crack-done'` | `<CrackGamePanel demo demoState={currentStepPayload?.crackDemo} onClose={() => {}} />` |
| `'decipher-launch'` / `'decipher-game'` / `'decipher-done'` | `<DecipherGamePanel demo demoState={currentStepPayload?.decipherDemo} onClose={() => {}} />` |
| `'rdp-launch'` / `'rdp-game'` | `<RdpGamePanel connectResult={DEMO_RDP_CONNECT_RESULT} demo demoState={currentStepPayload?.rdpDemo} onClose={() => {}} />` |
| `'base'` / `null` / `'chat-final'` | Обычный dashboard |

Шаг 10: `currentStepPayload?.demoLogEntries` передаётся в `<OperationHistory demoEntries={...} />` — показывает бутафорские записи, не дёргая API.

---

## Паттерн demo-пропа в игровых панелях

Все три игровые панели (`CrackGamePanel`, `DecipherGamePanel`, `RdpGamePanel`) получили:

```ts
interface XxxGamePanelProps {
  // ...существующие пропы
  demo?: boolean;
  demoState?: XxxDemoState;
}
```

При `demo === true`:
- `useEffect` с `loadState()` пропускается (`if (demo) return`)
- `view` / `stage` остаётся в `{ phase: 'loading' }` — панель показывает заглушку
- Реальные API (`/api/missions/*`, `/api/logs/*`, `/api/progress/*`) **не вызываются**
- Второй `useEffect` подхватывает `demoState` и инициализирует скриптовое состояние

`MissionCard` при `demo === true`:
- Кнопка «Открыть» вызывает `onDemoStart?.()` вместо открытия модала
- Форма запуска (`/api/missions/*/launch`) не вызывается

---

## Типы demo-состояний (types/onboarding.ts)

```ts
// Фазы demo-панели взломщика
type CrackDemoPhase = 'launch' | 'playing' | 'completed';

interface CrackDemoAttempt {
  word: string;
  positions: LetterStatus[];
}

interface CrackDemoState {
  slotKey: string;
  phase: CrackDemoPhase;
  attempts?: CrackDemoAttempt[];
  wordleSpotlight?: 'word-list' | 'attempt-panel';
  inputWord?: string;           // значение поля «Ключ» (шаг 8)
  resultPassword?: string;      // пароль на экране «Доступ предоставлен»
  targetUrl?: string;
  targetEmail?: string;
  passwordCopied?: boolean;     // показать «скопировано» (шаг 10)
}

// Фазы demo-панели дешифратора
type DecipherDemoPhase = 'launch' | 'playing' | 'completed';

interface DecipherDemoState {
  slotKey: string;
  phase?: DecipherDemoPhase;
  encryptedWord?: string;       // шифр (шаги 13–15)
  cipherKey?: string;
  folderName?: string;
  playfairTable?: string[][];   // если не указана — вычисляется из cipherKey
  inputWord?: string;           // значение поля «Расшифрованное слово»
  folderPath?: string;          // путь к папке (шаг 16)
  folderPassword?: string;      // пароль папки (шаг 16)
  passwordCopied?: boolean;
}

// Фазы demo-панели RDP
type RdpDemoPhase = 'launch' | 'puzzle';

interface RdpDemoState {
  phase?: RdpDemoPhase;
  puzzleField?: PuzzleField;    // если не указано — берётся DEMO_RDP_PUZZLE_FIELD
}

// Бутафорская запись «Истории действий» (шаг 10)
interface OnboardingDemoLogEntry {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'INFO';
  message: string;
  createdAt: string;
}

// Контейнер payload одного шага
interface DemoPayload {
  crackDemo?: CrackDemoState;
  decipherDemo?: DecipherDemoState;
  rdpDemo?: RdpDemoState;
  demoLogEntries?: OnboardingDemoLogEntry[];
}
```

### Механизм per-step payload

1. `OnboardingController` принимает `onStepChange?: (stepId: number) => void` и вызывает его при каждой смене шага.
2. `DashboardClient` хранит `currentStepId` в стейте и обновляет его через `onStepChange`.
3. `currentStepPayload = ONBOARDING_STEPS.find(s => s.id === currentStepId)?.demoPayload` — достаём payload текущего шага из реестра.
4. `currentStepPayload` передаётся в активную demo-панель как `demoState`.
5. Внутри панели второй `useEffect([demo, demoState])` перерисовывает `view` / `stage` при каждой смене шага — без обращений к API.

Это позволяет одной сцене (например, `crack-game`) показывать разные состояния доски на шагах 5, 6, 7, 8 без перемонтирования компонента.

---

## Карта 22 шагов

| Шаг | Сцена | Подсветка | Таск |
|-----|-------|-----------|------|
| 1 | `base` (blur) | — | 2 |
| 2 | `base` | — | 2 |
| 3 | `base` | `mission-tiles` | 2 |
| 4 | `crack-launch` | `crack-mission-card` | 3 |
| 5 | `crack-game` | `crack-wordle-board` | 3 |
| 6 | `crack-game` | `crack-wordle-board` | 3 |
| 7 | `crack-game` | `crack-wordle-board` | 3 |
| 8 | `crack-game` | `crack-wordle-board` | 3 |
| 9 | `crack-done` | `crack-result` | 3 |
| 10 | `crack-done` | `operation-history` | 3 |
| 11 | `base` | `mission-tiles` | 2 |
| 12 | `decipher-launch` | `decipher-mission-card` | 3 |
| 13 | `decipher-game` | `decipher-table` | 3 |
| 14 | `decipher-game` | `decipher-table` | 3 |
| 15 | `decipher-game` | `decipher-table` | 3 |
| 16 | `decipher-done` | `decipher-result` | 3 |
| 17 | `base` | `mission-tiles` | 2 |
| 18 | `rdp-launch` | `rdp-mission-card` | 3 |
| 19 | `rdp-game` | `rdp-puzzle` | 3 |
| 20 | `rdp-game` | `rdp-instruction-button` | 3 |
| 21 | `base` | `hints-button` | 2 |
| 22 | `chat-final` | `chat-detective` | 2 |

---

## API: POST /api/onboarding/complete

Файл: `app/api/onboarding/complete/route.ts`

- Auth: Player only (401 для не-PLAYER)
- Идемпотентен: если `onboardingDone === true` → `{ success: true, alreadyCompleted: true }` без записей
- Иначе — транзакция: `user.update({ onboardingDone: true })` + `operationLog` шаблон `onboarding_completed`
- Body пустой, Zod не нужен

---

## Серверная защита чата Детектива

В `lib/chat/state.ts` → `resolveChatSlot('DETECTIVE')`:
- Если `user.onboardingDone === false` → возвращает `{ currentMessage: null, isVisible: true }` без вызова `ensureChatStarted`
- Гейт только для `DETECTIVE` (Марина и остальные не блокируются)

После `POST /api/onboarding/complete` → `chatStore.refresh()` → `resolveChatSlot` уже видит `onboardingDone === true` → `ensureChatStarted` вызывается → первая реплика Детектива приходит без перезагрузки.

---

## Поведение при Esc и клике по фону

`OnboardingController` блокирует `keydown` с `key === 'Escape'` через `e.preventDefault() + e.stopPropagation()` на `window` (capture-фаза).

`OnboardingSpotlight` перехватывает клики по оверлею через `e.stopPropagation()` — тур не закрывается по клику вне тултипа.

---

## Позиционирование spotlight

`OnboardingSpotlight` использует `getBoundingClientRect()` + CSS `clip-path: polygon(...)` для создания «вырезанного окна» в тёмном оверлее. Пересчёт — при `resize` и `scroll` через `requestAnimationFrame`. `OnboardingController` дополнительно пересчитывает `targetRect` с задержкой 80ms при смене шага (чтобы DOM успел перерисоваться при смене сцены).
