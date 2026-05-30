'use client';

import { SessionProvider } from 'next-auth/react';

export function AdminAuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <SessionProvider basePath="/api/auth-admin">{children}</SessionProvider>;
}
