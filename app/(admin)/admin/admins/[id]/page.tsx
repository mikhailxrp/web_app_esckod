import { notFound } from 'next/navigation';
import { adminAuth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { AdminDetail } from '@/components/admin/admins/AdminDetail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Детали администратора',
};

export default async function AdminDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { id } = await params;

  const admin = await prisma.adminUser.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!admin) {
    notFound();
  }

  const session = await adminAuth();
  const currentAdminId = session?.user?.id ?? '';

  const serialized = {
    ...admin,
    createdAt: admin.createdAt.toISOString(),
    lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
  };

  return <AdminDetail admin={serialized} currentAdminId={currentAdminId} />;
}
