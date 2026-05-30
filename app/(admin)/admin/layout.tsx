import { Roboto } from 'next/font/google';
import { redirect } from 'next/navigation';
import { adminAuth } from '@/lib/auth-admin';
import { AdminNav } from '@/components/admin/layout/AdminNav';
import { AdminBanners } from '@/components/admin/layout/AdminBanners';
import { AdminLogoutButton } from '@/components/admin/layout/AdminLogoutButton';

const roboto = Roboto({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const session = await adminAuth();

  if (!session || session.user.type !== 'ADMIN') {
    redirect('/admin-login');
  }

  return (
    <div className={`${roboto.variable} admin-zone flex min-h-screen bg-admin-sidebar-bg`}>
      <AdminNav />
      <main className="flex-1 flex flex-col bg-white">
        <div className="flex justify-end px-6 py-3 border-b border-gray-100">
          <AdminLogoutButton />
        </div>
        <div className="flex-1 p-8">
          <AdminBanners />
          {children}
        </div>
      </main>
      {/* Portal-контейнер для модальных окон — внутри admin-zone, чтобы CSS-переменные и шрифт наследовались */}
      <div id="admin-portal-root" />
    </div>
  );
}
