import { ToastContainer } from '@/components/ui/Toast';

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="relative min-h-screen">
      {children}
      <ToastContainer />
    </div>
  );
}
