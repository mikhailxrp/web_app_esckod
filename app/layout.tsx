import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Код доступа: корпорация",
  description: "Детективная игра",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
