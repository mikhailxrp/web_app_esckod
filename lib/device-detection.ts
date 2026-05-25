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
