'use client';

import { AlertTriangle } from 'lucide-react';

interface PlaceholderWarningBannerProps {
  supportEmail: string;
}

export function PlaceholderWarningBanner({
  supportEmail,
}: PlaceholderWarningBannerProps): React.ReactElement | null {
  const hasPlaceholder = supportEmail.includes('example.com');

  if (!hasPlaceholder) return null;

  return (
    <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
      <p>
        Адрес поддержки содержит тестовое значение (<code className="font-mono text-xs">example.com</code>).
        Перед публикацией замените его реальным адресом.
      </p>
    </div>
  );
}
