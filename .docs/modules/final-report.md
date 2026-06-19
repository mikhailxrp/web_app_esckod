# Модуль: Финальный отчёт (final-report)

> Спецификация финального отчёта: вопросы с radio-ответами, выбор «Обвинить / Защитить» внутри формы, серверная проверка, текст концовки по выбору игрока.
> Связанные файлы: `.docs/database.md` (модели `FinalReportQuestion`, `FinalReportContent`, `GameProgress`, `ChatState`), `constants/reportFinalChoices.ts`, `.docs/modules/logs.md` (шаблон `final_report_submitted`).

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Архитектурные решения](#архитектурные-решения)
3. [Триггер доступности](#триггер-доступности)
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
- На главном экране есть кнопка «Финальный отчёт» — заблокирована до завершения чата Детектива
- При `ChatState.detectiveFinished === true` — кнопка разблокируется
- Игрок открывает модалку отчёта, видит вопросы с radio-кнопками и выбор «Обвинить / Защитить»
- Сдаёт отчёт → сервер проверяет ответы на вопросы, считает процент правильных (выбор концовки на процент не влияет)
- Игрок видит результат + текст концовки, зависящий от `finalChoice` в теле `POST /submit` (`PROTECT` / `ACCUSE`)
- Повторная сдача отчёта **запрещена** — только просмотр результата
- При перезапуске игры всё сбрасывается (можно сдать заново)

**Не входит в модуль:**
- Тексты вопросов и концовок — заглушки в сидере, финальные от заказчика через админку
- Дизайн модалки — верстается на Tailwind по ходу фазы
- Админка для CRUD вопросов и контентов концовок — `admin.md`
- Расчёт баланса концовок (PROTECT/ACCUSE — нарративный выбор, не «правильный/неправильный»)

---

## Архитектурные решения

### 1. Одиночный триггер доступности

Финальный отчёт доступен, когда `ChatState.detectiveFinished === true` — игрок завершил чат Детектива.

**Почему именно так:**
- Сюжетная линия Детектива — естественная точка, после которой игрок готов к финальному отчёту
- Выбор «Обвинить / Защитить» перенесён в форму отчёта — не нужно ждать чат Марины
- Миссии и чат Марины **не блокируют** доступ к отчёту

### 2. Выбор концовки — внутри формы отчёта

Игрок выбирает «Обвинить» или «Защитить» radio-кнопками в модалке отчёта. Значения фиксированы в `constants/reportFinalChoices.ts` (`REPORT_FINAL_CHOICES`). Выбор передаётся в `POST /submit` как `finalChoice`.

**Не используется:** `ChatState.finalChoice` (legacy-поле в БД, миграция не планируется).

### 3. Процент — только по контрольным вопросам

`GameProgress.finalScore` считается исключительно по `FinalReportQuestion`. Выбор Обвинить/Защитить — нарративный, на процент не влияет.

### 4. `correctOption` НИКОГДА не возвращается клиенту

Поле `FinalReportQuestion.correctOption` — индекс правильного ответа (0..N-1). На клиенте — только `questionText` и `options` (массив строк). Проверка ответов — серверная.

**Атака без этой защиты:** игрок открывает DevTools → видит сетевой ответ с `correctOption` → выбирает правильные ответы → 100% результат без знания сюжета.

### 5. Текст концовки зависит от `finalChoice` в теле submit

После сдачи отчёта сервер ищет `FinalReportContent` по `finalChoiceValue === finalChoice` из тела запроса. Возвращает `title` + `bodyText` этой записи.

Возможные значения — UPPERCASE: `PROTECT`, `ACCUSE`. Источник правды — `REPORT_FINAL_CHOICES`.

### 6. Защита от повторной сдачи

После успешной сдачи `GameProgress.finalReportDone=true`. Эндпоинт `/submit` проверяет этот флаг — если уже `true`, возвращает 400. Просмотр результата — через отдельный `/result`.

### 7. Все 4 эндпоинта с разной семантикой

| Эндпоинт | Когда используется | Что возвращает |
|---|---|---|
| `GET /availability` | Постоянно — клиент проверяет, можно ли открыть отчёт | `{ available: bool, reasonsBlocked?: string[] }` |
| `GET /questions` | При открытии модалки отчёта | Массив вопросов БЕЗ `correctOption` |
| `POST /submit` | После заполнения всех вопросов | Результат + текст финала |
| `GET /result` | Просмотр уже сданного отчёта | Тот же результат, что вернул `/submit` |

Разделение `/submit` и `/result` — `/submit` пишет в БД, `/result` только читает. Клиент после первой сдачи всегда дёргает `/result`.

### 8. Запись результата в `GameProgress.finalScore`

`GameProgress.finalScore` — процент правильных ответов (0..100). Используется для:
- Отображения игроку при просмотре результата
- Опционально: статистика в админке (на старте не делаем)

---

## Триггер доступности

### `GET /api/final-report/availability`

**Auth:** Player only

**Алгоритм:**
```typescript
async function checkAvailability(userId: string) {
  const chatState = await prisma.chatState.findUnique({
    where: { userId },
    select: { detectiveFinished: true },
  });
  const detectiveDone = chatState?.detectiveFinished ?? false;

  const progress = await prisma.gameProgress.findUnique({
    where: { userId },
    select: { finalReportDone: true },
  });

  const reasonsBlocked: string[] = [];
  if (!detectiveDone) reasonsBlocked.push('DETECTIVE_NOT_FINISHED');

  return {
    available: detectiveDone,
    alreadySubmitted: progress?.finalReportDone ?? false,
    reasonsBlocked: reasonsBlocked.length ? reasonsBlocked : undefined,
  };
}
```

**Response 200 (доступен):**
```json
{ "available": true, "alreadySubmitted": false }
```

**Response 200 (недоступен — чат Детектива не завершён):**
```json
{
  "available": false,
  "alreadySubmitted": false,
  "reasonsBlocked": ["DETECTIVE_NOT_FINISHED"]
}
```

**Response 200 (уже сдан):**
```json
{ "available": false, "alreadySubmitted": true }
```

**Что НЕ возвращается:** детали прогресса чата. Клиент показывает общее сообщение «Завершите чат с Детективом».

---

## Серверная проверка ответов

### `POST /api/final-report/submit`

**Auth:** Player only

**Body (Zod):**
```typescript
import { REPORT_FINAL_CHOICES } from '@/constants/reportFinalChoices';

const reportFinalChoiceSchema = z.enum(
  REPORT_FINAL_CHOICES.map(c => c.value) as [string, ...string[]]
);

const submitSchema = z.object({
  finalChoice: reportFinalChoiceSchema,
  answers: z.array(z.object({
    questionId: z.string().cuid(),
    selectedOption: z.number().int().min(0),
    // Верхняя граница проверяется per-question на сервере (зависит от options.length)
  })).min(1),
  expectedVersion: z.number().int().min(0), // optimistic locking
});
```

**Алгоритм:**
```typescript
async function submitReport(userId: string, body: SubmitBody) {
  // 1. Проверка триггера доступности
  const availability = await checkAvailability(userId);
  if (!availability.available && !availability.alreadySubmitted) {
    return error(400, 'NOT_AVAILABLE', { reasons: availability.reasonsBlocked });
  }

  // 2. Защита от повторной сдачи
  if (availability.alreadySubmitted) {
    return error(400, 'ALREADY_SUBMITTED');
  }

  const { finalChoice, answers } = body;

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

  // 6. Получить контент концовки по выбору из тела запроса
  const content = await prisma.finalReportContent.findUnique({
    where: { finalChoiceValue: finalChoice },
  });
  if (!content) {
    return error(500, 'FINAL_CONTENT_MISSING', { finalChoice });
  }

  // 7. Транзакция: пометить отчёт сданным + сохранить выбор + лог
  // (механизм хранения finalChoice для /result — реализуется в Phase 17)
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
- `NOT_AVAILABLE` — триггер не выполнен (`detectiveFinished !== true`)
- `ALREADY_SUBMITTED` — отчёт уже сдан
- `INCOMPLETE_ANSWERS` — не все вопросы отвечены
- `INVALID_OPTION_INDEX` — `selectedOption` вышел за пределы `0..options.length-1` для конкретного вопроса
- `INVALID_FINAL_CHOICE` — `finalChoice` не из `REPORT_FINAL_CHOICES`

**Response 500:**
- `FINAL_CONTENT_MISSING` — для `finalChoice` нет соответствующего `FinalReportContent` (расхождение конфигурации)

---

## Соответствие с FinalReportContent

### Инвариант

Для каждого значения из `REPORT_FINAL_CHOICES` (`constants/reportFinalChoices.ts`) должна существовать запись `FinalReportContent` с `finalChoiceValue` = этому значению.

Стандартный набор: `ACCUSE`, `PROTECT`.

### Валидатор связности (используется админкой)

`GET /api/admin/report/validate` — реализация в `lib/final-report/validate.ts`.

```typescript
import { REPORT_FINAL_CHOICES } from '@/constants/reportFinalChoices';
import { prisma } from '@/lib/prisma';

export async function validateReportConfig() {
  const issues: string[] = [];
  const contents = await prisma.finalReportContent.findMany();
  const contentValues = new Set(contents.map(c => c.finalChoiceValue));
  const choiceValues = new Set(REPORT_FINAL_CHOICES.map(c => c.value));

  // Покрытие: для каждого value из REPORT_FINAL_CHOICES есть FinalReportContent
  for (const choice of REPORT_FINAL_CHOICES) {
    if (!contentValues.has(choice.value)) {
      issues.push(`MISSING_CONTENT:${choice.value}`);
    }
  }

  // Orphan: каждая запись FinalReportContent ссылается на известный choice
  for (const content of contents) {
    if (!choiceValues.has(content.finalChoiceValue)) {
      issues.push(`ORPHAN_CONTENT:${content.finalChoiceValue}`);
    }
  }

  // UPPERCASE-конвенция
  for (const content of contents) {
    if (content.finalChoiceValue !== content.finalChoiceValue.toUpperCase()) {
      issues.push(`NOT_UPPERCASE:${content.finalChoiceValue}`);
    }
  }

  return { isValid: issues.length === 0, issues };
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
  "issues": ["MISSING_CONTENT:ACCUSE", "ORPHAN_CONTENT:UNKNOWN"]
}
```

Админка показывает баннер-предупреждение в разделе `report`, если `isValid: false`. Это не блокирует работу админки, но гарантирует, что заказчик увидит проблему до запуска в прод.

См. `admin.md` → раздел report.

### UPPERCASE-конвенция

`finalChoiceValue` ВСЕГДА в верхнем регистре: `PROTECT`, `ACCUSE`. Должно совпадать:
- `value` в `REPORT_FINAL_CHOICES`
- `FinalReportContent.finalChoiceValue`
- `finalChoice` в теле `POST /submit`

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

  // finalChoice читается из сохранённого при submit значения (Phase 17)
  const savedFinalChoice = await getSavedFinalChoice(userId);
  if (!savedFinalChoice) {
    return error(500, 'NO_FINAL_CHOICE');
  }

  const content = await prisma.finalReportContent.findUnique({
    where: { finalChoiceValue: savedFinalChoice },
  });
  if (!content) {
    return error(500, 'FINAL_CONTENT_MISSING', { finalChoice: savedFinalChoice });
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
      <button disabled className="opacity-50" title="Завершите чат с Детективом">
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
- **Сдача отчёта:** список вопросов с radio-кнопками, блок выбора «Обвинить / Защитить» (`REPORT_FINAL_CHOICES`), кнопка «Сдать». При сабмите — `/submit` с `finalChoice` + `answers`, после ответа — переход к экрану результата.
- **Просмотр результата:** дёргает `/result`, показывает результат + текст концовки.

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
  const [finalChoice, setFinalChoice] = useState<string | null>(null);
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
      finalChoice,
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
              disabled={
                Object.keys(answers).length !== questions.length || finalChoice === null
              }
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
├── final-report/
│   ├── availability.ts                          # checkAvailability(userId)
│   └── validate.ts                              # validateReportConfig() — для админки

constants/
└── reportFinalChoices.ts                        # REPORT_FINAL_CHOICES — источник правды
```

---

## Серверные правила

1. **`correctOption` НИКОГДА не возвращается клиенту.** Поле явно исключено из `select` в `/questions`. Если разработчик случайно вернёт `select: { correctOption: true }` — это **критический баг**, ловится при ревью.

2. **Триггер доступности проверяется на сервере** в `/availability`, `/questions`, `/submit`. Клиент не может «обмануть» эндпоинты — все проверки серверные.

3. **`finalChoice` приходит в теле `POST /submit`**, не из `ChatState`. Zod-валидация против `REPORT_FINAL_CHOICES`.

4. **Процент считается только по `FinalReportQuestion`.** Выбор Обвинить/Защитить не влияет на `finalScore`.

5. **Защита от повторной сдачи** — через `GameProgress.finalReportDone`. После первой сдачи `/submit` возвращает `ALREADY_SUBMITTED`.

6. **Защита от неполных ответов** — `/submit` проверяет, что все `FinalReportQuestion` покрыты в `answers`. Если нет — `INCOMPLETE_ANSWERS`.

7. **Логирование результата** — пишется ОДИН лог `final_report_submitted` с процентом. Текст шаблона: `"Финальный отчёт сдан. Результат: {percent}%"`.

8. **При перезапуске игры** — `GameProgress.finalReportDone` и `finalScore` обнуляются (UPDATE на дефолты). Игрок может сдать заново. См. `restart.md`.

9. **`correctCount` в `/result` — приближённый**, рассчитывается обратно из процента. Это намеренное упрощение MVP. Если заказчик попросит точные цифры — нужно сохранять ответы игрока в `GameProgress.metadata`.

10. **Валидатор связности `/api/admin/report/validate`** — обязательный инструмент для админки. Сверяет `FinalReportContent` с `REPORT_FINAL_CHOICES` (без обращения к чату). Запускается:
    - При входе в админский раздел `report` (баннер-предупреждение)
    - После любого изменения `FinalReportContent`

11. **Никогда не возвращать клиенту:** `correctOption` в игровом API `/questions`. `/submit` принимает `expectedVersion` в теле, возвращает обновлённую `version` в ответе. При несовпадении — HTTP 409. Двойная защита: `version` + бизнес-флаг `finalReportDone` (запрет повторной отправки). См. `.docs/modules/concurrency.md`.

---

## Связи с другими модулями

- **`database.md`** — модели `FinalReportQuestion`, `FinalReportContent`, `GameProgress` описаны там; здесь только применение.
- **`concurrency.md`** — `/submit` использует optimistic locking. Поле `version` на `GameProgress` инкрементируется при UPDATE.
- **`constants/reportFinalChoices.ts`** — фиксированные значения и лейблы выбора Обвинить/Защитить.
- **`logs.md`** — используется шаблон `final_report_submitted` с параметром `percent`.
- **`chats.md`** — `ChatState.detectiveFinished` — триггер доступности отчёта. `ChatState.finalChoice` — legacy, не используется модулем отчёта.
- **`onboarding.md`** — кнопка «Финальный отчёт» имеет `data-onboarding-id` (если решим включить в онбординг — пока нет, см. `onboarding.md`).
- **`restart.md`** — UPDATE `GameProgress`: `finalReportDone=false`, `finalScore=null`. ChatState тоже обнуляется.
- **`admin.md`** — раздел report: CRUD вопросов, CRUD контентов концовок, валидатор связности.
