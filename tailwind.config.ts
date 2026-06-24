import type { Config } from "tailwindcss";

// =============================================================
// GAME-CORP — Tailwind Design Tokens
// =============================================================
// КАК ОБНОВЛЯТЬ:
// При добавлении новых экранов — найди нужную секцию по комментарию
// и добавляй новые токены в конец секции.
// НЕ удаляй существующие токены — только добавляй.
// Источник правды: variables.json + реальные макеты Figma
// =============================================================

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      // -----------------------------------------------------------
      // ЦВЕТА
      // [AUTH] — вход, регистрация, восстановление пароля
      // [DASHBOARD] — добавить при получении экранов dashboard
      // [GAME] — добавить при получении игровых экранов
      // -----------------------------------------------------------
      colors: {
        // Базовые фоны — используются на всех экранах
        bg: {
          page: "#000000", // чистый черный фон страницы
          primary: "#121212", // основной темный фон
          secondary: "#1C1C1C", // фон карточек и панелей
          tertiary: "#242424", // вложенные блоки, header-зоны
          input: "#121212", // фон инпутов
          card: "#1C1C1C", // фон auth-карточки
        },

        // Акцентный teal — главный цвет интерактивных элементов
        accent: {
          DEFAULT: "#44DFD7",
          hover: "#00B3A6",
          muted: "rgba(68, 223, 215, 0.12)",
        },

        // Текст
        content: {
          primary: "#E6EDF3", // основной текст
          secondary: "#999999", // лейблы, метаданные, timestamps
          muted: "#484F58", // placeholder, неактивные элементы
          inverse: "#000000", // текст на accent-кнопке
          label: "#999999", // лейблы полей формы
          "card-title": "#44DFD7", // заголовок auth-карточки
        },

        // Границы
        border: {
          DEFAULT: "#30363D", // основная граница
          light: "#21262D", // тонкая граница
          strong: "#484F58", // акцентная граница
          card: "rgba(255,255,255,0.15)", // граница auth-карточки
          focus: "#44DFD7", // focus-состояние инпута
          error: "#CF6679", // error-состояние инпута
        },

        // Семантика
        semantic: {
          success: "#3FB950",
          "success-bg": "rgba(63, 185, 80, 0.10)",
          error: "#CF6679",
          "error-bg": "rgba(207, 102, 121, 0.10)",
          warning: "#BF8700",
          "warning-bg": "rgba(191, 135, 0, 0.10)",
          info: "#0550AE",
          "info-bg": "rgba(5, 80, 174, 0.10)",
        },

        // [ADMIN] — административная зона
        admin: {
          accent: "#6E39CB", // основной акцент
          "accent-hover": "#5A2DB0", // hover-состояние
          "accent-muted": "rgba(110, 57, 203, 0.12)", // subtle-подложка
          "card-bg": "#FFFFFF", // фон карточки
          "card-border": "rgba(0, 0, 0, 0.08)", // граница карточки
          "input-bg": "#EDEEF2", // фон инпута
          "input-text": "#111827", // текст инпута
          label: "#374151", // лейбл поля
          placeholder: "#9CA3AF", // placeholder
          // [ADMIN-DASHBOARD]
          "sidebar-bg": "#F3F4F6",
          "sidebar-border": "#E5E7EB",
          "nav-text": "#374151",
          "nav-active-bg": "#EDE9FE",
          "nav-active-text": "#6E39CB",
          "nav-hover-bg": "#F9FAFB",
        },

        // [DASHBOARD] — добавить цвета статусов соединения
        // status: { connected: '...', disconnected: '...', scanning: '...' },

        // [GAME] — игровые состояния и подсветка
        game: {
          "pipe-a": "#44DFD7", // линия 1 трубопровода (совпадает с accent — teal)
          "pipe-b": "#F2B53C", // линия 2 трубопровода — янтарный контраст к teal
        },
      },

      // -----------------------------------------------------------
      // ТИПОГРАФИКА — Шрифты
      // -----------------------------------------------------------
      fontFamily: {
        mono: ['"VCR OSD Mono"', "monospace"],
        accent: ['"VCR OSD Mono"', "monospace"],
        base: ['"VCR OSD Mono"', "monospace"],
      },

      // -----------------------------------------------------------
      // ТИПОГРАФИКА — Размеры
      // Формат: [size, { lineHeight, letterSpacing }]
      // -----------------------------------------------------------
      fontSize: {
        "game-xs": ["11px", { lineHeight: "16px" }], // timestamps, badges
        "game-sm": ["12px", { lineHeight: "18px" }], // лейблы, placeholder
        "game-base": ["14px", { lineHeight: "22px" }], // основной контент
        "game-md": ["16px", { lineHeight: "24px" }], // заголовки карточек
        "game-lg": ["18px", { lineHeight: "28px" }], // заголовки карточек
        "game-panel": ["20px", { lineHeight: "28px" }], // заголовки панелей (Взломщик, Детектив, История)
        "game-xl": ["24px", { lineHeight: "32px" }], // заголовки страниц
        "game-2xl": ["32px", { lineHeight: "40px" }], // hero-заголовок
        "game-3xl": ["40px", { lineHeight: "48px" }],
        "game-4xl": ["48px", { lineHeight: "58px" }], // декоративные строки
      },

      // -----------------------------------------------------------
      // ТИПОГРАФИКА — Letter Spacing
      // -----------------------------------------------------------
      letterSpacing: {
        "game-tight": "-0.01em",
        "game-normal": "0em",
        "game-wide": "0.05em", // системные лейблы CAPS
        "game-wider": "0.12em", // СТАТУС, ЦЕЛЬ, ДОСТУП
      },

      // -----------------------------------------------------------
      // СКРУГЛЕНИЯ
      // Важно: значения взяты с реальных макетов (не из direction.md)
      // direction.md содержит неточные значения — доверяй макетам
      // -----------------------------------------------------------
      borderRadius: {
        "game-none": "0px",
        "game-sm": "2px", // строки истории действий
        "game-md": "4px", // кнопки терминального стиля
        "game-lg": "8px", // инпуты и кнопки на auth-экранах
        "game-xl": "12px", // auth-карточка
        "game-full": "9999px", // прогресс-бар loader
        // [DASHBOARD] — добавить радиусы панелей инструментов
      },

      // -----------------------------------------------------------
      // ТЕНИ / СВЕЧЕНИЯ
      // -----------------------------------------------------------
      boxShadow: {
        // Граница без классической тени
        "game-border": "0 0 0 1px #30363D",

        // Тень auth-карточки
        "game-card":
          "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.15)",

        // Cyan свечение — разная интенсивность
        "game-glow-sm": "0 0 8px rgba(68,223,215,0.15)",
        "game-glow-md": "0 0 16px rgba(68,223,215,0.20)",
        "game-glow-lg": "0 0 32px rgba(68,223,215,0.25)",

        // Focus инпута
        "game-focus": "0 0 0 1px #44DFD7, 0 0 8px rgba(68,223,215,0.15)",

        // Error инпута
        "game-error": "0 0 0 1px #CF6679",

        // Admin — карточка формы входа
        "admin-card": "0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)",

        // [DASHBOARD] — добавить тени панелей инструментов
      },

      // -----------------------------------------------------------
      // ОТСТУПЫ
      // Стандартные Tailwind отступы достаточны.
      // Добавляем только специфичные для проекта.
      // -----------------------------------------------------------
      spacing: {
        "card-padding": "32px", // внутренний padding auth-карточки
        "input-height": "44px", // высота инпута и кнопки
        "progress-width": "520px", // ширина прогресс-бара loader
        // [DASHBOARD] — добавить специфичные отступы панелей
      },

      // -----------------------------------------------------------
      // АНИМАЦИИ
      // Только то чего нет в стандартном Tailwind
      // [AUTH] — typewriter, blink cursor, loader progress
      // [DASHBOARD] — добавить glow pulse, scanline, glitch
      // -----------------------------------------------------------
      keyframes: {
        // Мигающий курсор █
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },

        // Пульсация teal-свечения
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(68,223,215,0.15)" },
          "50%": { boxShadow: "0 0 20px rgba(68,223,215,0.35)" },
        },

        // Появление строки (slide-in снизу)
        "slide-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },

        // Плавное появление (панели демо-миссий в онбординге)
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },

        // Fade-out для loader
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },

        // [DASHBOARD] — glitch эффект для error-состояний
        // glitch: { ... }

        // [DASHBOARD] — scanline анимация
        // scanline: { ... }

        // Появление backdrop модального окна
        "modal-backdrop": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },

        // Появление панели модального окна (масштаб + сдвиг + opacity)
        "modal-panel": {
          "0%": { opacity: "0", transform: "scale(0.95) translateY(-10px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },

        "chat-notify": {
          "0%, 100%": { borderColor: "rgba(255,255,255,0.1)" },
          "50%": { borderColor: "#00E5CC" },
        },

        // Пульсация пузырька сообщения — ожидание действия игрока
        "message-await": {
          "0%, 100%": {
            boxShadow: "0 0 0 1px rgba(68,223,215,0.15)",
            opacity: "1",
          },
          "50%": {
            boxShadow: "0 0 10px 2px rgba(68,223,215,0.35)",
            opacity: "0.82",
          },
        },
      },

      animation: {
        blink: "blink 1s step-end infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "slide-in": "slide-in 0.2s ease forwards",
        "fade-in": "fade-in 0.25s ease forwards",
        "fade-out": "fade-out 0.4s ease forwards",
        "modal-backdrop": "modal-backdrop 0.2s ease forwards",
        "modal-panel":
          "modal-panel 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "chat-notify": "chat-notify 1.2s ease-in-out infinite",
        "message-await": "message-await 1.8s ease-in-out infinite",
        // [DASHBOARD] — добавить glitch, scanline
      },

      // -----------------------------------------------------------
      // Z-INDEX
      // -----------------------------------------------------------
      zIndex: {
        "bg-letters": "-1", // SVG буквы ЭСКАПИСТ — под всем
        content: "10", // основной контент
        card: "100", // auth-карточки
        toast: "200", // уведомления
        loader: "300", // экран загрузки
        // [DASHBOARD] — добавить z-index для панелей и оверлеев
      },

      // -----------------------------------------------------------
      // BREAKPOINTS
      // -----------------------------------------------------------
      screens: {
        xs: "320px",
        sm: "480px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1440px",
      },
    },
  },

  plugins: [],
};

export default config;
