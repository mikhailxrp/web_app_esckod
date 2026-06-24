import type { LetterStatus } from '@/types/crack';

export type OnboardingScene =
  | 'base'
  | 'crack-launch'
  | 'crack-game'
  | 'crack-done'
  | 'decipher-launch'
  | 'decipher-game'
  | 'decipher-done'
  | 'rdp-launch'
  | 'rdp-game'
  | 'chat-final';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

/** Сторона пузырька, на которой рисуется хвостик. По умолчанию выводится из placement */
export type BubbleTailSide = 'top' | 'bottom' | 'left' | 'right';

/** Точка привязки хвостика пузырька к целевому элементу */
export type BubbleAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'center-left'
  | 'center-right';

export type BubbleTextAlign = 'left' | 'center' | 'right';

export interface OnboardingStep {
  id: number;
  scene: OnboardingScene;
  /** Значение data-onboarding-id целевого элемента */
  target?: string;
  text: string;
  placement: TooltipPlacement;
  /** Точка на target, куда указывает хвостик пузырька */
  bubbleAnchor?: BubbleAnchor;
  /** Отступ пузырька от целевого элемента (px). По умолчанию — 12 */
  bubbleGap?: number;
  /** Длина хвостика пузырька (px). По умолчанию — 10 */
  bubbleTailSize?: number;
  /** Позиция хвостика на пузырьке (px от края). По умолчанию — 24 */
  bubbleTailOffset?: number;
  /** Сдвиг пузырька вместе с хвостиком по горизонтали (px). Отрицательный — влево */
  bubbleShiftX?: number;
  /** Сдвиг пузырька вместе с хвостиком по вертикали (px). Отрицательный — вниз */
  bubbleShiftY?: number;
  /** Размер шрифта текста и кнопки внутри пузырька (px). По умолчанию — 14 */
  bubbleFontSize?: number;
  /** Межстрочный интервал текста внутри пузырька (px). По умолчанию — fontSize × 1.625 */
  bubbleLineHeight?: number;
  /** Межбуквенный интервал текста и кнопки внутри пузырька (px). По умолчанию — 0 */
  bubbleLetterSpacing?: number;
  /** Выравнивание текста внутри пузырька/оверлея */
  bubbleTextAlign?: BubbleTextAlign;
  /** Переопределить сторону хвостика (по умолчанию выводится из placement) */
  bubbleTailSide?: BubbleTailSide;
  demoPayload?: DemoPayload;
}

/** Демо-состояния передаются в панели через DashboardClient (TASK-2) */
export interface OnboardingDemoLogEntry {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'INFO';
  message: string;
  createdAt: string;
}

export interface DemoPayload {
  crackDemo?: CrackDemoState;
  decipherDemo?: DecipherDemoState;
  rdpDemo?: RdpDemoState;
  /** Бутафорские записи «Истории действий» (шаг 10) */
  demoLogEntries?: OnboardingDemoLogEntry[];
}

/** Фаза демо-панели взломщика — задает, что рендерить в demo-режиме */
export type CrackDemoPhase = 'launch' | 'playing' | 'completed';

export interface CrackDemoAttempt {
  word: string;
  positions: LetterStatus[];
}

export interface CrackDemoState {
  slotKey: string;
  phase: CrackDemoPhase;
  /** Список попыток для demo playing (шаги 5–8) */
  attempts?: CrackDemoAttempt[];
  /** Какая часть доски подсвечивается: список слов (шаг 5) или панель попыток (шаги 6–8) */
  wordleSpotlight?: 'word-list' | 'attempt-panel';
  /** Значение поля «Ключ» в demo playing (шаг 8) */
  inputWord?: string;
  /** Данные экрана «Доступ предоставлен» в demo completed (шаги 9–10) */
  resultPassword?: string;
  targetUrl?: string;
  targetEmail?: string;
  /** Показать «скопировано» на экране completed (шаг 10) */
  passwordCopied?: boolean;
}

/** Фаза демо-панели дешифратора */
export type DecipherDemoPhase = 'launch' | 'playing' | 'completed';

export interface DecipherDemoState {
  slotKey: string;
  phase?: DecipherDemoPhase;
  /** Demo playing: зашифрованное слово (шаги 13–15) */
  encryptedWord?: string;
  cipherKey?: string;
  folderName?: string;
  playfairTable?: string[][];
  /** Значение поля «Расшифрованное слово» */
  inputWord?: string;
  /** Demo completed: путь к папке (шаг 16) */
  folderPath?: string;
  /** Demo completed: пароль папки (шаг 16) */
  folderPassword?: string;
  /** Показать «скопировано» на экране completed (шаг 16) */
  passwordCopied?: boolean;
}

import type { PuzzleField } from '@/lib/rdp/types';

export type RdpDemoPhase = 'launch' | 'puzzle';

export interface RdpDemoState {
  /** Фаза демо-панели RDP: форма IP (шаг 18) или пазл (шаги 19–20) */
  phase?: RdpDemoPhase;
  /** Demo puzzle: скриптовое поле (шаги 19–20) */
  puzzleField?: PuzzleField;
}
