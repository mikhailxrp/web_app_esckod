import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { MobileBlock } from '@/components/mobile-block/MobileBlock';
import { MobileGuard } from '@/components/mobile-block/MobileGuard';
import {
  MOBILE_BLOCK_SUBTITLE,
  MOBILE_BLOCK_TITLE,
} from '@/constants/mobileBlockText';
import { detectDeviceFromHeaders } from '@/lib/device-detection';
import './globals.css';

export const metadata: Metadata = {
  title: 'Код доступа: корпорация',
  description: 'Детективная игра',
  icons: {
    icon: '/assets/img/admin/small-logo.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.ReactElement> {
  const device = detectDeviceFromHeaders(await headers());

  if (device === 'phone') {
    return (
      <html lang="ru" data-device={device}>
        <body>
          <MobileBlock />
        </body>
      </html>
    );
  }

  return (
    <html lang="ru" data-device={device}>
      <body className="antialiased">
        <div
          className="mobile-block-fallback flex min-h-screen flex-col items-center justify-center px-6 text-center"
          aria-hidden="true"
        >
          <p className="max-w-lg font-mono text-lg text-content-primary sm:text-xl">
            {MOBILE_BLOCK_TITLE}
          </p>
          <p className="mt-4 max-w-lg font-mono text-sm text-content-secondary">
            {MOBILE_BLOCK_SUBTITLE}
          </p>
        </div>
        <MobileGuard initialDevice={device}>{children}</MobileGuard>
      </body>
    </html>
  );
}
