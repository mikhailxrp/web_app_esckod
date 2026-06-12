export const GAME_TARGET_NAME = 'ВИКТОР ПАК';

// ─── Crack mission ──────────────────────────────────────────────────────────

/** Длина слова в Wordle-механике (русские 5-буквенные слова). */
export const CRACK_WORD_LENGTH = 5;

/** Фолбэк лимита попыток, если у слота не задан crackMaxAttempts. */
export const CRACK_DEFAULT_MAX_ATTEMPTS = 6;

/** Сколько раз поле должно быть провалено, прежде чем станет доступен пропуск. */
export const CRACK_SKIP_THRESHOLD = 2;

// ─── Decipher mission ────────────────────────────────────────────────────────

/** Сколько неправильных попыток подряд, прежде чем станет доступен пропуск. */
export const DECIPHER_SKIP_THRESHOLD = 2;

/** Rate limit: попытки расшифровки (на userId + slotKey). */
export const DECIPHER_ATTEMPT_RATE_LIMIT = 20;

/** Rate limit: запуск миссии через folderPath (на userId). */
export const DECIPHER_LAUNCH_RATE_LIMIT = 30;

// ─── RDP mission ─────────────────────────────────────────────────────────────

/** Rate limit: подключение по IP (на userId). */
export const RDP_CONNECT_RATE_LIMIT = 10;
