'use client';

import { AlertTriangle } from 'lucide-react';

interface PlaceholderWarningBannerProps {
  supportEmail: string;
  privacyPolicyUrl: string;
}

export function PlaceholderWarningBanner({
  supportEmail,
  privacyPolicyUrl,
}: PlaceholderWarningBannerProps): React.ReactElement | null {
  const hasPlaceholder =
    supportEmail.includes('example.com') ||
    privacyPolicyUrl.includes('example.com');

  if (!hasPlaceholder) return null;

  return (
    <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
      <p>
        Одно или несколько полей содержат тестовые значения (<code className="font-mono text-xs">example.com</code>).
        Перед публикацией замените их реальными данными.{' '}
        По законодательству РФ (152-ФЗ, ст.&nbsp;9, ч.&nbsp;4) политика обработки персональных данных
        должна быть доступна по действительному URL.
      </p>
    </div>
  );
}
