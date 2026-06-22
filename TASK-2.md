# TASK-2.md — Интеграция тура: DashboardClient + демо-панели

**Фаза:** 18 — Онбординг  
**Таск:** 2 из 3 (часть 2/2)  
**Статус:** ⏳ После TASK-1

---

## Цель

Подключить готовые компоненты тура (из TASK-1) к `DashboardClient` и трём игровым панелям. Добавить `data-onboarding-id` на целевые элементы. Реализовать `demo`-режим в панелях (короткое замыкание `fetch`). Переписать `onboarding.md`. После завершения шаги **1, 2, 3, 11, 17, 21, 22** проходятся целиком в браузере.

**Предусловие:** TASK-1 завершён и прошёл DoD.

---

## Scope

- Интеграция `OnboardingController` в `DashboardClient` с управлением `demoScene`
- `data-onboarding-id` на все целевые элементы dashboard
- Проп `demo?` в `MissionCard` + трёх игровых панелях
- Перезапись `.docs/modules/onboarding.md`

---

## Файлы для изменения

| # | Файл | Тип | Изменение |
|---|------|-----|-----------|
| 6 | `components/game/DashboardClient.tsx` | Client | Условный рендер `<OnboardingController>` при `!onboardingDone`; состояние `demoScene` под управлением контроллера → рендер нужной демо-панели; `data-onboarding-id` на `status-bar`, `mission-tiles`, `chat-detective`, `operation-history`, `hints-button`; `onComplete` вызывает существующий `handleOnboardingComplete` |
| 7 | `components/game/MissionCard.tsx` | Client | Проп `demo?: boolean` — форма не вызывает `/api/missions/*`, кнопка «Начать» → `controller.next` (через `onDemoStart` колбэк) |
| 8 | `components/game/crack/CrackGamePanel.tsx` | Client | Проп `demo?: boolean` + `demoState?: CrackDemoState` — короткое замыкание всех `fetch`, рендер из `demoState` (в этой части — каркас панели без точной доски Wordle) |
| 9 | `components/game/decipher/DecipherGamePanel.tsx` | Client | Проп `demo?: boolean` + `demoState?: DecipherDemoState` — аналогично |
| 10 | `components/game/rdp/RdpGamePanel.tsx` | Client | Проп `demo?: boolean` + `demoState?: RdpDemoState` — аналогично (без `/api/missions/rdp/*`) |
| 11 | `.docs/modules/onboarding.md` | Документация | Полная перезапись под 22-шаговую архитектуру (см. ниже) |

---

## Детали реализации

### `DashboardClient.tsx` — ключевые изменения

```ts
// Новый стейт
const [demoScene, setDemoScene] = useState<OnboardingScene | null>(null);

// Рендер тура
{!onboardingDone && (
  <OnboardingController
    onSceneChange={setDemoScene}
    onComplete={handleOnboardingComplete}
  />
)}

// data-onboarding-id на существующих элементах:
// data-onboarding-id="status-bar"
// data-onboarding-id="mission-tiles"
// data-onboarding-id="chat-detective"
// data-onboarding-id="operation-history"
// data-onboarding-id="hints-button"
```

**Логика рендера демо-сцены** (вместо реальных панелей при активном туре):
- `demoScene === 'crack-launch'` → `<MissionCard demo />` (crack)
- `demoScene === 'crack-game'` → `<CrackGamePanel demo demoState={...} />`
- `demoScene === 'crack-done'` → `<CrackGamePanel demo demoState={...} />` (финальное состояние)
- Аналогично для `decipher-*` и `rdp-*`
- `demoScene === 'base'` или `null` → обычный dashboard без демо-панелей

### `MissionCard.tsx` — изменения

```ts
interface MissionCardProps {
  // ... существующие пропы
  demo?: boolean;
  onDemoStart?: () => void; // колбэк для контроллера → next step
}
```

- При `demo === true`: кнопка «Начать» вызывает `onDemoStart?.()`, форма НЕ отправляется
- Визуально карточка идентична боевой

### Игровые панели — паттерн demo-режима

Все три панели получают `demo` флаг и опциональное демо-состояние. При `demo === true`:
- `useEffect` с `fetch` не вызывается
- `useState` инициализируется из `demoState` вместо запроса к API
- Все action-кнопки (отправить слово, расшифровать, подключиться) → либо `noop`, либо `onDemoAction?.()` для перехода к следующему шагу тура
- Запрет на реальную запись: нет вызовов `/api/missions/*`, `/api/logs/*`, `/api/progress/*`

### `.docs/modules/onboarding.md` — что переписать

Заменить устаревшие разделы:
- **Удалить:** раздел «Технология (react-joyride)» и весь конфиг `Joyride`
- **Заменить:** «Шаги онбординга» (7 статичных) → карта 22 интерактивных шагов со сценами
- **Обновить архитектуру:** кастомный overlay-движок на Tailwind; `OnboardingController` / `OnboardingTooltip` / `OnboardingSpotlight` вместо `OnboardingOverlay`
- **Добавить:** описание `demoScene` state в `DashboardClient`, паттерн `demo`-пропа в панелях, реестр `ONBOARDING_TARGETS`
- **Убрать:** зависимость `react-joyride` из package.json-раздела
- **Сохранить:** серверная защита `onboardingDone`, атомарность `POST /api/onboarding/complete`, логика показа (связь «первое сообщение Детектива ← завершение онбординга»), поведение при перезапуске

---

## Карта шагов Таска 2 (dashboard-уровень) — что должно работать после этой части

| Шаг | Сцена | Подсветка | Ожидаемое поведение |
|-----|-------|-----------|---------------------|
| 1 | `base` (blur) | — | Приветствие по центру, кнопка «Далее» |
| 2 | `base` | — | Обзор трёх инструментов, тултип по центру |
| 3 | `base` | `mission-tiles` | Spotlight на плашках миссий |
| 11 | `base` | `mission-tiles` | Spotlight на плашке Дешифратор |
| 17 | `base` | `mission-tiles` | Spotlight на плашке Удалённый доступ |
| 21 | `base` | `hints-button` | Spotlight на кнопке «ПОДСКАЗКА» |
| 22 | `chat-final` | `chat-detective` | «Завершить инструктаж» → complete |

Шаги 4–10, 12–16, 18–20 тоже должны переключать `demoScene` (открывать демо-панели), но их внутренний контент — Таск 3.

---

## Референсы

| Файл | Зачем |
|------|-------|
| `.docs/ref/on_step-1.jpg … on_step-22.jpg` | Дизайн интеграции, spotlight на реальных элементах |
| `.docs/phases/phase-18.md` | DoD таска |
| `components/game/DashboardClient.tsx` | Текущие стейты и рендер-логика |
| `components/game/MissionCard.tsx` | Текущая форма запуска |
| `components/game/{crack,decipher,rdp}/*GamePanel.tsx` | Места `fetch` для demo-замыкания |

---

## Definition of Done (TASK-2)

- [ ] Тур стартует только при `onboardingDone === false` на `/dashboard`
- [ ] Шаги **1, 2, 3, 11, 17, 21, 22** проходятся целиком; навигация «Далее / Назад» работает; Esc и клик по фону не закрывают тур
- [ ] `data-onboarding-id` навешаны на все целевые элементы; spotlight корректно позиционируется к ним, в т.ч. после ресайза окна
- [ ] Контроллер корректно переключает `demoScene` (открывает демо-панели / возвращает `base`)
- [ ] Шаг 22: «Завершить инструктаж» → `POST /api/onboarding/complete` → чат Детектива стартует, оверлей закрывается без hard refresh
- [ ] Демо-режим не делает ни одного вызова `/api/missions/*` и не пишет реальные логи/прогресс
- [ ] `.docs/modules/onboarding.md` переписан под 22-шаговую архитектуру (нет упоминаний `react-joyride`)
- [ ] `npm run type-check` проходит без ошибок
- [ ] `npm run lint` проходит без ошибок
- [ ] Нет `any` типов
- [ ] Проверить все пункты из `.docs/dod-global.md`
