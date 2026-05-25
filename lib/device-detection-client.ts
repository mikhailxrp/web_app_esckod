import { MIN_VIEWPORT_WIDTH } from '@/constants/screenRequirements';
import type { Device } from './device-detection';

export function isBlockedByViewport(_device: Device): boolean {
  return window.innerWidth < MIN_VIEWPORT_WIDTH;
}
