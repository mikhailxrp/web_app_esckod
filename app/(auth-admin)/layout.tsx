import Image from 'next/image';
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

export default function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${roboto.variable} admin-zone relative min-h-screen bg-[url('/assets/img/admin/auth-layout-bg.jpg')] bg-cover bg-center bg-no-repeat flex items-center justify-center px-4 py-10`}>
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
