# Модуль: Глобальные настройки приложения (app-settings)

> Спецификация singleton-таблицы `AppSettings` и связанных эндпоинтов.
> Связанные файлы: `.docs/database.md` (модель AppSettings), `.docs/modules/auth.md` (использует `GET /api/settings/registration-defaults`).

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Архитектурные решения](#архитектурные-решения)
3. [Поля настроек](#поля-настроек)
4. [Публичный эндпоинт (для формы регистрации)](#публичный-эндпоинт-для-формы-регистрации)
5. [Админские эндпоинты](#админские-эндпоинты)
6. [UI-предупреждения в админке](#ui-предупреждения-в-админке)
7. [Файлы, которые создаются](#файлы-которые-создаются)
8. [Серверные правила](#серверные-правила)

---

## Цели модуля

После завершения этого модуля:
- Существует singleton-таблица `AppSettings` с настраиваемыми полями
- При первом деплое сидер создаёт ровно одну запись с дефолтами-заглушками
- Публичный эндпоинт `GET /api/settings/registration-defaults` отдаёт нужные поля для формы регистрации
- Админ через `/admin/settings` видит и редактирует `supportEmail`/`defaultMarketingConsent`/подсказки к формам запуска миссий (`crackLaunchHint`/`decipherLaunchHint`/`rdpLaunchHint`), а через отдельную страницу `/admin/privacy-policy` (Tiptap-редактор) — текст политики конфиденциальности (`privacyPolicyText`)
- Публичная страница `/privacy-policy` рендерит сохранённый текст политики для незалогиненных пользователей (ссылка с формы регистрации)
- Админка предупреждает о юридических рисках (`defaultMarketingConsent=true`) и о незаполненных продакшен-значениях

**Не входит в модуль:**
- Email-рассылки и редактирование текста писем (out of scope, см. PRD)
- Хранение per-slot настроек миссий (`hintText`, `folderPath` и т.д.) — это в `MissionSlot`. В `AppSettings` хранятся только `crackLaunchHint`/`decipherLaunchHint`/`rdpLaunchHint` — единый на весь тип миссии текст для окна запуска (`MissionModal`), которое ещё не знает, какой слот откроется
- Настройки рейтлимитов — захардкожены в `lib/rateLimit.ts`

---

## Архитектурные решения

### 1. Singleton — ровно одна запись

`AppSettings` — таблица, в которой **всегда ровно одна запись**. Не используем pattern «таблица из одной строки с фиксированным id», но защищаем инвариант на уровне сидера и API:
- Сидер при первом деплое делает `if (count === 0) create({...})`
- API на запись не имеет POST/DELETE — только PATCH существующей
- Получение настроек — всегда через `findFirst()`, не через `findUnique({ where: { id } })`

**Почему singleton, а не key-value таблица настроек:** при росте проекта проще добавить колонку в одну таблицу с типизацией, чем разбирать строки `{key: 'supportEmail', value: '...'}` без типов.

### 2. Разделение публичной и админской частей

| Аспект | Публичный эндпоинт | Админский эндпоинт |
|---|---|---|
| URL | `GET /api/settings/registration-defaults` | `GET/PATCH /api/admin/app-settings` |
| Auth | Public | Admin only |
| Поля в ответе | Только нужные форме регистрации | Все поля + метаданные (`updatedAt`) |
| Кэширование | Можно кэшировать на клиенте на сессию | Не кэшируется — админ должен видеть актуальное |

**Почему два эндпоинта, а не один:** публичный `/api/admin/*` — это утечка наружу. Лучше иметь явный «срез для регистрации», который не отдаёт лишнего.

### 3. Заглушки для разработки, валидация для прода

Сидер ставит заглушку email (`support@example.com`) и оставляет `privacyPolicyText` пустой строкой. Это:
- Позволяет разработке идти без блокировки
- Делает явным факт «это надо заполнить перед продом» — UI админки показывает баннер-предупреждение

Запрет деплоя в прод с заглушками **не реализуется на уровне приложения** — это операционная задача чек-листа перед релизом.

---

## Поля настроек

### `defaultMarketingConsent: Boolean`

**Что это:** дефолтное значение галки «Согласен на маркетинговые рассылки» в форме регистрации.

**Дефолт:** `false`

**Юридический контекст:**
- Закон 152-ФЗ (РФ, ст. 9) и GDPR (ЕС, ст. 7) требуют **активный opt-in** для маркетинговых коммуникаций. Предзаполненная галка считается невалидным согласием.
- Заказчик может изменить на `true` через админку. UI обязан показать предупреждение об ответственности.
- Поле сохраняется в `User.consentMarketing` ровно тем значением, которое прислал клиент при регистрации.

**Где используется:** клиент дёргает `GET /api/settings/registration-defaults` при загрузке страницы регистрации, использует это значение как `defaultChecked` галки.

---

### `supportEmail: String`

**Что это:** email техподдержки.

**Дефолт:** `"support@example.com"` (заглушка)

**Где используется:**
- В сообщениях об ошибках регистрации (неверный ключ, лимит активаций, заблокированный ключ)
- В сообщениях об ошибках логина (заблокированный аккаунт)
- На странице 500/Error (если будет)

**Формат:** валидный email. Валидация на сервере через Zod при PATCH.

---

### `privacyPolicyText: String`

**Что это:** HTML-текст страницы политики обработки персональных данных, редактируемый через Tiptap-редактор на `/admin/privacy-policy`. Рендерится на публичной странице `/privacy-policy`, ссылка на которую открывается рядом с обязательной галкой согласия в форме регистрации.

**Дефолт:** `""` (не заполнено)

**Юридический контекст:**
- Без заполненного текста регистрация юридически не валидна (152-ФЗ ст. 9 ч. 4: согласие должно быть конкретным, информированным).
- Админка показывает **постоянный баннер-предупреждение**, пока поле пустое.

**Формат:** HTML, генерируемый `editor.getHTML()` (Tiptap `StarterKit`: заголовки, списки, цитаты, ссылки, форматирование текста). Валидация на сервере через Zod при PATCH — принимается любая непустая строка (санитизация не требуется, поле редактируется только админом через контролируемый редактор, а не произвольным HTML с клиента).

**Редактируется НЕ на `/admin/settings`** — у поля отдельная страница `/admin/privacy-policy`, так как это content-редактирование, а не конфигурационное значение.

---

### `crackLaunchHint` / `decipherLaunchHint` / `rdpLaunchHint`: String

**Что это:** текст подсказки, который показывается по значку «i» (`MissionInstructionButton`) в заголовке `MissionModal` — форме, открывающейся по кнопке «Открыть» на плашке миссии, **до** её запуска.

**Дефолт:** `""` (не заполнено — значок «i» скрыт, `MissionInstructionButton` возвращает `null`)

**Почему один текст на весь тип миссии, а не per-slot:** `MissionModal` знает только `missionType` (`CRACK` / `DECIPHER` / `RDP`) — конкретный `MissionSlot` сервер определяет только после отправки формы (по совпадению `folderPath`/`targetUrl`+`targetEmail`/IP). На момент показа модалки слот ещё не выбран, поэтому per-slot текст здесь невозможен — в отличие от `MissionSlot.hintText`, который показывается уже во время игры через `CrackHintButton`/`DecipherHintButton`/`RdpHintButton`.

**Формат:** обычный текст (`ParagraphText` внутри `HintTooltip` рендерит абзацы по `\n\n`, без HTML — в отличие от `privacyPolicyText`).

**Редактируется на `/admin/settings`** — три `textarea` рядом с `supportEmail`, отправляются тем же `PATCH /api/admin/app-settings`.

---

## Публичный эндпоинт (для формы регистрации)

### `GET /api/settings/registration-defaults`

**Auth:** Public (страница регистрации доступна неавторизованным)

**Rate limit:** не нужен (отдаёт публичную информацию, обновляется редко). Если позже понадобится — добавить 60/мин на IP.

**Алгоритм:**
```typescript
// app/api/settings/registration-defaults/route.ts
export async function GET() {
  const settings = await prisma.appSettings.findFirst();

  if (!settings) {
    // Защита: если сидер не отработал — возвращаем безопасные дефолты
    return Response.json({
      defaultMarketingConsent: false,
      supportEmail: 'support@example.com',
    });
  }

  return Response.json({
    defaultMarketingConsent: settings.defaultMarketingConsent,
    supportEmail: settings.supportEmail,
  });
}
```

**Response 200:**
```json
{
  "defaultMarketingConsent": false,
  "supportEmail": "support@example.com"
}
```

`privacyPolicyText` этому эндпоинту не нужен — форма регистрации ссылается на статичный роут `/privacy-policy`, который сам читает `AppSettings` на сервере.

**Что НЕ возвращается:**
- `id`, `createdAt`, `updatedAt` — внутренние поля, нет необходимости их публиковать

---

## Админские эндпоинты

### `GET /api/admin/app-settings`

**Auth:** Admin only (`session.user.type === 'ADMIN'`)

**Алгоритм:**
```typescript
export async function GET() {
  const session = await auth();
  if (!session || session.user.type !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const settings = await prisma.appSettings.findFirst();
  if (!settings) {
    return Response.json({ error: 'Settings not initialized' }, { status: 500 });
  }

  return Response.json(settings);
}
```

**Response 200:**
```json
{
  "id": "clx...",
  "defaultMarketingConsent": false,
  "supportEmail": "support@example.com",
  "privacyPolicyText": "<p>...</p>",
  "createdAt": "2026-05-01T10:00:00.000Z",
  "updatedAt": "2026-05-08T14:30:00.000Z"
}
```

**Response 500 (если запись не существует):**
```json
{ "error": "Settings not initialized" }
```

В норме это не должно происходить — сидер всегда создаёт запись. Если возникает — это баг сидера или ручное удаление записи.

---

### `PATCH /api/admin/app-settings`

**Auth:** Admin only

**Body (Zod-схема):**
```typescript
const updateSettingsSchema = z.object({
  defaultMarketingConsent: z.boolean().optional(),
  supportEmail: z.string().email().optional(),
  privacyPolicyText: z.string().optional(),
  crackLaunchHint: z.string().optional(),
  decipherLaunchHint: z.string().optional(),
  rdpLaunchHint: z.string().optional(),
});
```

Все поля опциональны — клиент может прислать только то, что меняет. `AppSettingsForm` (`/admin/settings`) шлёт `supportEmail`/`defaultMarketingConsent`/`crackLaunchHint`/`decipherLaunchHint`/`rdpLaunchHint`; `PrivacyPolicyEditorForm` (`/admin/privacy-policy`) шлёт только `privacyPolicyText` — оба используют один и тот же `PATCH`-эндпоинт с частичным телом.

**Алгоритм:**
```typescript
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.type !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await prisma.appSettings.findFirst();
  if (!settings) {
    return Response.json({ error: 'Settings not initialized' }, { status: 500 });
  }

  const updated = await prisma.appSettings.update({
    where: { id: settings.id },
    data: parsed.data,
  });

  return Response.json(updated);
}
```

**Response 200:** обновлённый объект (как в GET).

**Response 400:** если Zod не прошёл (невалидный email).

---

## UI-предупреждения в админке

### 1. Предупреждение при `defaultMarketingConsent === true`

Когда админ меняет галку на `true` и пытается сохранить — показать модалку:

> ⚠️ **Внимание: юридический риск**
>
> Предзаполненная галка согласия на маркетинг может нарушать закон 152-ФЗ (РФ) и GDPR (ЕС), которые требуют **активный opt-in**.
>
> Если вы продолжите, ответственность за соответствие законодательству лежит на вашей стороне.
>
> [Отмена] [Я понимаю и сохраняю]

### 2. Баннеры при незаполненных значениях

Два независимых источника, оба реализованы в `AdminBanners` (Server Component, виден во всём сайдбаре админки — не только на странице настроек):
- `supportEmail` содержит подстроку `example.com` → баннер со ссылкой на `/admin/settings`
- `privacyPolicyText` пустая строка → баннер со ссылкой на `/admin/privacy-policy`

Плюс `PlaceholderWarningBanner` (Client Component, только на `/admin/settings`) дублирует проверку `supportEmail` прямо над формой, с учётом live-значения из `watch()`.

Без заполненного текста политики регистрация юридически не валидна (152-ФЗ ст. 9 ч. 4).

---

## Файлы, которые создаются

```
app/
├── (admin)/
│   └── admin/
│       ├── settings/
│       │   └── page.tsx                      # Server Component, рендер AppSettingsForm
│       └── privacy-policy/
│           └── page.tsx                      # Server Component, рендер PrivacyPolicyEditorForm
├── (auth)/
│   └── privacy-policy/
│       └── page.tsx                          # Server Component, публичный рендер текста политики
├── api/
│   ├── settings/
│   │   └── registration-defaults/
│   │       └── route.ts                      # GET (Public)
│   └── admin/
│       └── app-settings/
│           └── route.ts                      # GET, PATCH (Admin)

components/
├── admin/
│   ├── app-settings/
│   │   ├── AppSettingsForm.tsx               # Client Component, форма редактирования (+ 3 textarea launch-hint полей)
│   │   ├── PlaceholderWarningBanner.tsx      # Client Component, баннер про заглушку email
│   │   └── MarketingConsentWarningModal.tsx  # Client Component, модалка про юр.риск
│   └── privacy-policy/
│       ├── PrivacyPolicyEditorForm.tsx       # Client Component, Tiptap-редактор + сохранение
│       └── EditorToolbar.tsx                 # Client Component, панель форматирования Tiptap
└── game/
    ├── MissionInstructionButton.tsx          # Client Component, значок «i» + HintTooltip в MissionModal (использует crackLaunchHint/decipherLaunchHint/rdpLaunchHint)
    └── ui/
        └── HintTooltip.tsx                   # переиспользуется из существующих CrackHintButton/DecipherHintButton/RdpHintButton

lib/
└── validations/
    └── app-settings.ts                       # Zod schema: updateSettingsSchema
```

`.tiptap-content` — общий CSS-класс в `app/globals.css`, стилизует и зону редактора (`/admin/privacy-policy`), и публичный рендер (`/privacy-policy`), чтобы WYSIWYG совпадал с итоговым видом.

---

## Серверные правила

1. **Запрет на удаление singleton:** в API нет `DELETE /api/admin/app-settings`. Если запись каким-то образом удалена (ручной SQL) — `GET` возвращает 500, что заметит админ при заходе.

2. **Запрет на создание дубликатов:** в API нет `POST /api/admin/app-settings`. Запись создаёт только сидер при первом деплое.

3. **Сидер идемпотентен:**
   ```typescript
   // prisma/seed.ts (фрагмент)
   const existing = await prisma.appSettings.count();
   if (existing === 0) {
     await prisma.appSettings.create({
       data: {
         defaultMarketingConsent: false,
         supportEmail: 'support@example.com',
         privacyPolicyText: '',
       }
     });
   }
   ```
   При повторном запуске — пропуск (не пересоздаёт, не перезаписывает).

4. **Валидация при PATCH:** обязательна на сервере через Zod. Клиент тоже валидирует через `react-hook-form + zod`, но сервер — последний рубеж.

5. **Аудит изменений (опционально):** при PATCH можно записывать в `AdminAuditLog`:
   ```typescript
   type: 'app_settings_updated',
   adminId: session.user.id,
   message: `Админ ${session.user.email} изменил настройки`,
   metadata: { changes: parsed.data }
   ```
   **На старте не делаем** — добавим позже, если возникнет потребность для отладки.

6. **Никогда не возвращать публичному эндпоинту:** `id`, `createdAt`, `updatedAt`. Это внутренние поля админки.

---

## Связи с другими модулями

- **`auth.md`** — публичный эндпоинт `GET /api/settings/registration-defaults` используется в форме регистрации (`/register`) и в логике auth (тексты ошибок с `supportEmail`). Ссылка согласия на политику ведёт на статичный `/privacy-policy`, а не на значение из этого эндпоинта.
- **`admin.md`** — общий обзор админки, страницы `/admin/settings` и `/admin/privacy-policy` входят в общую навигацию админки.
- **`database.md`** — модель `AppSettings` и сидер описаны там, здесь только применение.
