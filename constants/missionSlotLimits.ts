export const CRACK_MAX_ATTEMPTS_MIN = 3;
export const CRACK_MAX_ATTEMPTS_MAX = 10;
export const RDP_TIMER_SECONDS_MIN = 30;
export const RDP_TIMER_SECONDS_MAX = 600;
export const RDP_GRID_SIZES = [6, 7] as const;
export type RdpGridSize = (typeof RDP_GRID_SIZES)[number];
