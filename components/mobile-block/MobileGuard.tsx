'use client';

import { useEffect, useState } from 'react';
import type { Device } from '@/lib/device-detection';
import { isBlockedByViewport } from '@/lib/device-detection-client';
import { MobileBlock } from './MobileBlock';

interface MobileGuardProps {
  initialDevice: Device;
  children: React.ReactNode;
}

export function MobileGuard({
  initialDevice,
  children,
}: MobileGuardProps): React.ReactElement {
  const [blocked, setBlocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    return isBlockedByViewport(initialDevice);
  });

  useEffect(() => {
    const update = (): void => {
      setBlocked(isBlockedByViewport(initialDevice));
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [initialDevice]);

  if (blocked) return <MobileBlock />;

  return <>{children}</>;
}
