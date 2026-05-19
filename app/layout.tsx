import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Код доступа: корпорация',
  description: 'Детективная игра',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
