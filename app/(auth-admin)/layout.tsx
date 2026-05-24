import Image from 'next/image';

export default function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[url('/assets/img/admin/auth-layout-bg.jpg')] bg-cover bg-center bg-no-repeat flex items-center justify-center px-4 py-10">
      <div className="absolute top-[114px] left-1/2 -translate-x-1/2">
        <Image
          src="/assets/img/admin/logo-admin-login.png"
          alt="Эскапист"
          width={520}
          height={74}
          priority
        />
      </div>
      {children}
    </div>
  );
}
