# Модуль: Финальный отчёт (final-report)

> Спецификация финального отчёта: вопросы с radio-ответами, серверная проверка, текст концовки в зависимости от выбора в чате Марины.
> Связанные файлы: `.docs/database.md` (модели `FinalReportQuestion`, `FinalReportContent`, `GameProgress`, `MissionSlot`, `MissionProgress`, `ChatState`), `.docs/modules/chats.md` (`finalChoice`), `.docs/modules/logs.md` (шаблон `final_report_submitted`).

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Архитектурные решения](#архитектурные-решения)
3. [Двойной триггер доступности](#двойной-триггер-доступности)
4. [Серверная проверка ответов](#серверная-проверка-ответов)
5. [Соответствие с FinalReportContent](#соответствие-с-finalreportcontent)
6. [Защита от повторной сдачи](#защита-от-повторной-сдачи)
7. [API-эндпоинты](#api-эндпоинты)
8. [UI отчёта](#ui-отчёта)
9. [Файлы, которые создаются](#файлы-которые-создаются)
10. [Серверные правила](#серверные-правила)
11. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Цели модуля

После завершения этого модуля:
- На главном экране есть кнопка «Финальный отчёт» — заблокирована до выполнения двойного триггера
- При выполнении триггера (все активные миссии пройдены + игрок сделал финальный выбор в чате Марины) — кнопка разблокируется
- Игрок открывает модалку отчёта, видит вопросы с radio-кнопками
- Сдаёт отчёт → сервер проверяет ответы, считает процент правильных
- Игрок видит результат + текст финала, зависящий от его `finalChoice` в чате Марины (`PROTECT` / `ACCUSE`)
- Повторная сдача отчёта **запрещена** — только просмотр результата
- При перезапуске игры всё сбрасывается (можно сдать заново)

**Не входит в модуль:**
- Тексты вопросов и финалов — заглушки в коде, финальные от заказчика через админку
- Дизайн модалки — верстается на Tailwind по ходу фазы
- Админка для CRUD вопросов и контентов концовок — `admin.md`
- Расчёт баланса концовок (PROTECT/ACCUSE — это сюжетный выбор, не «правильный/неправильный»)

---

## Архитектурные решения

### 1. Двойной триггер доступности

Финальный отчёт доступен, когда выполнены **оба** условия:
1. **Все активные миссии пройдены:** для каждого `MissionSlot` с `isActive=true` существует `MissionProgress(userId, slotId)` с `completed=true`.
2. **Игрок сделал финальный выбор Марины:** `ChatState.finalChoice !== null`.

**Почему именно так:**
- Только миссии — недостаточно: игрок может пройти все миссии, но не дойти до финального выбора Марины. Тогда нет основания дать финал.
- Только finalChoice — недостаточно: игрок может технически дойти до Марины (если глобальный триггер сработал по другой причине), но не пройти миссии.

**Что не входит в проверку:**
- Чат Детектива (`detectiveFinished`) — не обязательно. Игрок может закончить чат Детектива в любой момент или вообще пропустить.

### 2. Только активные миссии учитываются

`MissionSlot.isActive=false` — мягкое отключение. Эти слоты **не учитываются** в проверке. Это позволяет админу временно отключить миссию, не блокируя возможность пройти отчёт.

```typescript
const activeSlots = await prisma.missionSlot.findMany({
  where: { isActive: true },
});
const completedCount = await prisma.missionProgress.count({
  where: {
    userId,
    completed: true,
    slotId: { in: activeSlots.map(s => s.id) },
  },
});
const allMissionsDone = completedCount === activeSlots.length;
```

### 3. `correctOption` НИКОГДА не возвращается клиенту

Поле `FinalReportQuestion.correctOption` — индекс правильного ответа (0..N-1). На клиенте — только `questionText` и `options` (массив строк). Проверка ответов — серверная.

**Атака без этой защиты:** игрок открывает DevTools → видит сетевой ответ с `correctOption` → выбирает правильные ответы → 100% результат без знания сюжета.

### 4. Текст финала зависит от `ChatState.finalChoice`

После сдачи отчёта сервер ищет `FinalReportContent` по `finalChoiceValue === ChatState.finalChoice`. Возвращает `title` + `bodyText` этой записи.

Возможные значения `finalChoice` — UPPERCASE: `PROTECT`, `ACCUSE`. Должны совпадать с `value` в choices финальной реплики Марины (`marina_final_choice`). Конвенция описана в `chats.md`.

### 5. Защита от повторной сдачи

После успешной сдачи `GameProgress.finalReportDone=true`. Эндпоинт `/submit` проверяет этот флаг — если уже `true`, возвращает 400. Просмотр результата — через отдельный `/result`.

### 6. Все 4 эндпоинта с разной семантикой

| Эндпоинт | Когда используется | Что возвращает |
|---|---|---|
| `GET /availability` | Постоянно — клиент проверяет, можно ли открыть отчёт | `{ available: bool, reasonsBlocked?: string[] }` |
| `GET /questions` | При открытии модалки отчёта | Массив вопросов БЕЗ `correctOption` |
| `POST /submit` | После заполнения всех вопросов | Результат + текст финала |
| `GET /result` | Просмотр уже сданного отчёта | Тот же результат, что вернул `/submit` |

Разделение `/submit` и `/result` — `/submit` пишет в БД, `/result` только читает. Клиент после первой сдачи всегда дёргает `/result`.

### 7. Запись результата в `GameProgress.finalScore`

`GameProgress.finalScore` — процент правильных ответов (0..100). Используется для:
- Отображения игроку при просмотре результата
- Опционально: статистика в админке (на старте не делаем)

---

## Двойной триггер доступности

### `GET /api/final-report/availability`

**Auth:** Player only

**Алгоритм:**
```typescript
async function checkAvailability(userId: string) {
  // 1. Все активные миссии пройдены?
  const activeSlots = await prisma.missionSlot.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const completedCount = await prisma.missionProgress.count({
    where: {
      userId,
      completed: true,
      slotId: { in: activeSlots.map(s => s.id) },
    },
  });
  const allMissionsDone = completedCount === activeSlots.length && activeSlots.length > 0;

  // 2. finalChoice сделан?
  const chatState = await prisma.chatState.findUnique({
    where: { userId },
    select: { finalChoice: true },
  });
  const hasChoice = chatState?.finalChoice != null;

  // 3. Уже сдан?
  const progress = await prisma.gameProgress.findUnique({
    where: { userId },
    select: { finalReportDone: true },
  });

  const reasonsBlocked: string[] = [];
  if (!allMissionsDone) reasonsBlocked.push('MISSIONS_INCOMPLETE');
  if (!hasChoice) reasonsBlocked.push('FINAL_CHOICE_MISSING');

  return {
    available: allMissionsDone && hasChoice,
    alreadySubmitted: progress?.finalReportDone ?? false,
    reasonsBlocked: reasonsBlocked.length ? reasonsBlocked : undefined,
  };
}
```

**Response 200 (доступен):**
```json
{ "available": true, "alreadySubmitted": false }
```

**Response 200 (недоступен — не все миссии):**
```json
{
  "available": false,
  "alreadySubmitted": false,
  "reasonsBlocked": ["MISSIONS_INCOMPLETE"]
}
```

**Response 200 (уже сдан):**
```json
{ "available": false, "alreadySubmitted": true }
```

**Что НЕ возвращается:** список конкретных непройденных миссий. Клиент показывает общее сообщение «Завершите все активные миссии и сюжетную линию». Точную информацию игрок видит на dashboard через плашки миссий и чат.

---

## Серверная проверка ответов

### `POST /api/final-report/submit`

**Auth:** Player only

**Body (Zod):**
```typescript
const submitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().cuid(),
    selectedOption: z.number().int().min(0),
    // Верхняя граница проверяется per-question на сервере (зависит от options.length)
  })).min(1),
});
```

**Алгоритм:**
```typescript
async function submitReport(userId: string, answers: SubmitAnswers) {
  // 1. Проверка двойного триггера
  const availability = await checkAvailability(userId);
  if (!availability.available && !availability.alreadySubmitted) {
    return error(400, 'NOT_AVAILABLE', { reasons: availability.reasonsBlocked });
  }

  // 2. Защита от повторной сдачи
  if (availability.alreadySubmitted) {
    return error(400, 'ALREADY_SUBMITTED');
  }

  // 3. Загрузить все вопросы
  const questions = await prisma.finalReportQuestion.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  // 4. Проверка: все ли вопросы покрыты в answers?
  const answeredIds = new Set(answers.map(a => a.questionId));
  const missingQuestions = questions.filter(q => !answeredIds.has(q.id));
  if (missingQuestions.length > 0) {
    return error(400, 'INCOMPLETE_ANSWERS');
  }

  // 5. Валидация selectedOption per-question + подсчёт правильных ответов
  let correctCount = 0;
  for (const q of questions) {
    const userAnswer = answers.find(a => a.questionId === q.id);
    if (!userAnswer) continue;

    const options = q.options as string[];

    // selectedOption должен быть в диапазоне 0..options.length-1
    if (userAnswer.selectedOption < 0 || userAnswer.selectedOption >= options.length) {
      return error(400, 'INVALID_OPTION_INDEX', {
        questionId: q.id,
        selectedOption: userAnswer.selectedOption,
        maxAllowed: options.length - 1,
      });
    }

    if (userAnswer.selectedOption === q.correctOption) {
      correctCount++;
    }
  }
  const percent = Math.round((correctCount / questions.length) * 100);

  // 6. Получить finalChoice
  const chatState = await prisma.chatState.findUnique({
    where: { userId },
    select: { finalChoice: true },
  });
  const finalChoice = chatState?.finalChoice;
  if (!finalChoice) {
    // Не должно случаться — checkAvailability это уже проверил
    return error(500, 'NO_FINAL_CHOICE');
  }

  // 7. Получить контент финала
  const content = await prisma.finalReportContent.findUnique({
    where: { finalChoiceValue: finalChoice },
  });
  if (!content) {
    // Расхождение в конфигурации — админ удалил FinalReportContent после того,
    // как игрок сделал выбор. Возвращаем 500 с понятным кодом.
    return error(500, 'FINAL_CONTENT_MISSING', { finalChoice });
  }

  // 8. Транзакция: пометить отчёт сданным + лог
  await prisma.$transaction([
    prisma.gameProgress.update({
      where: { userId },
      data: { finalReportDone: true, finalScore: percent },
    }),
    prisma.operationLog.create({
      data: {
        userId,
        type: 'SUCCESS',
        message: renderLogMessage('final_report_submitted', { percent: percent.toString() }),
      },
    }),
  ]);

  return {
    success: true,
    score: {
      correctCount,
      totalCount: questions.length,
      percent,
    },
    finalContent: {
      title: content.title,
      bodyText: content.bodyText,
      finalChoiceValue: content.finalChoiceValue,
    },
  };
}
```

**Response 200 (успех):**
```json
{
  "success": true,
  "score": {
    "correctCount": 8,
    "totalCount": 10,
    "percent": 80
  },
  "finalContent": {
    "title": "Защита",
    "bodyText": "Финальный текст для PROTECT...",
    "finalChoiceValue": "PROTECT"
  }
}
```

**Response 400:**
- `NOT_AVAILABLE` — двойной триггер не выполнен
- `ALREADY_SUBMITTED` — отчёт уже сдан
- `INCOMPLETE_ANSWERS` — не все вопросы отвечены
- `INVALID_OPTION_INDEX` — `selectedOption` вышел за пределы `0..options.length-1` для конкретного вопроса

**Response 500:**
- `FINAL_CONTENT_MISSING` — для `finalChoice` нет соответствующего `FinalReportContent` (расхождение конфигурации)

---

## Соответствие с FinalReportContent

### Инвариант

Для каждого возможного `finalChoice`, который может быть установлен через чат Марины — должна существовать запись `FinalReportContent` с `finalChoiceValue` = этому значению.

**Возможные значения `finalChoice`** определяются по `ChatScript.choices` финальной реплики Марины (где `code === 'marina_final_choice'`). Стандартный набор: `PROTECT`, `ACCUSE`.

### Валидатор связности (используется админкой)

`GET /api/admin/report/validate`

```typescript
async function validateReportConfig() {
  const issues: string[] = [];

  // 1. Найти финальную реплику Марины
  const finalScript = await prisma.chatScript.findFirst({
    where: { chatType: 'MARINA', hasChoices: true, code: 'marina_final_choice' },
  });
  if (!finalScript) {
    issues.push('MARINA_FINAL_SCRIPT_NOT_FOUND');
    return { isValid: false, issues };
  }

  const choices = (finalScript.choices ?? []) as Array<{ label: string; value: string }>;

  // 2. Проверка: для каждого value существует FinalReportContent
  const contents = await prisma.finalReportContent.findMany();
  const contentValues = new Set(contents.map(c => c.finalChoiceValue));

  for (const choice of choices) {
    if (!contentValues.has(choice.value)) {
      issues.push(`MISSING_CONTENT:${choice.value}`);
    }
  }

  // 3. Обратная проверка: каждый FinalReportContent ссылается на существующий choice
  const choiceValues = new Set(choices.map(c => c.value));
  for (const content of contents) {
    if (!choiceValues.has(content.finalChoiceValue)) {
      issues.push(`ORPHAN_CONTENT:${content.finalChoiceValue}`);
    }
  }

  // 4. Проверка UPPERCASE-конвенции
  for (const choice of choices) {
    if (choice.value !== choice.value.toUpperCase()) {
      issues.push(`NOT_UPPERCASE_CHOICE:${choice.value}`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
```

**Response 200:**
```json
{
  "isValid": true,
  "issues": []
}
```

или

```json
{
  "isValid": false,
  "issues": ["MISSING_CONTENT:ACCUSE", "NOT_UPPERCASE_CHOICE:Protect"]
}
```

Админка показывает баннер-предупреждение в разделах `chats` и `report`, если `isValid: false`. Это не блокирует работу админки, но гарантирует, что заказчик увидит проблему до запуска в прод.

См. `admin.md` → раздел report.

### UPPERCASE-конвенция

`finalChoiceValue` ВСЕГДА в верхнем регистре: `PROTECT`, `ACCUSE`. Должно совпадать:
- `value` в choices финальной реплики Марины
- `FinalReportContent.finalChoiceValue`
- `ChatState.finalChoice` (записывается с UPPERCASE через `chats.md`)

---

## Защита от повторной сдачи

### Логика

`GameProgress.finalReportDone=true` после первой сдачи. Эндпоинт `/submit` проверяет этот флаг — если уже `true`, возвращает `ALREADY_SUBMITTED`.

Просмотр результата после сдачи — через отдельный `GET /result`:

### `GET /api/final-report/result`

**Алгоритм:**
```typescript
async function getResult(userId: string) {
  const progress = await prisma.gameProgress.findUnique({
    where: { userId },
    select: { finalReportDone: true, finalScore: true },
  });

  if (!progress?.finalReportDone) {
    return error(400, 'NOT_SUBMITTED');
  }

  const chatState = await prisma.chatState.findUnique({
    where: { userId },
    select: { finalChoice: true },
  });
  if (!chatState?.finalChoice) {
    return error(500, 'NO_FINAL_CHOICE');
  }

  const content = await prisma.finalReportContent.findUnique({
    where: { finalChoiceValue: chatState.finalChoice },
  });
  if (!content) {
    return error(500, 'FINAL_CONTENT_MISSING', { finalChoice: chatState.finalChoice });
  }

  // Подсчитать correctCount и totalCount по всем вопросам — нужно для отображения «X из Y»
  // Но мы не сохраняли answers — только finalScore (процент).
  // Решение: считать из totalCount (актуального числа вопросов) и process backwards:
  // correctCount = round(totalCount * finalScore / 100)
  // Если админ изменил число вопросов после сдачи отчёта — backwards-расчёт может дать
  // некорректный correctCount, но finalScore остаётся правильным (он сохранён).
  const totalCount = await prisma.finalReportQuestion.count();
  const correctCount = Math.round((totalCount * (progress.finalScore ?? 0)) / 100);

  return {
    score: {
      correctCount,
      totalCount,
      percent: progress.finalScore,
    },
    finalContent: {
      title: content.title,
      bodyText: content.bodyText,
      finalChoiceValue: content.finalChoiceValue,
    },
  };
}
```

**Response 200:** идентично `/submit`.

**Response 400:**
- `NOT_SUBMITTED` — отчёт ещё не сдан, нечего показывать

⚠️ **Edge case:** если админ удаляет/добавляет вопросы после сдачи отчёта — `correctCount` может быть некорректным (рассчитывается обратным процентом). Для полной точности нужно сохранять ответы игрока в БД (например, в `GameProgress.metadata.answers`). На MVP — оставляем простой подход, расхождение приемлемо.

---

## API-эндпоинты

| Метод | Путь | Назначение | Auth |
|---|---|---|---|
| GET | `/api/final-report/availability` | Проверить, доступен ли отчёт | Player |
| GET | `/api/final-report/questions` | Получить список вопросов | Player |
| POST | `/api/final-report/submit` | Сдать отчёт | Player |
| GET | `/api/final-report/result` | Просмотр сданного отчёта | Player |

### `GET /api/final-report/questions`

**Алгоритм:**
```typescript
async function getQuestions(userId: string) {
  const availability = await checkAvailability(userId);
  if (!availability.available && !availability.alreadySubmitted) {
    return error(400, 'NOT_AVAILABLE', { reasons: availability.reasonsBlocked });
  }

  const questions = await prisma.finalReportQuestion.findMany({
    orderBy: { orderIndex: 'asc' },
    select: {
      id: true,
      orderIndex: true,
      questionText: true,
      options: true,
      // НЕ возвращаем correctOption!
    },
  });

  return { questions };
}
```

**Response 200:**
```json
{
  "questions": [
    {
      "id": "clx1",
      "orderIndex": 1,
      "questionText": "Кто инициировал доведение до самоубийства?",
      "options": ["Виктор", "Евгений", "Елена", "Марина"]
    },
    ...
  ]
}
```

⚠️ **Критично:** в `select` явно перечислены только публичные поля. **`correctOption` не должен случайно попасть** в ответ. Это серверное правило #1 модуля.

---

## UI отчёта

### Кнопка на dashboard

Постоянно видна в одном из углов dashboard. По умолчанию **заблокирована** (visually disabled). Клиент дёргает `GET /availability` при загрузке dashboard и периодически (например, после каждого `/api/chat/state`).

При выполнении триггера — кнопка разблокируется, начинает мигать или подсвечиваться (визуальный сигнал).

```tsx
// components/game/report/FinalReportButton.tsx
'use client';
import { useEffect, useState } from 'react';

export function FinalReportButton() {
  const [available, setAvailable] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [open, setOpen] = useState(false);

  const checkAvailability = async () => {
    const res = await fetch('/api/final-report/availability');
    const data = await res.json();
    setAvailable(data.available);
    setAlreadySubmitted(data.alreadySubmitted);
  };

  useEffect(() => {
    checkAvailability();
    // Опционально: реагировать на события (например, после успеха миссии или choice)
  }, []);

  if (!available && !alreadySubmitted) {
    return (
      <button disabled className="opacity-50" title="Завершите все миссии и сюжет">
        Финальный отчёт (заблокировано)
      </button>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="...">
        {alreadySubmitted ? 'Просмотр результата' : 'Финальный отчёт'}
      </button>
      {open && <FinalReportModal alreadySubmitted={alreadySubmitted} onClose={() => setOpen(false)} />}
    </>
  );
}
```

### Модалка отчёта

Два режима:
- **Сдача отчёта:** список вопросов с radio-кнопками, кнопка «Сдать». При сабмите — `/submit`, после ответа — переход к экрану результата.
- **Просмотр результата:** дёргает `/result`, показывает результат + текст финала.

```tsx
// components/game/report/FinalReportModal.tsx
'use client';
import { useEffect, useState } from 'react';
import { ReportQuestion } from './ReportQuestion';
import { ReportResult } from './ReportResult';

export function FinalReportModal({ alreadySubmitted, onClose }) {
  const [stage, setStage] = useState<'questions' | 'result' | 'loading'>('loading');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (alreadySubmitted) {
      fetch('/api/final-report/result')
        .then(r => r.json())
        .then(data => { setResult(data); setStage('result'); });
    } else {
      fetch('/api/final-report/questions')
        .then(r => r.json())
        .then(data => { setQuestions(data.questions); setStage('questions'); });
    }
  }, []);

  const handleSubmit = async () => {
    const submitData = {
      answers: Object.entries(answers).map(([questionId, selectedOption]) => ({
        questionId,
        selectedOption,
      })),
    };
    const res = await fetch('/api/final-report/submit', {
      method: 'POST',
      body: JSON.stringify(submitData),
    });
    if (res.ok) {
      const data = await res.json();
      setResult(data);
      setStage('result');
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center">
      <div className="bg-card max-w-2xl p-6">
        {stage === 'loading' && <Spinner />}

        {stage === 'questions' && (
          <>
            <h2>Финальный отчёт</h2>
            {questions.map(q => (
              <ReportQuestion
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={(opt) => setAnswers({ ...answers, [q.id]: opt })}
              />
            ))}
            <button
              onClick={handleSubmit}
              disabled={Object.keys(answers).length !== questions.length}
            >
              Сдать отчёт
            </button>
          </>
        )}

        {stage === 'result' && result && (
          <ReportResult result={result} onClose={onClose} />
        )}
      </div>
    </div>
  );
}
```

### Компонент ReportResult

Показывает:
- Процент правильных ответов: «Вы ответили правильно на X из Y вопросов (Z%)»
- Заголовок финала (`finalContent.title`)
- Текст финала (`finalContent.bodyText`)
- Кнопка «Закрыть»

---

## Файлы, которые создаются

```
app/
└── api/
    └── final-report/
        ├── availability/route.ts                # GET
        ├── questions/route.ts                   # GET
        ├── submit/route.ts                      # POST
        └── result/route.ts                      # GET

components/
└── game/
    └── report/
        ├── FinalReportButton.tsx                # Client Component, кнопка на dashboard
        ├── FinalReportModal.tsx                 # Client Component, главная модалка
        ├── ReportQuestion.tsx                   # Client Component, один вопрос с radio
        └── ReportResult.tsx                     # Client Component, результат + текст финала

lib/
└── final-report/
    ├── availability.ts                          # checkAvailability(userId)
    └── validate.ts                              # validateReportConfig() — для админки
```

---

## Серверные правила

1. **`correctOption` НИКОГДА не возвращается клиенту.** Поле явно исключено из `select` в `/questions`. Если разработчик случайно вернёт `select: { correctOption: true }` — это **критический баг**, ловится при ревью.

2. **Двойной триггер проверяется на сервере** в `/availability`, `/questions`, `/submit`. Клиент не может «обмануть» эндпоинты, отправив `available=true` — все проверки серверные.

3. **Только активные миссии учитываются.** Слоты с `isActive=false` пропускаются.

4. **`finalChoice` хранится UPPERCASE.** Конвенция проекта. См. `chats.md`.

5. **Защита от повторной сдачи** — через `GameProgress.finalReportDone`. После первой сдачи `/submit` возвращает `ALREADY_SUBMITTED`.

6. **Защита от неполных ответов** — `/submit` проверяет, что все `FinalReportQuestion` покрыты в `answers`. Если нет — `INCOMPLETE_ANSWERS`.

7. **Логирование результата** — пишется ОДИН лог `final_report_submitted` с процентом. Текст шаблона: `"Финальный отчёт сдан. Результат: {percent}%"`.

8. **При перезапуске игры** — `GameProgress.finalReportDone` и `finalScore` обнуляются (UPDATE на дефолты). Игрок может сдать заново. См. `restart.md`.

9. **`correctCount` в `/result` — приближённый**, рассчитывается обратно из процента. Это намеренное упрощение MVP. Если заказчик попросит точные цифры — нужно сохранять ответы игрока в `GameProgress.metadata`.

10. **Валидатор связности `/api/admin/report/validate`** — обязательный инструмент для админки. Должен запускаться:
    - При входе в админский раздел `chats` и `report` (баннер-предупреждение)
    - После любого изменения choices финальной реплики Марины
    - После любого изменения `FinalReportContent`

11. **`MissionProgress` не делается partial** — миссия либо `completed=true`, либо нет. Не учитываем «частичное прохождение» в проценте отчёта.

12. **Никогда не возвращать клиенту:** `correctOption`, `MissionSlot` со всеми полями (только id и isActive для подсчёта прогресса).

13. **Optimistic locking на `GameProgress`.** `/submit` принимает `expectedVersion` в теле, возвращает обновлённую `version` в ответе. При несовпадении — HTTP 409. Двойная защита: `version` + бизнес-флаг `finalReportDone` (запрет повторной отправки). См. `.docs/modules/concurrency.md`.

---

## Связи с другими модулями

- **`database.md`** — модели `FinalReportQuestion`, `FinalReportContent`, `GameProgress` описаны там; здесь только применение.
- **`concurrency.md`** — `/submit` использует optimistic locking. Поле `version` на `GameProgress` инкрементируется при UPDATE.
- **`chats.md`** — `ChatState.finalChoice` устанавливается через `POST /api/chat/choice` при выборе в `marina_final_choice`. UPPERCASE-конвенция описана там.
- **`logs.md`** — используется шаблон `final_report_submitted` с параметром `percent`.
- **`missions-crack.md`**, **`missions-decipher.md`**, **`missions-rdp.md`** — `MissionProgress.completed` для каждой миссии участвует в проверке двойного триггера.
- **`onboarding.md`** — кнопка «Финальный отчёт» имеет `data-onboarding-id` (если решим включить в онбординг — пока нет, см. `onboarding.md`).
- **`restart.md`** — UPDATE `GameProgress`: `finalReportDone=false`, `finalScore=null`. ChatState тоже обнуляется (`finalChoice=null`).
- **`admin.md`** — раздел report: CRUD вопросов, CRUD контентов концовок, валидатор связности.
