import type { OnboardingStep } from "@/types/onboarding";

/** Единый реестр всех data-onboarding-id используемых в туре */
export const ONBOARDING_TARGETS = {
  STATUS_BAR: "status-bar",
  MISSION_TILES: "mission-tiles",
  CRACK_MISSION_CARD: "crack-mission-card",
  DECIPHER_MISSION_CARD: "decipher-mission-card",
  RDP_MISSION_CARD: "rdp-mission-card",
  CHAT_DETECTIVE: "chat-detective",
  OPERATION_HISTORY: "operation-history",
  HINTS_BUTTON: "hints-button",
  CRACK_FORM: "crack-form",
  CRACK_WORDLE_BOARD: "crack-wordle-board",
  CRACK_RESULT: "crack-result",
  DECIPHER_FORM: "decipher-form",
  DECIPHER_TABLE: "decipher-table",
  DECIPHER_CONFIRM: "decipher-confirm",
  DECIPHER_RESULT: "decipher-result",
  RDP_FORM: "rdp-form",
  RDP_PUZZLE: "rdp-puzzle",
  RDP_INSTRUCTION_BUTTON: "rdp-instruction-button",
} as const;

/** Крупный размер текста для приветствия в шаге 1 */
const BUBBLE_FONT_SIZE_HERO = 20;
/** Размер шрифта пузырька по умолчанию */
const BUBBLE_FONT_SIZE_DEFAULT = 14;
/** Компактный размер для плотных шагов */
const BUBBLE_FONT_SIZE_COMPACT = 12;

/** Межстрочный интервал для шага 1 */
const BUBBLE_LINE_HEIGHT_HERO = 25;
/** Межстрочный интервал пузырька по умолчанию (≈ leading-relaxed при 14px) */
const BUBBLE_LINE_HEIGHT_DEFAULT = 22;
/** Средний интервал для плотного текста при 12-14px */
const BUBBLE_LINE_HEIGHT_MEDIUM = 18;
/** Компактный интервал для bubbleFontSize: 12 */
const BUBBLE_LINE_HEIGHT_COMPACT = 18;

/** Межбуквенный интервал пузырька по умолчанию */
const BUBBLE_LETTER_SPACING_DEFAULT = 1.15;
/** Выравнивание текста по центру */
const BUBBLE_TEXT_ALIGN_CENTER = "center" as const;
/** Выравнивание текста по левому краю */
const BUBBLE_TEXT_ALIGN_LEFT = "left" as const;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ─── Шаг 1: Приветствие ────────────────────────────────────────────────────
  {
    id: 1,
    scene: "base",
    target: ONBOARDING_TARGETS.MISSION_TILES,
    placement: "center",
    missionTilesOverlay: true,
    bubbleCenterVertically: true,
    bubbleFontSize: BUBBLE_FONT_SIZE_HERO,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_HERO,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    bubbleTextAlign: BUBBLE_TEXT_ALIGN_CENTER,
    text: "{{login}}, добро пожаловать в систему!\n\nПрежде чем приступить к делу, вам нужно пройти короткий инструктаж.",
  },

  // ─── Шаг 2: Обзор инструментов ─────────────────────────────────────────────
  {
    id: 2,
    scene: "base",
    target: ONBOARDING_TARGETS.MISSION_TILES,
    placement: "center",
    missionTilesOverlay: true,
    bubbleFontSize: BUBBLE_FONT_SIZE_HERO,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_HERO,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    bubbleTextAlign: BUBBLE_TEXT_ALIGN_LEFT,
    text: "Мы предоставляем нашим агентам самые передовые технологии для раскрытия дел любой сложности.\n\nДля начала вам доступны три инструмента:\n 1. Взлом сайта (для получения доступа к аккаунтам сторонних сайтов);\n2. Дешифратор (для получения доступа к папкам, защищенным паролем);\n3. Удаленный доступ (для подключения к личным компьютерам подозреваемых или свидетелей).\n\nДавайте остановимся подробнее на каждом из них.",
  },

  // ─── Шаг 3: Подсветка плашки Взломщика ─────────────────────────────────────
  {
    id: 3,
    scene: "base",
    target: ONBOARDING_TARGETS.CRACK_MISSION_CARD,
    placement: "top",
    bubbleAnchor: "top-right",
    bubbleGap: 0,
    bubbleTailSize: 18,
    bubbleShiftX: -48,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_DEFAULT,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Начнем со взлома сайтов.",
  },

  // ─── Шаг 4: Форма запуска Взломщика ───────────────────────────────────────
  {
    id: 4,
    scene: "crack-launch",
    target: ONBOARDING_TARGETS.CRACK_FORM,
    placement: "top",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftY: -28,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_COMPACT,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Для получения доступа к личному кабинету стороннего сайта необходимо ввести:\n\n• ссылку на сайт (его адрес, например, https://example.ru);\n• почту человека, чей личный кабинет нужно взломать.\n\nЗатем нажмите кнопку «Начать».",
    demoPayload: {
      crackDemo: { slotKey: "__demo_crack__", phase: "launch" },
    },
  },

  // ─── Шаг 5: Поле Wordle + правила ─────────────────────────────────────────
  {
    id: 5,
    scene: "crack-game",
    target: ONBOARDING_TARGETS.CRACK_WORDLE_BOARD,
    placement: "top",
    bubbleAnchor: "top-right",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: -50,
    bubbleShiftY: -160,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_COMPACT,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Если данные были введены корректно, откроется окно для прохождения миссии.\n\nПоле для взлома представляет собой список из случайных слов. Ваша задача: найти слово-ключ.\n\nШаги:\n1. Нажмите на случайное слово.\n2. Оно автоматически подставится в поле для проверки.\n3. Если выбранное слово не является ключом, вам будут доступны подсказки (цветовые индикаторы).",
    demoPayload: {
      crackDemo: { slotKey: "__demo_crack__", phase: "playing", attempts: [] },
    },
  },

  // ─── Шаг 6: Пример слова ПЕСНЯ + цвета ────────────────────────────────────
  {
    id: 6,
    scene: "crack-game",
    target: ONBOARDING_TARGETS.CRACK_WORDLE_BOARD,
    placement: "top",
    bubbleAnchor: "top-right",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: -200,
    bubbleShiftY: -130,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Например, выберем слово ПЕСНЯ.\n\nЦвет букв подскажет позицию в слове-ключе:\n• серый — буквы в слове нет;\n• желтый — буква не на своем месте;\n• зеленый — буква на своем месте.",
    demoPayload: {
      crackDemo: {
        slotKey: "__demo_crack__",
        phase: "playing",
        wordleSpotlight: "attempt-panel",
        attempts: [
          {
            word: "ПЕСНЯ",
            positions: ["correct", "absent", "absent", "absent", "absent"],
          },
        ],
      },
    },
  },

  // ─── Шаг 7: Попытка 2/6 — ПЛИТА ───────────────────────────────────────────
  {
    id: 7,
    scene: "crack-game",
    target: ONBOARDING_TARGETS.CRACK_WORDLE_BOARD,
    placement: "top",
    bubbleAnchor: "top-right",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: -700,
    bubbleShiftY: -50,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Попробуем слово ПЛИТА. \n\n Теперь у нас на руках больше подсказок. Можем попробовать угадать слово-ключ.",
    demoPayload: {
      crackDemo: {
        slotKey: "__demo_crack__",
        phase: "playing",
        wordleSpotlight: "attempt-panel",
        inputWord: "ПЛИТА",
        attempts: [
          {
            word: "ПЕСНЯ",
            positions: ["correct", "absent", "absent", "absent", "absent"],
          },
          {
            word: "ПЛИТА",
            positions: [
              "correct",
              "wrong-position",
              "wrong-position",
              "wrong-position",
              "absent",
            ],
          },
        ],
      },
    },
  },

  // ─── Шаг 8: ПИЛОТ + кнопка «Подтвердить» ─────────────────────────────────
  {
    id: 8,
    scene: "crack-game",
    target: ONBOARDING_TARGETS.CRACK_WORDLE_BOARD,
    placement: "bottom",
    bubbleAnchor: "bottom-left",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: -100,
    bubbleShiftY: -250,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Попробуем выбрать слово ПИЛОТ и нажать кнопку «Подтвердить».",
    demoPayload: {
      crackDemo: {
        slotKey: "__demo_crack__",
        phase: "playing",
        wordleSpotlight: "attempt-panel",
        inputWord: "ПИЛОТ",
        attempts: [
          {
            word: "ПЕСНЯ",
            positions: ["correct", "absent", "absent", "absent", "absent"],
          },
          {
            word: "ПЛИТА",
            positions: [
              "correct",
              "wrong-position",
              "wrong-position",
              "wrong-position",
              "absent",
            ],
          },
        ],
      },
    },
  },

  // ─── Шаг 9: «Доступ предоставлен» + пароль ────────────────────────────────
  {
    id: 9,
    scene: "crack-done",
    target: ONBOARDING_TARGETS.CRACK_RESULT,
    placement: "bottom",
    bubbleAnchor: "bottom-right",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: -350,
    bubbleShiftY: -50,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Скопируйте полученный пароль и используйте его для входа в личный кабинет на стороннем сайте.",
    demoPayload: {
      crackDemo: {
        slotKey: "__demo_crack__",
        phase: "completed",
        resultPassword: "ПИЛОТ",
        targetUrl: "example.ru",
        targetEmail: "PXGUDKXAXA",
      },
    },
  },

  // ─── Шаг 10: «Скопировано» + запись в историю ─────────────────────────────
  {
    id: 10,
    scene: "crack-done",
    target: ONBOARDING_TARGETS.OPERATION_HISTORY,
    placement: "top",
    bubbleAnchor: "top-right",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: -550,
    bubbleShiftY: -110,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Все пароли будут храниться в истории операций для вашего удобства.",
    demoPayload: {
      crackDemo: {
        slotKey: "__demo_crack__",
        phase: "completed",
        resultPassword: "ПИЛОТ",
        targetUrl: "example.ru",
        targetEmail: "PXGUDKXAXA",
        passwordCopied: true,
      },
      demoLogEntries: [
        {
          id: "demo-log-1",
          type: "INFO",
          message: "scan network...",
          createdAt: "2026-06-22T11:13:00",
        },
        {
          id: "demo-log-2",
          type: "INFO",
          message: "connect 192.168.0.1",
          createdAt: "2026-06-22T10:42:00",
        },
        {
          id: "demo-log-3",
          type: "SUCCESS",
          message: "Доступ к сайту example.ru предоставлен. Пароль **********",
          createdAt: "2026-06-22T10:31:00",
        },
      ],
    },
  },

  // ─── Шаг 11: Доступные в любой момент инструменты помощи ──────────────────
  {
    id: 11,
    scene: "base",
    target: ONBOARDING_TARGETS.MISSION_TILES,
    placement: "center",
    missionTilesOverlay: true,
    bubbleCenterVertically: true,
    bubbleFontSize: BUBBLE_FONT_SIZE_HERO,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_HERO,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    bubbleTextAlign: BUBBLE_TEXT_ALIGN_LEFT,
    text: "Если вы чувствуете, что на вас уже обрушилось много информации, не переживайте. Во всего время расследования вам будут доступны:\n\n1. Подсказки.\n2. Инструкции к миссиям.\n3. Возможность пропуска миссии (после второй неудачной попытки).",
  },

  // ─── Шаг 12: Подсветка плашки Дешифратора ─────────────────────────────────
  {
    id: 12,
    scene: "base",
    target: ONBOARDING_TARGETS.DECIPHER_MISSION_CARD,
    placement: "top",
    bubbleAnchor: "top-right",
    bubbleGap: 0,
    bubbleTailSize: 18,
    bubbleShiftX: -48,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_DEFAULT,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Перейдем к дешифратору.",
  },

  // ─── Шаг 13: Форма запуска Дешифратора ────────────────────────────────────
  {
    id: 13,
    scene: "decipher-launch",
    target: ONBOARDING_TARGETS.DECIPHER_FORM,
    placement: "top",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftY: -28,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_COMPACT,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Для получения пароля к закрытой папке необходимо ввести:\n\n• ссылку на папку (ее адрес, например, https://example.ru/folder) или путь к папке (будет указан при попытке ввода пароля);\n• ключ (представляет собой кодовое слово, чаще всего имеет значение для владельца папки).\n\nЗатем нажмите кнопку «Начать»",
    demoPayload: {
      decipherDemo: { slotKey: "__demo_decipher__", phase: "launch" },
    },
  },

  // ─── Шаг 14: Таблица Playfair + ЛМОПРС ────────────────────────────────────
  {
    id: 14,
    scene: "decipher-game",
    target: ONBOARDING_TARGETS.DECIPHER_TABLE,
    placement: "top",
    bubbleAnchor: "top-right",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: -500,
    bubbleShiftY: -30,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Если данные были введены корректно, откроется окно для прохождения миссии. \n\n Поле для взлома представляет таблицу. Ваша задача: расшифровать загаданное слово.",
    demoPayload: {
      decipherDemo: {
        slotKey: "__demo_decipher__",
        phase: "playing",
        encryptedWord: "ОВЧГФЛ",
        cipherKey: "КЛЮЧ",
        folderName: "File_name.zip",
      },
    },
  },

  // ─── Шаг 15: Правила Playfair ──────────────────────────────────────────────
  {
    id: 15,
    scene: "decipher-game",
    target: ONBOARDING_TARGETS.DECIPHER_TABLE,
    placement: "bottom",
    bubbleAnchor: "bottom-left",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleTailSide: "left",
    bubbleShiftX: 20,
    bubbleShiftY: -400,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Чтобы разгадать зашифрованное слово, вам нужно разделить шифр (ОВЧГФЛ) на пары букв (ОВ ЧГ ФЛ) и перекодировать их в соответствии с правилами:\n\nЕсли обе буквы попадают в одну и ту же строку таблицы, то каждую из них нужно заменить буквой следующую за ней (справа) в той же строке.\n\nЕсли обе буквы попадают в один и тот же столбец таблицы, то каждую из них нужно заменить буквой следующую за ней (вниз) в том же столбце.\n\nЕсли буквы находятся в разных строках и столбцах, то каждая заменяется буквой, находящейся на пересечении строки, содержащей эту букву, и столбца, где содержится вторая буква.",
    demoPayload: {
      decipherDemo: {
        slotKey: "__demo_decipher__",
        phase: "playing",
        encryptedWord: "ОВЧГФЛ",
        cipherKey: "КЛЮЧ",
        folderName: "File_name.zip",
      },
    },
  },

  // ─── Шаг 16: РАКЕТА + «Подтвердить» ───────────────────────────────────────
  {
    id: 16,
    scene: "decipher-game",
    target: ONBOARDING_TARGETS.DECIPHER_CONFIRM,
    placement: "bottom",
    bubbleAnchor: "bottom-center",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftY: -5,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "А вы думали, онбординг — это просто?\n\nЕсли вы правильно поняли правила, то у вас получилось расшифровать слово РАКЕТА.\n\nВам нужно будет ввести расшифрованное слово в нижнее поле и нажать кнопку «Подтвердить».",
    demoPayload: {
      decipherDemo: {
        slotKey: "__demo_decipher__",
        phase: "playing",
        encryptedWord: "ОВЧГФЛ",
        cipherKey: "КЛЮЧ",
        folderName: "File_name.zip",
        inputWord: "РАКЕТА",
      },
    },
  },

  // ─── Шаг 17: «Доступ предоставлен» + пароль папки ─────────────────────────
  {
    id: 17,
    scene: "decipher-done",
    target: ONBOARDING_TARGETS.DECIPHER_RESULT,
    placement: "bottom",
    bubbleAnchor: "bottom-right",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: -350,
    bubbleShiftY: -80,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Не забудьте скопировать полученный пароль для нужной вам папки.",
    demoPayload: {
      decipherDemo: {
        slotKey: "__demo_decipher__",
        phase: "completed",
        folderPath: "PXGUDKXAXA",
        folderPassword: "РАКЕТА",
        passwordCopied: true,
      },
    },
  },

  // ─── Шаг 18: Подсветка плашки Удаленного доступа ──────────────────────────
  {
    id: 18,
    scene: "base",
    target: ONBOARDING_TARGETS.RDP_MISSION_CARD,
    placement: "top",
    bubbleAnchor: "top-right",
    bubbleGap: 0,
    bubbleTailSize: 18,
    bubbleShiftX: -48,
    bubbleShiftY: -50,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "И, наконец, перейдем к удаленному доступу.\n\nОсталось чуть-чуть. Не увольняйтесь, пожалуйста.",
  },

  // ─── Шаг 19: Форма запуска RDP ────────────────────────────────────────────
  {
    id: 19,
    scene: "rdp-launch",
    target: ONBOARDING_TARGETS.RDP_FORM,
    placement: "top",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftY: -28,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_COMPACT,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Для получения доступа к чужому компьютеру необходимо ввести IP адрес \n (например, 111.111.111.11).\n\nЗатем нажмите кнопку «Начать».",
    demoPayload: {
      rdpDemo: { phase: "launch" },
    },
  },

  // ─── Шаг 20: Пазл-трубопровод + правила ───────────────────────────────────
  {
    id: 20,
    scene: "rdp-game",
    target: ONBOARDING_TARGETS.RDP_PUZZLE,
    placement: "top",
    bubbleAnchor: "top-right",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: -30,
    bubbleShiftY: -160,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Если данные были введены корректно, откроется окно для прохождения миссии.\n\nВ данной миссии необходимо провести непрерывную линию от точки старта до точки финиша.\n\nПосле этого автоматически откроется окно удаленного подключения.",
    demoPayload: {
      rdpDemo: { phase: "puzzle" },
    },
  },

  // ─── Шаг 21: Кнопка инструкции внутри RDP ─────────────────────────────────
  {
    id: 21,
    scene: "rdp-game",
    target: ONBOARDING_TARGETS.RDP_INSTRUCTION_BUTTON,
    placement: "top",
    bubbleAnchor: "center-right",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: -25,
    bubbleShiftY: 10,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Если в процессе расследования вы забудете правила прохождения миссий или запутаетесь, воспользуйтесь инструкцией.",
    demoPayload: {
      rdpDemo: { phase: "puzzle" },
    },
  },

  // ─── Шаг 22: Кнопка «ПОДСКАЗКА» ──────────────────────────────────────────
  {
    id: 22,
    scene: "base",
    target: ONBOARDING_TARGETS.HINTS_BUTTON,
    placement: "bottom",
    bubbleAnchor: "bottom-right",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: -100,
    bubbleShiftY: -8,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Если инструкция не помогла и вы не знаете, что делать дальше, можете обратиться к подсказкам.",
  },

  // ─── Шаг 23: Чат Детектива + завершение ───────────────────────────────────
  {
    id: 23,
    scene: "chat-final",
    target: ONBOARDING_TARGETS.CHAT_DETECTIVE,
    placement: "bottom",
    bubbleAnchor: "bottom-left",
    bubbleGap: 0,
    bubbleTailSize: 12,
    bubbleShiftX: 40,
    bubbleShiftY: -250,
    bubbleFontSize: BUBBLE_FONT_SIZE_DEFAULT,
    bubbleLineHeight: BUBBLE_LINE_HEIGHT_MEDIUM,
    bubbleLetterSpacing: BUBBLE_LETTER_SPACING_DEFAULT,
    text: "Конечно, над расследованием вы работаете не в одиночку.\n\nКоллеги могут писать вам в чате и даже отправлять файлы. А вот и первое сообщение.\n\nИнструктаж подошел к концу. Успехов в работе!",
  },
];
