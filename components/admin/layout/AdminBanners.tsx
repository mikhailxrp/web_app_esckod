import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export async function AdminBanners(): Promise<React.ReactElement | null> {
  let emailIsStub = false;
  let textIsEmpty = false;

  try {
    const settings = await prisma.appSettings.findFirst();

    if (settings) {
      emailIsStub = settings.supportEmail?.includes('example.com') ?? false;
      textIsEmpty = settings.privacyPolicyText?.trim().length === 0;
    }
  } catch {
    return null;
  }

  if (!emailIsStub && !textIsEmpty) return null;

  return (
    <div className="flex flex-col gap-2 mb-6">
      {emailIsStub && (
        <Link
          href="/admin/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm hover:bg-amber-100 transition-colors"
        >
          <span className="text-amber-500 shrink-0">⚠️</span>
          <span>
            В настройках приложения остался тестовый адрес поддержки{' '}
            <strong>example.com</strong>. Заполните реальный адрес перед
            запуском.
          </span>
        </Link>
      )}
      {textIsEmpty && (
        <Link
          href="/admin/privacy-policy"
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm hover:bg-amber-100 transition-colors"
        >
          <span className="text-amber-500 shrink-0">⚠️</span>
          <span>
            Текст политики конфиденциальности не заполнен. Заполните его
            перед запуском.
          </span>
        </Link>
      )}
    </div>
  );
}
