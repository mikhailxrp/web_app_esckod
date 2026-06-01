import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { UserStateView } from '@/components/admin/users/UserStateView';
import type { UserStateSnapshot } from '@/types/admin-users';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Пользователь — снапшот',
};

export default async function UserDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { id } = await params;
  const headersList = await headers();
  const cookie = headersList.get('cookie') ?? '';

  const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/admin/users/${id}/state`, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    throw new Error('Не удалось загрузить данные пользователя');
  }

  const snapshot: UserStateSnapshot = await res.json();

  return <UserStateView snapshot={snapshot} />;
}
