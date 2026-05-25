import { MIN_VIEWPORT_HEIGHT, MIN_VIEWPORT_WIDTH } from '@/constants/screenRequirements';
import type { Device } from './device-detection';

export function isBlockedByViewport(device: Device): boolean {
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (w < MIN_VIEWPORT_WIDTH || h < MIN_VIEWPORT_HEIGHT) return true;

  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const isLikelyTablet = navigator.maxTouchPoints > 1;

  if (device === 'unknown' && (isTouch || isLikelyTablet)) {
    return true;
  }

  return false;
}
