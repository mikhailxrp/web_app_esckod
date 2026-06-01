import { prisma } from '@/lib/prisma';
import { AppSettingsForm } from '@/components/admin/app-settings/AppSettingsForm';

export const metadata = {
  title: 'Системные настройки',
};

export default async function SettingsPage(): Promise<React.ReactElement> {
  const settings = await prisma.appSettings.findFirst();

  if (!settings) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold text-admin-accent mb-4">
          Системные настройки
        </h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-700">
          Настройки не инициализированы. Запустите сидер для создания записи AppSettings.
        </div>
      </div>
    );
  }

  const initialData = {
    id: settings.id,
    supportEmail: settings.supportEmail,
    privacyPolicyUrl: settings.privacyPolicyUrl,
    defaultMarketingConsent: settings.defaultMarketingConsent,
    updatedAt: settings.updatedAt.toISOString(),
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-admin-accent mb-6">
        Системные настройки
      </h1>
      <AppSettingsForm initialData={initialData} />
    </div>
  );
}
