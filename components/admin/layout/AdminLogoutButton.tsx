'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

export function AdminLogoutButton(): React.ReactElement {
  async function handleLogout(): Promise<void> {
    try {
      await signOut({ callbackUrl: '/admin-login' });
    } catch (error) {
      console.error('Admin logout failed:', error);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-admin-nav-text transition-colors hover:bg-admin-nav-hover-bg hover:text-admin-nav-active-text"
    >
      <LogOut size={15} />
      <span>Выйти</span>
    </button>
  );
}
