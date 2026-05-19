# Модуль: Блокировка устройств с малым экраном (mobile-block)

> Связанные файлы: `.docs/database.md`, `.docs/modules/auth.md`, `.docs/modules/onboarding.md`, `.docs/modules/missions-rdp.md`, `.docs/modules/restart.md`.

## Оглавление

1. [Что входит в модуль](#что-входит-в-модуль)
2. [Что НЕ входит](#что-не-входит)
3. [Ключевые решения](#ключевые-решения)
4. [Минимальные требования к экрану](#минимальные-требования-к-экрану)
5. [Архитектура детекции — три слоя](#архитектура-детекции--три-слоя)
6. [API-эндпоинты](#api-эндпоинты)
7. [Файлы, которые создаются](#файлы-которые-создаются)
8. [Серверные правила](#серверные-правила)
9. [Связи с другими модулями](#связи-с-другими-модулями)

---

## Что входит в модуль

После завершения этого модуля:

- При попытке открыть приложение на устройстве с экраном меньше `1024 × 700 px` ИЛИ с touch-указателем при недостаточной ширине — игрок видит **полноэкранную статичную заглушку** с текстом «Игра доступна только на десктопе. Откройте приложение на компьютере.»
- Заглушка показывается на **всех** страницах приложения (login, register, reset-password, dashboard, admin-login, admin/*) — глобально из корневого layout.
- Заглушка **не имеет состояний и не сохраняет ничего в БД** — это статичный экран, реагирующий только на текущие параметры устройства.
- При ресайзе окна / повороте устройства заглушка появляется и исчезает динамически (без перезагрузки страницы).
- Детекция **устойчива к режиму «Request Desktop Site»** в мобильных браузерах: сервер ловит через User-Agent Client Hints, клиент — через `pointer: coarse` + `navigator.maxTouchPoints`.

## Что НЕ входит

- Мобильная адаптация UI (полностью out of scope — заказчик подтвердил).
- Серверный флаг «игрок видел заглушку» (заглушка показывается всегда при подходящих условиях устройства).
- Точечные заглушки внутри отдельных миссий (RDP-специфичная блокировка удалена — общая заглушка перехватывает раньше).
- Серверная блокировка API-эндпоинтов по типу устройства (не требуется — игровая логика идёт через session, а UI на мобильном просто не доступен).

---

## Ключевые решения

### 1. Один компонент, единая константа порога

`<MobileBlock />` — статичный компонент, размещается в корневом `app/layout.tsx` через обёртку `<MobileGuard />`. Текст заглушки и константы порога — в `constants/mobileBlockText.ts` и `constants/screenRequirements.ts` соответственно. Изменение в одном месте — обновление везде.

### 2. Гибридная детекция (сервер + клиент)

Сервер сам по себе не знает ширину окна — заголовков с viewport в HTTP нет. Клиент сам по себе показывает FOUC десктопного UI до выполнения JS. Решение: оба слоя работают вместе.

- **Сервер** парсит `User-Agent` и `Sec-CH-UA-Mobile` через `next/headers`. Если устройство **точно мобильный телефон** — рендерит `<MobileBlock />` сразу, без рендера приложения. FOUC = 0.
- **Клиент** делает финальную проверку по реальному `window.innerWidth × window.innerHeight` и `matchMedia('(pointer: coarse)')` + `navigator.maxTouchPoints`. Реагирует на ресайз.

### 3. Минимальный порог — 1024 × 700 px

Обоснование — самая требовательная миссия RDP (пазл 7×7 + симуляция Windows + PDF). Подробный расчёт — см. раздел [Минимальные требования к экрану](#минимальные-требования-к-экрану).

### 4. Не сбрасывается ничего — нечего сбрасывать

В отличие от удалённого `mobile-warning.md`, здесь нет серверного флага. Заглушка — функция от текущих параметров устройства, а не от истории игрока. Поэтому в `restart.md` упоминаний этого модуля нет (кроме секции «Связи»).

### 5. Никаких записей в OperationLog

Показ заглушки — UI-событие, не игровое. В `OperationLog` ничего не пишется.

---

## Минимальные требования к экрану

| Параметр | Значение | Откуда |
|---|---|---|
| `MIN_VIEWPORT_WIDTH` | `1024` px | Нижний край Tailwind `lg:`; iPad landscape; типичный минимум серьёзных веб-приложений |
| `MIN_VIEWPORT_HEIGHT` | `700` px | RDP-модалка с пазлом 7×7 + таймером + кнопками |
| Тип указателя | `pointer: fine` ИЛИ `pointer: coarse` + ширина ≥ 1024 | Допускает планшет с мышкой/тачскрином в ландшафте |

**Что покрывает порог 1024 × 700:**

- ✅ Десктопы (Windows, macOS, Linux) — все разрешения от 1024×768
- ✅ iPad / Android-планшеты с мышкой/клавиатурой в горизонтальной ориентации (≥ 1024 px)
- ✅ Surface Pro и другие 2-в-1 устройства
- ❌ Смартфоны (любые)
- ❌ iPad / Android-планшеты в портретной ориентации (< 1024 px)
- ❌ Десктоп с сильно сжатым окном (< 1024 px) — UI разработчика, но это допустимо

**Текст заглушки** — единая константа `constants/mobileBlockText.ts`:

> «Игра доступна только на десктопе. Откройте приложение на компьютере.»

Дополнительный подзаголовок (можно вынести отдельной константой):

> «Минимальное разрешение экрана — 1024 × 700 пикселей.»

---

## Архитектура детекции — три слоя

### Слой 1 — Сервер (без FOUC для явных мобильных)

В `app/layout.tsx` (Server Component):

```tsx
import { headers } from 'next/headers';
import { detectDeviceFromHeaders } from '@/lib/device-detection';
import { MobileBlock } from '@/components/mobile-block/MobileBlock';
import { MobileGuard } from '@/components/mobile-block/MobileGuard';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const device = detectDeviceFromHeaders(await headers());

  if (device === 'phone') {
    return (
      <html lang="ru" data-device={device}>
        <body><MobileBlock /></body>
      </html>
    );
  }

  return (
    <html lang="ru" data-device={device}>
      <body>
        <MobileGuard initialDevice={device}>{children}</MobileGuard>
      </body>
    </html>
  );
}
```

```ts
// lib/device-detection.ts
export type Device = 'phone' | 'tablet' | 'desktop' | 'unknown';

const PHONE_REGEX = /Mobi|iPhone|iPod|Android.*Mobile|BlackBerry|Opera Mini/i;
const TABLET_REGEX = /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Kindle|Silk/i;

export function detectDeviceFromHeaders(h: Headers): Device {
  const ua = h.get('user-agent') ?? '';
  const uaChMobile = h.get('sec-ch-ua-mobile');

  if (uaChMobile === '?1') return 'phone';
  if (PHONE_REGEX.test(ua)) return 'phone';
  if (TABLET_REGEX.test(ua)) return 'tablet';
  if (uaChMobile === '?0') return 'desktop';
  return 'unknown';
}
```

**Что закрывается этим слоем:**

- iPhone Safari / Chrome Android → UA или UA-CH вернёт `phone` → блок без рендера приложения
- Chrome Android в режиме «Request Desktop Site» → UA выглядит как десктоп, но UA-CH `sec-ch-ua-mobile = ?1` → блок без рендера приложения

### Слой 2 — Клиент (финальная проверка по viewport)

```tsx
// components/mobile-block/MobileGuard.tsx
'use client';

import { useEffect, useState } from 'react';
import { MobileBlock } from './MobileBlock';
import type { Device } from '@/lib/device-detection';
import { isBlockedByViewport } from '@/lib/device-detection-client';

export function MobileGuard({
  initialDevice,
  children,
}: {
  initialDevice: Device;
  children: React.ReactNode;
}) {
  const [blocked, setBlocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    return isBlockedByViewport(initialDevice);
  });

  useEffect(() => {
    const update = () => setBlocked(isBlockedByViewport(initialDevice));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [initialDevice]);

  if (blocked) return <MobileBlock />;
  return <>{children}</>;
}
```

```ts
// lib/device-detection-client.ts
import { MIN_VIEWPORT_WIDTH, MIN_VIEWPORT_HEIGHT } from '@/constants/screenRequirements';
import type { Device } from './device-detection';

export function isBlockedByViewport(device: Device): boolean {
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (w < MIN_VIEWPORT_WIDTH || h < MIN_VIEWPORT_HEIGHT) return true;

  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const isLikelyTablet = navigator.maxTouchPoints > 1;

  if (device === 'unknown' && (isTouch || isLikelyTablet) && w < MIN_VIEWPORT_WIDTH) {
    return true;
  }

  return false;
}
```

**Что закрывается этим слоем:**

- iPad в портретной ориентации (Safari возвращает UA «Mac», UA-CH не отдаёт) → ширина 820 < 1024 → блок
- iPad в портретной ориентации в режиме «Request Desktop Website» → `navigator.maxTouchPoints > 1` + узкая ширина → блок
- Поворот устройства из ландшафта в портрет → `resize`/`orientationchange` пересчитывают → блок появляется

### Слой 3 — CSS-страховка (опциональная защита от FOUC при медленной гидрации)

В `app/globals.css`:

```css
@media (max-width: 1023px), (max-height: 699px) {
  html[data-device="tablet"] body > :not(.mobile-block-fallback) {
    display: none;
  }
  .mobile-block-fallback {
    display: flex;
  }
}

.mobile-block-fallback {
  display: none;
}
```

В `app/layout.tsx` добавить статический фолбэк перед `<MobileGuard>`:

```tsx
<body>
  <div className="mobile-block-fallback ...">
    <p>Игра доступна только на десктопе. Откройте приложение на компьютере.</p>
  </div>
  <MobileGuard initialDevice={device}>{children}</MobileGuard>
</body>
```

Опционально для MVP. Если FOUC ~100ms при гидрации на планшете в портрете терпим — слой 3 не нужен.

---

## API-эндпоинты

**Этот модуль НЕ создаёт ни одного API-эндпоинта.** Заглушка — чисто клиентская/SSR-логика без обращений к серверу.

Удалённый эндпоинт `POST /api/user/mobile-warning-seen` — больше не существует. См. историю в коммитах.

---

## Файлы, которые создаются

```
app/
└── layout.tsx                            # обновляется: парсинг headers + обёртка MobileGuard

components/
└── mobile-block/
    ├── MobileBlock.tsx                   # Client/Server Component, статичная заглушка
    └── MobileGuard.tsx                   # Client Component, финальная проверка viewport

lib/
├── device-detection.ts                   # серверная функция detectDeviceFromHeaders
└── device-detection-client.ts            # клиентская функция isBlockedByViewport

constants/
├── mobileBlockText.ts                    # текст заглушки (главный + подзаголовок)
└── screenRequirements.ts                 # MIN_VIEWPORT_WIDTH=1024, MIN_VIEWPORT_HEIGHT=700

app/globals.css                           # обновляется: добавляются стили mobile-block-fallback (опционально)
```

**Удаляются:**

```
components/game/mobile-warning/           # вся папка
components/game/rdp/RdpMobileBlock.tsx
lib/hooks/useIsMobile.ts
lib/hooks/useIsRdpUnavailable.ts
constants/mobileWarningText.ts
app/api/user/mobile-warning-seen/         # вся папка
```

---

## Серверные правила

1. **Никаких записей в БД.** Заглушка не пишет в `User`, `OperationLog`, `GameProgress` — ни в одну таблицу.

2. **Никакой авторизации.** Заглушка показывается ДО проверки сессии — игрок без логина тоже её видит на `/login`.

3. **Заголовок `sec-ch-ua-mobile` доступен не всегда.** Только Chromium-браузеры (Chrome, Edge, Opera). Safari / Firefox его не отдают. Поэтому клиентский guard обязателен — он закрывает оставшиеся кейсы.

4. **Регулярки парсинга UA — компромисс.** `PHONE_REGEX` и `TABLET_REGEX` могут не покрыть экзотические устройства. Граничные случаи (`device === 'unknown'`) — клиентский guard решает по реальному viewport.

5. **Порог `1024 × 700` — единая константа.** Изменение в `constants/screenRequirements.ts` автоматически меняет поведение и сервера, и клиента (через импорт).

6. **CSS-страховка — опциональна.** Включается в код, только если FOUC при гидрации на планшете в портрете окажется заметным после ручного тестирования.

---

## Связи с другими модулями

- **`database.md`** — поле `User.mobileWarningSeen` **удалено**. Этот модуль больше не использует ни одного поля БД.
- **`auth.md`** — взаимодействия нет. Заглушка показывается независимо от состояния сессии (и до неё).
- **`onboarding.md`** — упрощается логика DashboardClient: онбординг показывается всегда при `onboardingDone=false` (никаких приоритетов «mobile warning сначала, онбординг потом» — потому что на маленьком экране игрок вообще не доходит до dashboard).
- **`missions-rdp.md`** — раздел «Блокировка на мобильных» и компонент `RdpMobileBlock` удалены. Общая заглушка перехватывает раньше.
- **`restart.md`** — упоминания `User.mobileWarningSeen` удалены (поля больше нет в БД).
- **`logs.md`** — упоминания `mobile-warning.md` удалены.
- **`admin.md`** — поле `mobileWarningSeen` удалено из JSON-ответа админского эндпоинта просмотра пользователя.
- **`prd.md`** — раздел «Мобильное предупреждение» переименован в «Блокировка устройств с малым экраном», раздел «Поддерживаемые устройства» переписан.
- **`dod-global.md`** — пункт «Корректно отображается на мобильном (375px+)» заменён на «UI корректно отображается на экранах от 1024×700 px».
