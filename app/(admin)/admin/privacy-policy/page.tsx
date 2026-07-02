import { prisma } from '@/lib/prisma';
import { PrivacyPolicyEditorForm } from '@/components/admin/privacy-policy/PrivacyPolicyEditorForm';

export const metadata = {
  title: 'Политика конфиденциальности',
};

export default async function PrivacyPolicyPage(): Promise<React.ReactElement> {
  const settings = await prisma.appSettings.findFirst();

  if (!settings) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold text-admin-accent mb-4">
          Политика конфиденциальности
        </h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-700">
          Настройки не инициализированы. Запустите сидер для создания записи AppSettings.
        </div>
      </div>
    );
  }

  const initialData = {
    privacyPolicyText: settings.privacyPolicyText,
    updatedAt: settings.updatedAt.toISOString(),
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-admin-accent mb-6">
        Политика конфиденциальности
      </h1>
      <PrivacyPolicyEditorForm initialData={initialData} />
    </div>
  );
}
