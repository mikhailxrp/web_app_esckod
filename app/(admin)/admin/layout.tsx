import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminNav } from '@/components/admin/layout/AdminNav';
import { AdminBanners } from '@/components/admin/layout/AdminBanners';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    redirect('/admin-login');
  }

  return (
    <div className="flex min-h-screen bg-admin-sidebar-bg">
      <AdminNav />
      <main className="flex-1 p-8 bg-white">
        <AdminBanners />
        {children}
      </main>
    </div>
  );
}
