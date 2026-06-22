# TASK-1.md — Каркас тура: типы + шаги + UI-компоненты

**Фаза:** 18 — Онбординг  
**Таск:** 2 из 3 (часть 1/2)  
**Статус:** 🔄 В работе

---

## Цель

Создать фундамент overlay-движка тура: типы, дескрипторы 22 шагов и три изолированных UI-компонента (контроллер, тултип, spotlight). После завершения этой части компоненты существуют и работают автономно — без подключения к `DashboardClient`.

---

## Scope

- `types/onboarding.ts` — все TS-типы для тура
- `constants/onboardingSteps.ts` — 22 дескриптора шагов + реестр `ONBOARDING_TARGETS`
- `components/game/onboarding/OnboardingController.tsx` — машина шагов
- `components/game/onboarding/OnboardingTooltip.tsx` — карточка-тултип
- `components/game/onboarding/OnboardingSpotlight.tsx` — затемнение + spotlight

---

## Файлы для создания

| # | Файл | Тип | Назначение |
|---|------|-----|-----------|
| 1 | `types/onboarding.ts` | TS-типы | `OnboardingScene` (union: `base` / `crack-launch` / `crack-game` / `crack-done` / `decipher-launch` / `decipher-game` / `decipher-done` / `rdp-launch` / `rdp-game` / `chat-final`); `OnboardingStep` (дескриптор: `id`, `scene`, `target?`, `text`, `placement`, `blurBackground?`, `demoPayload?`); типы демо-состояний панелей |
| 2 | `constants/onboardingSteps.ts` | const | Массив 22 дескрипторов шагов + объект `ONBOARDING_TARGETS` (все `data-onboarding-id` в одном месте). Тексты-заглушки из референсов. Для шагов мини-игр (4–10, 12–16, 18–20) `demoPayload` — минимальные/пустые (наполняются в Таске 3) |
| 3 | `components/game/onboarding/OnboardingController.tsx` | Client | Машина текущего шага; принимает `onSceneChange(scene)` и `onComplete` колбэки; на шаге 22 → `POST /api/onboarding/complete` → вызывает `onComplete` |
| 4 | `components/game/onboarding/OnboardingTooltip.tsx` | Client | Карточка-тултип: текст, индикатор прогресса, кнопки «Назад / Далее / Завершить инструктаж», позиционирование относительно target-элемента |
| 5 | `components/game/onboarding/OnboardingSpotlight.tsx` | Client | Затемнение фона + «окно» подсветки целевого элемента через `getBoundingClientRect`, пересчёт на `resize`/`scroll`. Режим без target (центр) и `blurBackground` для шага 1 |

**Файлы НЕ изменяются** — `DashboardClient`, `MissionCard`, игровые панели остаются нетронутыми. Это часть TASK-2.

---

## Детали реализации

### `types/onboarding.ts`

```ts
export type OnboardingScene =
  | 'base'
  | 'crack-launch'
  | 'crack-game'
  | 'crack-done'
  | 'decipher-launch'
  | 'decipher-game'
  | 'decipher-done'
  | 'rdp-launch'
  | 'rdp-game'
  | 'chat-final';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface OnboardingStep {
  id: number;
  scene: OnboardingScene;
  target?: string;         // значение data-onboarding-id целевого элемента
  text: string;
  placement: TooltipPlacement;
  blurBackground?: boolean;
  demoPayload?: DemoPayload;
}

// Демо-состояния передаются в панели через DashboardClient (TASK-2)
export interface DemoPayload {
  crackDemo?: CrackDemoState;
  decipherDemo?: DecipherDemoState;
  rdpDemo?: RdpDemoState;
}

export interface CrackDemoState {
  slotKey: string;
  // поля наполняются в Таске 3
}

export interface DecipherDemoState {
  slotKey: string;
}

export interface RdpDemoState {
  connectResult: 'pending' | 'success';
}
```

### `constants/onboardingSteps.ts`

- Экспортирует `ONBOARDING_STEPS: OnboardingStep[]` — 22 элемента
- Экспортирует `ONBOARDING_TARGETS` — объект вида `{ STATUS_BAR: 'status-bar', MISSION_TILES: 'mission-tiles', ... }` с перечислением всех `data-onboarding-id`
- Шаги 4–10, 12–16, 18–20: `demoPayload` минимальные/пустые — заглушки для Таска 3

### `OnboardingController.tsx`

```ts
interface OnboardingControllerProps {
  onSceneChange: (scene: OnboardingScene) => void;
  onComplete: () => void;
}
```

- Держит `currentStep: number` в `useState`
- На каждом шаге берёт `ONBOARDING_STEPS[currentStep]`, вызывает `onSceneChange(step.scene)`
- `handleNext`: если шаг 22 (последний) → `POST /api/onboarding/complete` → `onComplete()`; иначе `currentStep + 1`
- `handleBack`: `currentStep - 1`
- Рендерит `<OnboardingSpotlight>` и `<OnboardingTooltip>` с нужными пропами
- Перехватывает `keydown Escape` — `preventDefault`, не закрывает тур

### `OnboardingTooltip.tsx`

```ts
interface OnboardingTooltipProps {
  step: OnboardingStep;
  currentIndex: number;   // 0-based
  total: number;
  onNext: () => void;
  onBack: () => void;
  targetRect: DOMRect | null;
}
```

- Позиционируется через `position: fixed`, координаты рассчитываются из `targetRect` + `placement`
- Без `targetRect` — центрируется по viewport
- Индикатор прогресса: «Шаг N из 22»
- Кнопки: «Назад» (скрыта на шаге 1), «Далее» / «Завершить инструктаж» (на последнем шаге)

### `OnboardingSpotlight.tsx`

```ts
interface OnboardingSpotlightProps {
  targetId?: string;      // data-onboarding-id
  blurBackground?: boolean;
  onClick?: () => void;   // клик по фону — нет действия (блокируется)
}
```

- Нет `targetId` → тёмный оверлей по всему экрану без «окна»
- Есть `targetId` → `document.querySelector('[data-onboarding-id="..."]')`, `getBoundingClientRect`, рисует «окно» через SVG-маску или clip-path
- `blurBackground` → `backdrop-filter: blur(...)` на оверлее
- `useEffect` с `resize` и `scroll` — пересчёт координат
- Клик по оверлею → `stopPropagation`, ничего не делает (тур не закрывается)

---

## Карта шагов (для заполнения дескрипторов)

| Шаг | Сцена | target | placement |
|-----|-------|--------|-----------|
| 1 | `base` | — | `center` |
| 2 | `base` | — | `center` |
| 3 | `base` | `mission-tiles` | `bottom` |
| 4 | `crack-launch` | `crack-mission-card` | `right` |
| 5–10 | `crack-game` / `crack-done` | внутри панели | — |
| 11 | `base` | `mission-tiles` | `bottom` |
| 12–16 | `decipher-*` | внутри панели | — |
| 17 | `base` | `mission-tiles` | `bottom` |
| 18–20 | `rdp-*` | внутри панели | — |
| 21 | `base` | `hints-button` | `bottom` |
| 22 | `chat-final` | `chat-detective` | `top` |

Шаги 4–10, 12–16, 18–20 наполняются текстами из референсов `on_step-N.jpg`, финальный контент — в Таске 3.

---

## Референсы

| Файл | Зачем |
|------|-------|
| `.docs/ref/on_step-1.jpg … on_step-22.jpg` | Дизайн тултипа, spotlight, тексты шагов |
| `.docs/phases/phase-18.md` | Карта 22 шагов, DoD |

---

## Definition of Done (TASK-1)

- [ ] `types/onboarding.ts` — все типы, нет `any`, экспортируются корректно
- [ ] `constants/onboardingSteps.ts` — 22 шага в массиве, `ONBOARDING_TARGETS` содержит все нужные ключи
- [ ] `OnboardingController` компилируется; `onSceneChange` и `onComplete` вызываются в нужные моменты; Esc заблокирован
- [ ] `OnboardingTooltip` — кнопки «Назад / Далее / Завершить инструктаж» работают; прогресс отображается корректно; позиционируется от `targetRect`
- [ ] `OnboardingSpotlight` — spotlight-окно отрисовывается на элементе; пересчёт при `resize`; клик по оверлею не закрывает тур
- [ ] `npm run type-check` проходит без ошибок
- [ ] `npm run lint` проходит без ошибок
- [ ] Нет `any` типов
- [ ] Проверить пункты из `.docs/dod-global.md`
