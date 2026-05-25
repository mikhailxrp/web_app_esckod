import { LogoutButton } from '@/components/auth/LogoutButton';

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="relative min-h-screen">
      {children}
      <div className="fixed bottom-4 right-4 z-content">
        <LogoutButton />
      </div>
    </div>
  );
}
