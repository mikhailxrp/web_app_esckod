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
  DECIPHER_RESULT: "decipher-result",
  RDP_FORM: "rdp-form",
  RDP_PUZZLE: "rdp-puzzle",
  RDP_INSTRUCTION_BUTTON: "rdp-instruction-button",
} as const;

/** Шаги с frosted-glass плашкой поверх mission-tiles (без кнопки «Назад») */
export const MISSION_TILES_OVERLAY_STEP_COUNT = 2;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ─── Шаг 1: Приветствие ────────────────────────────────────────────────────
  {
    id: 1,
    scene: "base",
    target: ONBOARDING_TARGETS.MISSION_TILES,
    placement: "center",
    text: "{{login}}, добро пожаловать в систему!\n\nПрежде, чем приступить к делу, вам нужно пройти короткий инструктаж.",
  },

  // ─── Шаг 2: Обзор инструментов ─────────────────────────────────────────────
  {
    id: 2,
    scene: "base",
    target: ONBOARDING_TARGETS.MISSION_TILES,
    placement: "center",
    text: "Мы предоставляем нашим агентам самые передовые технологии для раскрытия дел любой сложности.\n\nДля начала вам доступны три инструмента:\nвзлом сайта (для получения доступа к аккаунтам сторонних сайтов);\nдешифратор (для получения доступа к папкам, защищенным паролем);\nудаленный доступ (для подключения к личным компьютерам подозреваемых или свидетелей).\n\nДавайте остановимся подробнее на каждом из них.",
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
    text: "Начнем со взлома сайтов",
  },

  // ─── Шаг 4: Форма запуска Взломщика ───────────────────────────────────────
  {
    id: 4,
    scene: "crack-launch",
    target: ONBOARDING_TARGETS.CRACK_MISSION_CARD,
    placement: "right",
    text: "Взломщик сайтов. Введите ссылку на целевой сайт и корпоративную почту сотрудника. Нажмите «Начать» для запуска.",
    demoPayload: {
      crackDemo: { slotKey: "__demo_crack__" },
    },
  },

  // ─── Шаг 5: Поле Wordle + правила ─────────────────────────────────────────
  {
    id: 5,
    scene: "crack-game",
    target: ONBOARDING_TARGETS.CRACK_WORDLE_BOARD,
    placement: "right",
    text: "Система сгенерировала пятибуквенное слово-пароль. Угадайте его за 6 попыток.\n\nВведите любое русское слово из 5 букв и нажмите Enter.",
    demoPayload: {
      crackDemo: { slotKey: "__demo_crack__" },
    },
  },

  // ─── Шаг 6: Пример слова ПЕСНЯ + цвета ────────────────────────────────────
  {
    id: 6,
    scene: "crack-game",
    target: ONBOARDING_TARGETS.CRACK_WORDLE_BOARD,
    placement: "right",
    text: "Цвет ячейки подсказывает:\n\n🟩 Зелёный — буква есть, стоит на месте\n🟨 Жёлтый — буква есть, но на другом месте\n⬛ Серый — буквы нет в слове\n\nНапример: П-Е-С-Н-Я",
    demoPayload: {
      crackDemo: { slotKey: "__demo_crack__" },
    },
  },

  // ─── Шаг 7: Попытка 2/6 — ПЛИТА ───────────────────────────────────────────
  {
    id: 7,
    scene: "crack-game",
    target: ONBOARDING_TARGETS.CRACK_WORDLE_BOARD,
    placement: "right",
    text: "Используйте подсказки. Попытка 2 из 6: введено слово ПЛИТА — видим, что буква «П» стоит правильно.",
    demoPayload: {
      crackDemo: { slotKey: "__demo_crack__" },
    },
  },

  // ─── Шаг 8: ПИЛОТ + кнопка «Подтвердить» ─────────────────────────────────
  {
    id: 8,
    scene: "crack-game",
    target: ONBOARDING_TARGETS.CRACK_WORDLE_BOARD,
    placement: "right",
    text: "Слово угадано! Появилась кнопка «Подтвердить». Нажмите её, чтобы записать пароль в систему.",
    demoPayload: {
      crackDemo: { slotKey: "__demo_crack__" },
    },
  },

  // ─── Шаг 9: «Доступ предоставлен» + пароль ────────────────────────────────
  {
    id: 9,
    scene: "crack-done",
    target: ONBOARDING_TARGETS.CRACK_RESULT,
    placement: "right",
    text: "Доступ предоставлен. Пароль успешно получен. Скопируйте его с помощью кнопки копирования — он понадобится позже.",
    demoPayload: {
      crackDemo: { slotKey: "__demo_crack__" },
    },
  },

  // ─── Шаг 10: «Скопировано» + запись в историю ─────────────────────────────
  {
    id: 10,
    scene: "crack-done",
    target: ONBOARDING_TARGETS.OPERATION_HISTORY,
    placement: "top",
    text: "Операция записана в «Историю действий». Здесь отображаются все ваши шаги по ходу расследования.",
    demoPayload: {
      crackDemo: { slotKey: "__demo_crack__" },
    },
  },

  // ─── Шаг 11: Подсветка плашки Дешифратора ─────────────────────────────────
  {
    id: 11,
    scene: "base",
    target: ONBOARDING_TARGETS.MISSION_TILES,
    placement: "bottom",
    text: "Отлично! Взломщик освоен. Теперь перейдём к дешифратору файлов.",
  },

  // ─── Шаг 12: Форма запуска Дешифратора ────────────────────────────────────
  {
    id: 12,
    scene: "decipher-launch",
    target: ONBOARDING_TARGETS.DECIPHER_MISSION_CARD,
    placement: "right",
    text: "Дешифратор файлов. Введите ссылку на зашифрованный файл и ключ шифрования. Нажмите «Начать».",
    demoPayload: {
      decipherDemo: { slotKey: "__demo_decipher__" },
    },
  },

  // ─── Шаг 13: Таблица Playfair + ЛМОПРС ────────────────────────────────────
  {
    id: 13,
    scene: "decipher-game",
    target: ONBOARDING_TARGETS.DECIPHER_TABLE,
    placement: "right",
    text: "Перед вами таблица Playfair и зашифрованное слово. Найдите каждую пару букв в таблице и примените правила дешифровки.",
    demoPayload: {
      decipherDemo: { slotKey: "__demo_decipher__" },
    },
  },

  // ─── Шаг 14: Правила Playfair ──────────────────────────────────────────────
  {
    id: 14,
    scene: "decipher-game",
    target: ONBOARDING_TARGETS.DECIPHER_TABLE,
    placement: "left",
    text: "Правила Playfair:\n\n• Одна строка — берите букву левее\n• Один столбец — берите букву выше\n• Прямоугольник — берите угловые буквы\n\nЗашифрованное: Л-М-О-П-Р-С → ответ: Р-А-К-Е-Т-А",
    demoPayload: {
      decipherDemo: { slotKey: "__demo_decipher__" },
    },
  },

  // ─── Шаг 15: РАКЕТА + «Подтвердить» ───────────────────────────────────────
  {
    id: 15,
    scene: "decipher-game",
    target: ONBOARDING_TARGETS.DECIPHER_TABLE,
    placement: "right",
    text: "Слово расшифровано: РАКЕТА. Нажмите «Подтвердить» для записи пароля.",
    demoPayload: {
      decipherDemo: { slotKey: "__demo_decipher__" },
    },
  },

  // ─── Шаг 16: «Доступ предоставлен» + пароль папки ─────────────────────────
  {
    id: 16,
    scene: "decipher-done",
    target: ONBOARDING_TARGETS.DECIPHER_RESULT,
    placement: "right",
    text: "Доступ предоставлен. Пароль к папке получен. Сохраните его — он откроет зашифрованные материалы дела.",
    demoPayload: {
      decipherDemo: { slotKey: "__demo_decipher__" },
    },
  },

  // ─── Шаг 17: Подсветка плашки Удалённого доступа ──────────────────────────
  {
    id: 17,
    scene: "base",
    target: ONBOARDING_TARGETS.MISSION_TILES,
    placement: "bottom",
    text: "Превосходно! Остался последний инструмент — удалённый доступ к рабочей станции.",
  },

  // ─── Шаг 18: Форма запуска RDP ────────────────────────────────────────────
  {
    id: 18,
    scene: "rdp-launch",
    target: ONBOARDING_TARGETS.RDP_MISSION_CARD,
    placement: "right",
    text: "Удалённый доступ. Введите IP-адрес рабочей станции и нажмите «Начать» для подключения.",
    demoPayload: {
      rdpDemo: { connectResult: "pending" },
    },
  },

  // ─── Шаг 19: Пазл-трубопровод + правила ───────────────────────────────────
  {
    id: 19,
    scene: "rdp-game",
    target: ONBOARDING_TARGETS.RDP_PUZZLE,
    placement: "right",
    text: "Для установки соединения нужно соединить трубопровод. Поворачивайте сегменты кликом, чтобы построить непрерывную линию от входа до выхода.",
    demoPayload: {
      rdpDemo: { connectResult: "pending" },
    },
  },

  // ─── Шаг 20: Кнопка инструкции внутри RDP ─────────────────────────────────
  {
    id: 20,
    scene: "rdp-game",
    target: ONBOARDING_TARGETS.RDP_INSTRUCTION_BUTTON,
    placement: "bottom",
    text: "Кнопка «?» открывает подробную инструкцию по сборке трубопровода. Используйте её если нужна помощь.",
    demoPayload: {
      rdpDemo: { connectResult: "pending" },
    },
  },

  // ─── Шаг 21: Кнопка «ПОДСКАЗКА» ──────────────────────────────────────────
  {
    id: 21,
    scene: "base",
    target: ONBOARDING_TARGETS.HINTS_BUTTON,
    placement: "bottom",
    text: "Кнопка «ПОДСКАЗКА» открывает серию подсказок от детектива. Используйте её если зашли в тупик.",
  },

  // ─── Шаг 22: Чат Детектива + завершение ───────────────────────────────────
  {
    id: 22,
    scene: "chat-final",
    target: ONBOARDING_TARGETS.CHAT_DETECTIVE,
    placement: "top",
    text: "Инструктаж завершён. Детектив выходит на связь — следите за сообщениями в этой панели.\n\nУдачи, детектив.",
  },
];
