export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 bg-center bg-no-repeat bg-[url('/assets/img/auth-bg.png')] bg-[length:75%_auto]">
      {children}
    </div>
  );
}

