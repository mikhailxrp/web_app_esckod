import { prisma } from '@/lib/prisma';

export const metadata = {
  title: 'Политика конфиденциальности',
};

export default async function PrivacyPolicyPublicPage(): Promise<React.ReactElement> {
  const settings = await prisma.appSettings.findFirst();
  const text = settings?.privacyPolicyText?.trim() ?? '';

  return (
    <section
      aria-labelledby="privacy-policy-title"
      className="auth-card privacy-policy-card max-h-[85vh] flex flex-col overflow-hidden"
    >
      <header className="auth-card__header shrink-0">
        <h1 id="privacy-policy-title" className="auth-card__title">
          Политика конфиденциальности
        </h1>
      </header>

      <div className="auth-card__body flex-1 min-h-0 overflow-y-auto">
        {text ? (
          <div className="tiptap-content" dangerouslySetInnerHTML={{ __html: text }} />
        ) : (
          <p>Текст политики конфиденциальности пока не опубликован.</p>
        )}
      </div>
    </section>
  );
}
