import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ToastContainer } from '@/components/ui/Toast';

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    redirect('/login');
  }

  return (
    <div className="relative min-h-screen">
      {children}
      <ToastContainer />
    </div>
  );
}
