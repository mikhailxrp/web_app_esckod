import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export async function AdminBanners(): Promise<React.ReactElement | null> {
  let showBanner = false;

  try {
    const settings = await prisma.appSettings.findFirst();

    if (settings) {
      const emailIsStub = settings.supportEmail?.includes('example.com') ?? false;
      const urlIsStub = settings.privacyPolicyUrl?.includes('example.com') ?? false;
      showBanner = emailIsStub || urlIsStub;
    }
  } catch {
    return null;
  }

  if (!showBanner) return null;

  return (
    <Link
      href="/admin/settings"
      className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm hover:bg-amber-100 transition-colors"
    >
      <span className="text-amber-500 shrink-0">⚠️</span>
      <span>
        В настройках приложения остались заглушки{' '}
        <strong>example.com</strong>. Заполните реальные данные перед
        запуском.
      </span>
    </Link>
  );
}
