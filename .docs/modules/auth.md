# Модуль: Авторизация и доступ (auth)

> Спецификация модуля авторизации, регистрации, восстановления пароля и защиты роутов.
> Связанные файлы: `.docs/database.md` (модели User, AccessKey, AdminUser, AppSettings), `.docs/modules/app-settings.md`.

---

## Содержание

1. [Цели модуля](#цели-модуля)
2. [Архитектурные решения](#архитектурные-решения)
3. [Регистрация игрока](#регистрация-игрока)
4. [Логин игрока](#логин-игрока)
5. [Логин администратора](#логин-администратора)
6. [Восстановление пароля (reset)](#восстановление-пароля-reset)
7. [Логаут](#логаут)
8. [Защита роутов (proxy.ts)](#защита-роутов-proxyts)
9. [Rate limiting](#rate-limiting)
10. [API-эндпоинты](#api-эндпоинты)
11. [Файлы, которые создаются](#файлы-которые-создаются)
12. [Серверные правила безопасности](#серверные-правила-безопасности)

---

## Цели модуля

После завершения этого модуля:

- Игрок может зарегистрироваться по уникальному ключу из коробки
- Получает сгенерированный пароль на email
- Может залогиниться, выйти, восстановить пароль
- Сессия живёт 24 часа
- Администратор имеет отдельный изолированный логин на `/admin-login`
- Защищённые роуты (`/dashboard`, `/admin/*`) недоступны без сессии
- Все публичные эндпоинты защищены rate limiting
- Заблокированные ключи и игроки не могут войти

**Не входит в модуль:**

- UI dashboard и админки (это в других модулях)
- Email-рассылки и редактирование текста писем — out of scope (закрыто с заказчиком). См. PRD → Out of Scope.
- Тексты системных писем (генерация пароля при регистрации, новый пароль при reset) — захардкожены в `lib/resend.ts`. Изменение текстов = изменение кода + новый деплой.
- OAuth (Google/GitHub) — out of scope
- 2FA — out of scope

---

## Архитектурные решения

### 1. Auth.js v5 (next-auth@5), credentials provider

Используем Auth.js v5 (бывший NextAuth.js v5, на npm — пакет `next-auth` версии 5+) с двумя credentials-провайдерами: `player` и `admin`. Они **полностью изолированы** — не могут смешиваться:

- Разные таблицы (`User` vs `AdminUser`)
- Разные `authorize()` функции
- Разные имена провайдеров (передаются в `signIn()`)

В session-callback пишется `session.user.type: 'PLAYER' | 'ADMIN'`. По нему `proxy.ts` решает, куда пускать.

**Почему именно v5, а не v4:**

- Next.js 16 + App Router официально поддерживается только в v5
- v5 даёт функцию `auth()` (универсальная замена `getServerSession(authOptions)` из v4) — её можно использовать в Server Components, Route Handlers и `proxy.ts` единообразно
- v5 экспортирует `handlers`, `signIn`, `signOut`, `auth` из единой `lib/auth.ts` — структура кода чище

**Почему не Server Actions для логина:** для соответствия общей архитектуре проекта (REST API Routes для всей игровой логики). Auth.js v5 кладёт свой handler в `app/api/auth/[...nextauth]/route.ts` — это и есть REST API.

### 2. Сессия 24 часа

```typescript
// lib/auth.ts (фрагмент)
session: {
  strategy: 'jwt',
  maxAge: 24 * 60 * 60, // 24 часа в секундах
}
```

JWT-стратегия (а не database session), потому что:

- Не требует таблицы `Session` в БД
- Меньше запросов к БД на каждый защищённый запрос
- Простой rotate через переустановление `AUTH_SECRET` (если будет компрометация)

### Структура `lib/auth.ts` (Auth.js v5)

В Auth.js v5 конфигурация и handlers экспортируются из одного файла. Шаблон:

```typescript
// lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 часа
  },
  providers: [
    Credentials({
      id: "player",
      // ... (см. ниже раздел "Логин игрока")
    }),
    Credentials({
      id: "admin",
      // ... (см. ниже раздел "Логин администратора")
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      /* ... */
    },
    async session({ session, token }) {
      /* ... */
    },
  },
});
```

Дальше в `app/api/auth/[...nextauth]/route.ts`:

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

В защищённых эндпоинтах и Server Components:

```typescript
import { auth } from "@/lib/auth";

const session = await auth();
if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
```

В `proxy.ts`:

```typescript
import { auth } from "@/lib/auth";

export const proxy = auth((req) => {
  // req.auth содержит сессию
});
```

> **Внимание:** в v4 использовалась `getServerSession(authOptions)` из `next-auth`. В v5 такой функции нет — везде только `auth()`. При копировании старых примеров кода из туториалов про v4 — переписывать.

### 3. Пароли

- Plain пароли **никогда** не хранятся в БД
- При регистрации — генерируется случайный 12-символьный пароль (`lib/password.ts: generatePassword()`)
- Хэширование — bcrypt с round=10
- Plain пароль отправляется на email через Resend и больше нигде не сохраняется

### 4. Защита от enumeration attack на reset-password

Эндпоинт `POST /api/auth/reset-password` **всегда возвращает одинаковый ответ** — независимо от того, существует ли email в БД:

```json
{
  "success": true,
  "message": "Если такой email зарегистрирован, на него отправлено письмо с новым паролем"
}
```

Это блокирует атаку «проверим, какие email зарегистрированы, перебирая через эндпоинт восстановления».

### 5. Изоляция админа

- Отдельный URL логина: `/admin-login` (а не `/login` с переключателем — не даём подсказок атакующему)
- Отдельная таблица `AdminUser`
- Отдельный credentials provider в Auth.js v5: имя `admin`
- В `proxy.ts` отдельная ветка проверки `session.user.type === 'ADMIN'`
- Игрок, попавший на `/admin/*` — редирект на `/dashboard`. Админ, попавший на `/dashboard` — редирект на `/admin`.

---

## Регистрация игрока

### Флоу со стороны пользователя

1. Заходит на `/register`
2. Видит форму:
   - Имя (латиница или кириллица + цифры + `_`, ≥3 символа)
   - Email
   - Ключ доступа (из коробки)
   - **Обязательная** галка: согласие на обработку персональных данных (с ссылкой из `AppSettings.privacyPolicyUrl`)
   - **Необязательная** галка: согласие на маркетинговые рассылки (дефолт берётся из `AppSettings.defaultMarketingConsent`)
3. Клиент при загрузке страницы дёргает `GET /api/settings/registration-defaults` и получает `{ defaultMarketingConsent, supportEmail, privacyPolicyUrl }`
4. Заполняет форму, нажимает «Зарегистрироваться»
5. **Возможные ответы:**
   - Успех: страница «Проверьте почту, мы прислали пароль» → редирект на `/login` через 5 секунд
   - Ключ невалиден / заблокирован / лимит активаций исчерпан: ошибка с инструкцией обратиться на `supportEmail`
   - Email уже зарегистрирован: ошибка «Этот email уже зарегистрирован» → ссылка на `/reset-password`
   - Невалидные данные: подсветка полей с ошибкой

### Флоу со стороны сервера

`POST /api/auth/register`

**Тело запроса (Zod-схема):**

```typescript
const registerSchema = z.object({
  name: z
    .string()
    .regex(
      /^[a-zA-Zа-яА-ЯёЁ0-9_]+$/,
      "Имя может содержать только буквы (русские или латинские), цифры и знак подчёркивания"
    )
    .min(3),
  email: z.string().email().toLowerCase().trim(),
  accessKey: z.string().min(1).trim(),
  consentPolicy: z.literal(true, {
    errorMap: () => ({ message: "Согласие обязательно" }),
  }),
  consentMarketing: z.boolean(),
});
```

**Алгоритм:**

```typescript
// 1. Валидация Zod
const data = registerSchema.parse(await req.json());

// 2. Найти ключ
const key = await prisma.accessKey.findUnique({ where: { key: data.accessKey } });
if (!key) return 400 'INVALID_KEY';
if (key.isBlocked) return 400 'KEY_BLOCKED';
if (key.currentActivations >= key.maxActivations) return 400 'ACTIVATIONS_EXCEEDED';

// 3. Email уникальность
const existing = await prisma.user.findUnique({ where: { email: data.email } });
if (existing) return 400 'EMAIL_EXISTS';

// 4. Генерация пароля + хэш
const plainPassword = generatePassword(12);
const passwordHash = await bcrypt.hash(plainPassword, 10);

// 5. Транзакция (см. database.md → Критичные транзакции)
try {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        accessKeyId: key.id,
        consentPolicy: true,
        consentMarketing: data.consentMarketing,
      }
    });

    await tx.gameProgress.create({ data: { userId: user.id } });
    await tx.chatState.create({ data: { userId: user.id } });

    // Защита от race condition
    // key.maxActivations — из объекта, загруженного ДО транзакции (шаг 2).
    // Атомарность: если параллельный запрос уже инкрементировал счётчик,
    // WHERE-условие не выполнится → updated.count === 0 → ROLLBACK.
    const updated = await tx.accessKey.updateMany({
      where: {
        id: key.id,
        currentActivations: { lt: key.maxActivations }
      },
      data: { currentActivations: { increment: 1 } }
    });

    if (updated.count === 0) {
      throw new Error('ACTIVATIONS_EXCEEDED'); // откат транзакции
    }
  });
} catch (e) {
  if (e instanceof Error && e.message === 'ACTIVATIONS_EXCEEDED') return 400 'ACTIVATIONS_EXCEEDED';
  throw e;
}

// 6. Отправка письма (вне транзакции — не блокирует регистрацию при сбое Resend)
try {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: data.email,
    subject: 'Код доступа: корпорация — ваш пароль',
    html: `<p>Здравствуйте!</p><p>Ваш пароль: <strong>${plainPassword}</strong></p>...`
  });
} catch (e) {
  // Логируем, но НЕ откатываем регистрацию
  console.error('Email send failed:', e);
  // Возвращаем успех, но с флагом
  return 200 { success: true, emailSent: false, message: 'Регистрация успешна, но письмо не отправлено. Используйте «Восстановить пароль».' };
}

return 200 { success: true, emailSent: true };
```

**Тексты ошибок** (на клиент возвращаются коды + локализованные сообщения):

| Код                    | Сообщение пользователю                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `INVALID_KEY`          | "Ключ доступа не найден. Проверьте написание или обратитесь в поддержку: {supportEmail}" |
| `KEY_BLOCKED`          | "Ключ заблокирован. Обратитесь в поддержку: {supportEmail}"                              |
| `ACTIVATIONS_EXCEEDED` | "По этому ключу уже зарегистрировано максимальное число пользователей"                   |
| `EMAIL_EXISTS`         | "Этот email уже зарегистрирован. Восстановить пароль?"                                   |
| `VALIDATION_ERROR`     | "Проверьте правильность введённых данных"                                                |

`{supportEmail}` подставляется на клиенте из `GET /api/settings/registration-defaults`.

---

## Логин игрока

### Флоу со стороны пользователя

1. Заходит на `/login`
2. Видит форму: email + пароль
3. Заполняет, нажимает «Войти»
4. **Возможные ответы:**
   - Успех → редирект на `/dashboard`
   - Неверный пароль или email → "Неверный email или пароль"
   - Заблокирован (`User.isBlocked` или `AccessKey.isBlocked`) → "Ваш аккаунт заблокирован. Обратитесь в поддержку"

### Флоу со стороны сервера

Используется `signIn('player', { email, password, redirect: false })` из `next-auth/react` на клиенте → попадает в `authorize()` провайдера `player` в `lib/auth.ts`.

```typescript
// lib/auth.ts (фрагмент)
Credentials({
  id: "player",
  name: "Player",
  credentials: {
    email: { type: "email" },
    password: { type: "password" },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) return null;

    const user = await prisma.user.findUnique({
      where: { email: credentials.email.toLowerCase().trim() },
      include: { accessKey: true },
    });

    if (!user) return null;
    if (user.isBlocked) throw new Error("USER_BLOCKED");
    if (user.accessKey.isBlocked) throw new Error("KEY_BLOCKED");

    const valid = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!valid) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      type: "PLAYER",
    };
  },
});
```

**Session callback:**

```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.type = user.type;
    }
    return token;
  },
  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id;
      session.user.type = token.type;
    }
    return session;
  }
}
```

**Типизация сессии** (`types/next-auth.d.ts`):

```typescript
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      type: "PLAYER" | "ADMIN";
    };
  }
}
```

---

## Логин администратора

Полностью аналогично игроку, но:

- URL: `/admin-login`
- Провайдер: `signIn('admin', ...)`
- Таблица: `AdminUser`
- При успехе — обновляется `AdminUser.lastLoginAt`
- Редирект после успеха: `/admin`

```typescript
// lib/auth.ts (второй провайдер)
Credentials({
  id: "admin",
  name: "Admin",
  credentials: {
    /* ... */
  },
  async authorize(credentials) {
    const admin = await prisma.adminUser.findUnique({
      where: { email: credentials.email.toLowerCase().trim() },
    });
    if (!admin) return null;

    const valid = await bcrypt.compare(
      credentials.password,
      admin.passwordHash,
    );
    if (!valid) return null;

    // Обновляем lastLoginAt
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      id: admin.id,
      email: admin.email,
      name: "Admin",
      type: "ADMIN",
    };
  },
});
```

**Изоляция:** игрок, прошедший через провайдер `player`, никогда не получит `type: 'ADMIN'`. Админ через `admin` — никогда не получит `type: 'PLAYER'`. Это не зависит от значения email — два провайдера полностью изолированы.

---

## Восстановление пароля (reset)

### Флоу со стороны пользователя

1. На `/login` нажимает «Забыли пароль?»
2. Попадает на `/reset-password`, видит форму с одним полем: email
3. Вводит email, отправляет
4. Видит универсальное сообщение: "Если такой email зарегистрирован, на него отправлено письмо с новым паролем"
5. **Если email существует** — получает на почту новый сгенерированный пароль
6. **Если не существует** — ничего не происходит, но видит то же сообщение (защита от enumeration)

### Флоу со стороны сервера

`POST /api/auth/reset-password`

**Тело запроса:**

```typescript
const resetSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});
```

**Алгоритм:**

```typescript
const { email } = resetSchema.parse(await req.json());

const user = await prisma.user.findUnique({ where: { email } });

// Защита от enumeration: всегда одинаковый ответ
if (!user || user.isBlocked) {
  return 200 { success: true };
}

// Генерируем новый пароль
const newPassword = generatePassword(12);
const passwordHash = await bcrypt.hash(newPassword, 10);

await prisma.user.update({
  where: { id: user.id },
  data: { passwordHash }
});

// Письмо
try {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: user.email,
    subject: 'Код доступа: корпорация — новый пароль',
    html: `<p>Ваш новый пароль: <strong>${newPassword}</strong></p>...`
  });
} catch (e) {
  console.error('Reset email failed:', e);
  // Всё равно возвращаем 200 (защита от enumeration через тайминг ошибок)
}

return 200 { success: true };
```

**Важно:** ответ возвращается за примерно одинаковое время для существующих и несуществующих email. Если хотим максимальную защиту — добавляем фейковый bcrypt.compare для несуществующих email (выравнивание времени ответа). Пока не делаем — для нашего проекта (3000 коробок, не банк) это избыточно.

---

## Логаут

```typescript
// На клиенте
import { signOut } from "next-auth/react";

const handleLogout = async () => {
  await signOut({ redirect: true, callbackUrl: "/login" });
};
```

Auth.js v5 сам очищает сессионную cookie. Никакой кастомной серверной логики не нужно.

> **Альтернатива на сервере (Auth.js v5):** в Server Actions или Server Components можно использовать `signOut()` импортированный из `@/lib/auth`:
>
> ```typescript
> import { signOut } from "@/lib/auth";
> await signOut({ redirectTo: "/login" });
> ```
>
> Для клиентского компонента (форма с кнопкой) — `signOut` из `next-auth/react`, как в примере выше.

Для админа — `callbackUrl: '/admin-login'`.

---

## Защита роутов (proxy.ts)

```typescript
// proxy.ts (Next.js 16+ — раньше middleware.ts)
// Auth.js v5: оборачиваем функцию через `auth` — req.auth уже содержит сессию
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const proxy = auth((req) => {
  const session = req.auth;
  const { pathname } = req.nextUrl;

  // Игровая зона — только PLAYER
  if (pathname.startsWith("/dashboard")) {
    if (!session) return NextResponse.redirect(new URL("/login", req.url));
    if (session.user.type !== "PLAYER")
      return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Админская зона — только ADMIN (кроме /admin-login)
  if (pathname.startsWith("/admin") && pathname !== "/admin-login") {
    if (!session)
      return NextResponse.redirect(new URL("/admin-login", req.url));
    if (session.user.type !== "ADMIN")
      return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
```

**Дополнительная защита внутри API-эндпоинтов:**

```typescript
// app/api/<любой защищённый>/route.ts
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.type !== "PLAYER")
    return Response.json({ error: "Forbidden" }, { status: 403 });
  // ... основная логика
}
```

`proxy.ts` защищает страницы. API-эндпоинты защищаются отдельно — потому что их могут дёргать напрямую через DevTools/curl, минуя страницы.

---

## Rate limiting

### Эндпоинты, требующие rate limiting

| Эндпоинт                                         | Лимит                 | Ключ лимита | Зачем                               |
| ------------------------------------------------ | --------------------- | ----------- | ----------------------------------- |
| `POST /api/auth/register`                        | 5 запросов / 10 минут | IP          | Защита от перебора ключей           |
| `POST /api/auth/reset-password`                  | 3 запроса / 10 минут  | IP + email  | Защита от спама писем + enumeration |
| `POST /api/auth/callback/credentials` (signIn) | 10 запросов / минуту | IP | Защита от brute force паролей — **реализуется через Nginx** в Фазе 0.5, НЕ через `lib/rateLimit.ts` (Auth.js v5 handler нельзя обернуть rate limiter'ом без переписывания internals) |

### Реализация

Используем **in-memory rate limiter** на старте (`lib/rateLimit.ts`):

```typescript
// lib/rateLimit.ts
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true; // OK
  }

  if (bucket.count >= max) return false; // лимит исчерпан

  bucket.count++;
  return true;
}

// Очистка устаревших раз в 5 минут
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
  },
  5 * 60 * 1000,
);
```

**Ограничения in-memory:**

- Сбрасывается при рестарте процесса PM2
- Не работает в multi-instance деплое

- НЕ применяется к `POST /api/auth/callback/credentials` (signIn) — для этого эндпоинта rate limit на уровне Nginx

Для нашей нагрузки (3000 пользователей за всю жизнь, single-instance на Beget) этого достаточно. Если понадобится — миграция на Upstash Ratelimit без изменения сигнатуры функции.

### Получение IP

В `proxy.ts` или route handler:

```typescript
const ip =
  request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
  request.headers.get("x-real-ip") ||
  "unknown";
```

В Nginx конфиге обязательно прокидывать `X-Forwarded-For` и `X-Real-IP`.

---

## API-эндпоинты

| Метод | Путь                                  | Назначение                                 | Auth   | Rate limit             |
| ----- | ------------------------------------- | ------------------------------------------ | ------ | ---------------------- |
| POST  | `/api/auth/register`                  | Регистрация                                | Public | 5 / 10 мин на IP       |
| POST  | `/api/auth/[...nextauth]`             | Auth.js v5 handler (signIn/signOut/callback) | Public | 10 / мин на IP (Nginx, Фаза 0.5) |
| GET   | `/api/auth/[...nextauth]`             | Auth.js v5 handler (session)                 | Public | —                      |
| POST  | `/api/auth/reset-password`            | Восстановление пароля                      | Public | 3 / 10 мин на IP+email |
| GET   | `/api/settings/registration-defaults` | Дефолты для формы регистрации              | Public | —                      |

### Спецификации запросов/ответов

#### `POST /api/auth/register`

**Request:**

```json
{
  "name": "victor_user",
  "email": "victor@example.com",
  "accessKey": "ABC-123-XYZ",
  "consentPolicy": true,
  "consentMarketing": false
}
```

**Response 200 (успех):**

```json
{ "success": true, "emailSent": true }
```

**Response 200 (успех, но письмо не ушло):**

```json
{
  "success": true,
  "emailSent": false,
  "message": "Регистрация успешна, но письмо не отправлено. Используйте «Восстановить пароль»."
}
```

**Response 400 (ошибка):**

```json
{ "success": false, "error": "INVALID_KEY" | "KEY_BLOCKED" | "ACTIVATIONS_EXCEEDED" | "EMAIL_EXISTS" | "VALIDATION_ERROR" }
```

**Response 429 (rate limit):**

```json
{ "success": false, "error": "RATE_LIMIT_EXCEEDED" }
```

---

#### `POST /api/auth/reset-password`

**Request:**

```json
{ "email": "victor@example.com" }
```

**Response 200 (всегда, независимо от существования email):**

```json
{ "success": true }
```

**Response 429:**

```json
{ "success": false, "error": "RATE_LIMIT_EXCEEDED" }
```

---

#### `GET /api/settings/registration-defaults`

**Response 200:**

```json
{
  "defaultMarketingConsent": false,
  "supportEmail": "support@example.com",
  "privacyPolicyUrl": "https://example.com/privacy"
}
```

Public-эндпоинт. Используется страницей регистрации для дефолтов формы и страницей логина для ссылки на политику. Кэшируется на клиенте на сессию (не хранится в БД-кэше — `AppSettings` маленькая, нагрузка минимальная).

---

## Файлы, которые создаются

```
app/
├── (auth)/
│   ├── login/page.tsx                    # Server Component, форма логина игрока
│   ├── register/page.tsx                 # Server Component, форма регистрации
│   ├── reset-password/page.tsx           # Server Component, форма reset
│   └── admin-login/page.tsx              # Server Component, форма логина админа
├── api/
│   ├── auth/
│   │   ├── [...nextauth]/route.ts        # Auth.js v5 handler (GET/POST из { handlers })
│   │   ├── register/route.ts             # POST: регистрация
│   │   └── reset-password/route.ts       # POST: восстановление пароля
│   └── settings/
│       └── registration-defaults/route.ts  # GET: дефолты для формы регистрации

components/
└── auth/
    ├── LoginForm.tsx                     # Client Component, форма игрока
    ├── RegisterForm.tsx                  # Client Component, форма регистрации
    ├── ResetPasswordForm.tsx             # Client Component, форма reset
    └── AdminLoginForm.tsx                # Client Component, форма админа

lib/
├── auth.ts                               # Auth.js v5 конфиг + экспорт { handlers, signIn, signOut, auth }
├── password.ts                           # generatePassword(length), hashPassword(plain), comparePassword(plain, hash)
├── resend.ts                             # Resend client + sendPasswordEmail() + sendPasswordResetEmail()
├── rateLimit.ts                          # in-memory rate limiter
└── validations/
    └── auth.ts                           # Zod schemas: registerSchema, resetSchema

types/
└── next-auth.d.ts                        # Расширение Session типа

proxy.ts                                  # Защита /dashboard и /admin/*
```

---

## Серверные правила безопасности

1. **Никогда не возвращать клиенту:**
   - Plain пароль (нигде, кроме письма)
   - bcrypt хэш
   - `passwordHash` в API-ответах User-объектов
   - В debug/error logs: только email, без passwordHash

2. **Всегда хэшировать пароль перед записью:**

   ```typescript
   // Запрет:
   await prisma.user.create({ data: { password: "plain123" } });
   // Только так:
   const hash = await bcrypt.hash(plain, 10);
   await prisma.user.create({ data: { passwordHash: hash } });
   ```

3. **Email — всегда в lowercase + trim** перед записью и поиском. Иначе `Victor@Example.com` и `victor@example.com` создадут две записи.

4. **Проверка `isBlocked` ВСЕГДА на сервере** в `authorize()`. Не на клиенте — клиент можно обойти.

5. **`accessKey.isBlocked` проверяется при логине, а не только при регистрации.** Иначе игрок с заблокированным позже ключом продолжит играть до истечения сессии.

6. **CSRF защита:** Auth.js v5 даёт CSRF токен из коробки для signIn. Дополнительная защита для наших custom-эндпоинтов (`/register`, `/reset-password`) — Next.js Server Components + same-origin policy. Если в будущем будет внешний клиент — добавить CSRF middleware.

7. **HTTPS обязателен в проде.** В dev cookie `secure: false`, в prod — `secure: true`. Auth.js v5 сам определяет по `AUTH_URL` (https vs http) или `NEXTAUTH_URL` (для совместимости).

8. **Запрет на прямой `INSERT User` без транзакции.** Регистрация — только через единую транзакцию из этого модуля. Иначе может случиться `User` без `GameProgress` или `ChatState`, что сломает все последующие модули.

9. **Логирование подозрительных событий** в `AdminAuditLog` (для модуля admin):
   - `key_blocked` — когда ключ блокируется
   - `admin_failed_login` — N подряд неуспешных попыток логина админа (потенциальная атака) — **этот пункт пока в TODO, не делаем в Фазе 1**

10. **ENV-переменные `ADMIN_INITIAL_*`** — используются ТОЛЬКО сидером один раз. После создания первого админа удалить с сервера. Проверка в сидере: если `AdminUser.count() > 0` — пропуск создания.

---

## Связи с другими модулями

- **`.docs/modules/app-settings.md`** — `GET /api/settings/registration-defaults` живёт там же. Здесь только использование.
- **`.docs/modules/onboarding.md`** — после первого логина игрока проверяется `User.onboardingDone`. Если false — рендерится OnboardingOverlay.
- **`.docs/modules/admin.md`** — управление пользователями (бан/разбан, выгрузка), управление ключами, управление администраторами.
- **`.docs/modules/restart.md`** — restart НЕ сбрасывает auth-данные пользователя. `User`, `AccessKey.currentActivations`, `User.onboardingDone` — всё сохраняется.
