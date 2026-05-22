export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-center bg-no-repeat bg-[url('/assets/img/auth-bg.png')] bg-[length:75%_auto]"
    >
      {children}
    </div>
  );
}
