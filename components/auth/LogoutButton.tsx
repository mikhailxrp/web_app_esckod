'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';

export function LogoutButton(): React.ReactElement {
  async function handleLogout(): Promise<void> {
    try {
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  return (
    <Button type="button" variant="ghost" onClick={() => void handleLogout()}>
      Выйти
    </Button>
  );
}
