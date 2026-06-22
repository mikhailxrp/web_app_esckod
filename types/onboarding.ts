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
  /** Сдвиг пузырька вместе с хвостиком по вертикали (px). Положительный — вниз */
  bubbleShiftY?: number;
  demoPayload?: DemoPayload;
}

/** Демо-состояния передаются в панели через DashboardClient (TASK-2) */
export interface DemoPayload {
  crackDemo?: CrackDemoState;
  decipherDemo?: DecipherDemoState;
  rdpDemo?: RdpDemoState;
}

export interface CrackDemoState {
  slotKey: string;
}

export interface DecipherDemoState {
  slotKey: string;
}

export interface RdpDemoState {
  connectResult: 'pending' | 'success';
}
