# Модуль: Онбординг (onboarding)

> Спецификация одноразовой экскурсии по интерфейсу при первом входе игрока.
> Связанные файлы: `.docs/database.md` (поле `User.onboardingDone`), `.docs/modules/auth.md`, `.docs/modules/logs.md`.

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Архитектурные решения](#архитектурные-решения)
3. [Шаги онбординга](#шаги-онбординга)
4. [Логика показа](#логика-показа)
5. [Технология (react-joyride)](#технология-react-joyride)
6. [API-эндпоинт](#api-эндпоинт)
7. [Файлы, которые создаются](#файлы-которые-создаются)
8. [Серверные правила](#серверные-правила)
9. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Цели модуля

После завершения этого модуля:
- При **первом** входе на `/dashboard` игрок видит оверлей-экскурсию по интерфейсу
- Подсвечиваются реальные элементы dashboard в логичной последовательности
- После прохождения — `User.onboardingDone = true` (флаг сохранён на сервере)
- В `OperationLog` пишется первая запись: «Подключение установлено»
- При повторном входе онбординг **не показывается**
- Нет кнопки Skip — только последовательное «Далее»

**Не входит в модуль:**
- Сами компоненты dashboard (это в модуле dashboard / другие модули миссий)
- Контент текстов онбординга — заглушки в коде, финальные тексты от заказчика
- Туториал по конкретным мини-играм — отдельные модули миссий, не онбординг

---

## Архитектурные решения

### 1. Оверлей поверх настоящего dashboard, а не отдельный экран

**Что это значит:** игрок видит реальный dashboard со всеми элементами (плашки миссий, чат Детектива, история операций), а сверху лежит полупрозрачный оверлей с подсветкой одного элемента и тултипом-подсказкой рядом.

**Почему так, а не отдельная страница с моками:**
- Игрок сразу видит реальный интерфейс — после онбординга не нужно «переориентироваться»
- Не нужно поддерживать две версии экранов (моки + реальный dashboard)
- Если в dashboard что-то поменяется — мокированные скрины онбординга устареют, а оверлей продолжит работать

### 2. Привязка к элементам через `data-onboarding-id`

react-joyride использует CSS-селекторы для подсветки элементов. Использование классов или id опасно:
- Классы Tailwind могут совпасть случайно
- id могут конфликтовать с другими частями приложения

Используем атрибуты `data-onboarding-id="<step-id>"`:

```tsx
// в dashboard
<div data-onboarding-id="status-bar">
  <StatusBar />
</div>
<div data-onboarding-id="mission-tiles">
  <MissionTiles />
</div>
```

```typescript
// в OnboardingOverlay
const steps = [
  { target: '[data-onboarding-id="status-bar"]', content: '...' },
  { target: '[data-onboarding-id="mission-tiles"]', content: '...' },
];
```

**Соглашение:** все `data-onboarding-id` константами лежат в `constants/onboardingSteps.ts` — в одном месте видно, какие элементы нужны для онбординга. Если разработчик случайно удалит атрибут с элемента — ошибка отловится при ручной проверке.

### 3. Нет Skip — только «Далее»

Заказчик хочет, чтобы каждый игрок прошёл всю экскурсию. Это даёт:
- Гарантию, что игрок видел все ключевые элементы
- Уменьшение количества support-вопросов «а где у вас X»

**Технически:** в `JoyrideProps` ставим `disableSkipButton: true`. Кнопки «Назад» и «Далее» — стандартные.

### 4. Серверная защита `onboardingDone`

Флаг `User.onboardingDone` пишется ТОЛЬКО сервером в `POST /api/onboarding/complete`. Клиент не может напрямую редактировать поля User. Это предохранитель — игрок не может через DevTools пометить себя «онбординг пройден» и потом оспаривать, что не видел инструкции.

### 5. Атомарность завершения: флаг + лог в одной транзакции

Завершение онбординга = два действия:
1. `UPDATE User SET onboardingDone=true`
2. `INSERT OperationLog ('Подключение установлено')`

Они должны произойти вместе или не произойти вообще. Если транзакция откатилась — клиент получает ошибку и пытается ещё раз. Если завершилось наполовину — игрок без `onboardingDone=true` увидит онбординг снова, а лог уже добавлен (дубль) — это плохо.

```typescript
await prisma.$transaction([
  prisma.user.update({ where: { id: userId }, data: { onboardingDone: true } }),
  prisma.operationLog.create({ data: { userId, type: 'INFO', message: renderLogMessage('onboarding_completed') } }),
]);
```

---

## Шаги онбординга

Минимальный набор шагов (7 штук). Финальные тексты — от заказчика, в коде заглушки.

| # | `data-onboarding-id` | Что подсвечивается | Текст-заглушка |
|---|---|---|---|
| 1 | `welcome` (центр экрана, без привязки) | Приветствие | «Добро пожаловать, детектив. Я проведу краткий инструктаж.» |
| 2 | `status-bar` | Верхний статусбар (STATUS / TARGET / ACCESS) | «Здесь отображается статус подключения и текущая цель.» |
| 3 | `mission-tiles` | Плашки активных миссий | «**Три направления расследования:** взлом сайтов, дешифровка папок, удалённый доступ. Нажмите на плашку — откроется форма запуска. Введите данные, которые удалось получить, чтобы запустить мини-игру.» |
| 4 | `chat-detective` | Чат Детектива | «Здесь я буду давать инструкции по ходу расследования.» |
| 5 | `operation-history` | История операций (внизу) | «Все ваши действия фиксируются здесь.» |
| 6 | `hints-button` | Кнопка «Подсказка от Детектива» | «Если зайдёте в тупик — нажмите для получения подсказки.» |
| 7 | `restart-button` | Кнопка «Начать заново» | «В любой момент вы можете перезапустить расследование.» |

После шага 7 — кнопка «Завершить» вместо «Далее». Нажатие → `POST /api/onboarding/complete` → закрытие оверлея.

**Контрактное правило:** если разработчик удаляет элемент с `data-onboarding-id` без обновления `constants/onboardingSteps.ts` — ручная проверка перед PR должна это поймать. В DoD добавляется пункт «Онбординг проходит до конца без ошибок».

---

## Логика показа

### Условие показа

Онбординг показывается, если **все** условия выполнены:
1. Игрок залогинен (есть session с `type='PLAYER'`)
2. Открыта страница `/dashboard`
3. `User.onboardingDone === false`
4. Устройство удовлетворяет минимальным требованиям экрана (если нет — `MobileGuard` из `mobile-block.md` перехватывает приложение раньше, и игрок не доходит до dashboard)

### Когда стартует

При маунте dashboard:

```tsx
// app/(game)/dashboard/page.tsx (Server Component)
const session = await auth();
const user = await prisma.user.findUnique({ where: { id: session.user.id } });
// передаём флаг в Client Component
return <DashboardClient onboardingDone={user.onboardingDone} ... />;
```

```tsx
// components/game/dashboard/DashboardClient.tsx (Client Component)
'use client';
export function DashboardClient({ onboardingDone, ... }) {
  return (
    <>
      <Dashboard ... />
      {!onboardingDone && <OnboardingOverlay />}
    </>
  );
}
```

### Когда заканчивается

Игрок нажимает «Завершить» на последнем шаге → `OnboardingOverlay`:
1. Делает `POST /api/onboarding/complete`
2. После 200 — закрывает оверлей (локальный state)
3. **Не делает hard refresh** — пользователь сразу попадает в dashboard без перезагрузки

При следующем заходе на dashboard `user.onboardingDone === true`, оверлей не рендерится.

### Поведение при перезапуске игры

`User.onboardingDone` **НЕ сбрасывается** при `POST /api/game/restart`. Логика: онбординг — это про обучение интерфейсу, а не про сюжет. Игрок уже знает интерфейс, второй раз показывать не нужно.

См. также: `database.md` → раздел `User`, → `restart.md`.

### Что если игрок закрыл вкладку посреди онбординга

`User.onboardingDone` всё ещё `false`. При следующем заходе онбординг покажется **с самого начала** (шаг 1). Прогресс шагов не сохраняется на сервере — это малый объём шагов, нет смысла усложнять.

---

## Технология (react-joyride)

### Почему react-joyride

- Простая интеграция с React
- Поддержка `data-*` селекторов
- Кастомизация стилей через `styles` prop
- ~10kb gzipped — приемлемый размер для одноразового использования

### Конфигурация

```typescript
// components/game/onboarding/OnboardingOverlay.tsx
'use client';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { onboardingSteps } from '@/constants/onboardingSteps';

export function OnboardingOverlay() {
  const [run, setRun] = useState(true);

  const handleCallback = async (data: CallBackProps) => {
    if (data.status === STATUS.FINISHED) {
      setRun(false);
      try {
        await fetch('/api/onboarding/complete', { method: 'POST' });
      } catch (e) {
        // Если запрос упал — флаг останется false, при перезагрузке покажется снова.
        // Не критично, лучше так, чем фолс-позитив.
        console.error('Onboarding complete failed:', e);
      }
    }
  };

  return (
    <Joyride
      steps={onboardingSteps}
      run={run}
      continuous
      showProgress
      showSkipButton={false}
      disableCloseOnEsc
      disableOverlayClose
      hideBackButton={false}
      callback={handleCallback}
      locale={{
        back: 'Назад',
        next: 'Далее',
        last: 'Завершить',
      }}
      styles={{
        options: {
          primaryColor: 'var(--accent-primary)', // соответствует дизайн-токенам
          textColor: 'var(--text-primary)',
          backgroundColor: 'var(--bg-card)',
          overlayColor: 'rgba(0, 0, 0, 0.85)',
          zIndex: 10000,
        }
      }}
    />
  );
}
```

**Ключевые опции:**
- `continuous: true` — последовательный показ всех шагов
- `disableCloseOnEsc: true` + `disableOverlayClose: true` — нельзя закрыть до конца (только «Завершить» на последнем шаге)
- `showSkipButton: false` — нет Skip
- `locale` — русские подписи кнопок

---

## API-эндпоинт

### `POST /api/onboarding/complete`

**Auth:** Player only (`session.user.type === 'PLAYER'`)

**Body:** пустой (никаких параметров не нужно — userId берём из сессии)

**Алгоритм:**
```typescript
// app/api/onboarding/complete/route.ts
export async function POST() {
  const session = await auth();
  if (!session || session.user.type !== 'PLAYER') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Проверка идемпотентности — если уже пройден, возвращаем 200 без изменений
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { onboardingDone: true } });
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }
  if (user.onboardingDone) {
    return Response.json({ success: true, alreadyCompleted: true });
  }

  // Атомарная транзакция: флаг + лог
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { onboardingDone: true },
    }),
    prisma.operationLog.create({
      data: {
        userId,
        type: 'INFO',
        message: renderLogMessage('onboarding_completed'),
      },
    }),
  ]);

  return Response.json({ success: true });
}
```

**Response 200:**
```json
{ "success": true }
```

или (если уже завершён ранее):
```json
{ "success": true, "alreadyCompleted": true }
```

**Response 401 / 404:** стандартные.

**Rate limit:** не нужен — эндпоинт идемпотентен и срабатывает один раз за время жизни аккаунта.

---

## Файлы, которые создаются

```
app/
├── api/
│   └── onboarding/
│       └── complete/
│           └── route.ts                    # POST: завершение онбординга

components/
└── game/
    └── onboarding/
        └── OnboardingOverlay.tsx           # Client Component, Joyride wrapper

constants/
└── onboardingSteps.ts                      # массив Step[] с targets и текстами-заглушками

# Изменения в существующих файлах:
app/(game)/dashboard/page.tsx               # достаём user.onboardingDone, передаём в DashboardClient
components/game/dashboard/DashboardClient.tsx  # условный рендер OnboardingOverlay
+ добавление data-onboarding-id="..." на нужные элементы dashboard
```

**Зависимости (package.json):**
```json
"react-joyride": "^2.x"
```

---

## Серверные правила

1. **`onboardingDone` — только сервер.** Нет публичного эндпоинта для записи этого поля кроме `/api/onboarding/complete`. Внутри эндпоинта — проверка авторизации.

2. **Идемпотентность:** повторный вызов `/api/onboarding/complete` для уже завершившего игрока — не ошибка, возвращает 200 с `alreadyCompleted: true`. Это защита от двойных запросов при сетевых проблемах.

3. **Не дублировать лог при повторном вызове:** если `user.onboardingDone === true` — не пишем второй `OperationLog`. Иначе у игрока в истории появится несколько записей «Подключение установлено».

4. **При перезапуске игры — флаг не трогается.** В `lib/game/restart.ts` — `User` НЕ обновляется. Только связанные таблицы прогресса.

5. **Ошибка отправки `/complete` — мягкая обработка.** Если на клиенте `fetch` упал (сеть, 500) — оверлей закрывается, но `onboardingDone` остаётся `false`. При следующем заходе игрок увидит онбординг снова. Это лучше, чем застрять на оверлее. Лог ошибки в консоли клиента.

6. **Нет валидации Zod на body** — body пустой. Если в будущем добавятся параметры (например, отслеживание времени прохождения для аналитики) — добавить Zod-схему.

---

## Связи с другими модулями

- **`auth.md`** — после первого логина игрока эта механика проверяет `User.onboardingDone` через `await prisma.user.findUnique(...)` в Server Component dashboard.
- **`logs.md`** — запись «Подключение установлено» использует шаблон `onboarding_completed` из `constants/logTemplates.ts` через `lib/operationLog.ts`. На момент Фазы 2 модуль logs ещё не описан, но утилита `writeLog()` к этому моменту уже существует — этот эндпоинт может писать через неё или напрямую (как показано выше через транзакцию). Решение принимается при реализации Фазы 2.
- **`mobile-block.md`** — общая заглушка перехватывает приложение в корневом layout при недостаточном размере экрана. Игрок с маленьким экраном не доходит до dashboard и не видит онбординг. Никакой совместной логики приоритетов в DashboardClient не требуется.
- **`restart.md`** — `User.onboardingDone` НЕ сбрасывается. Защищено в `lib/game/restart.ts`.
- **`database.md`** — поле `User.onboardingDone` описано там; здесь только применение.
