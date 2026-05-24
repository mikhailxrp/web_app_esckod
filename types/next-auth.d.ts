import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      type: 'PLAYER' | 'ADMIN';
    } & DefaultSession['user'];
  }

  interface User {
    type: 'PLAYER' | 'ADMIN';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    type: 'PLAYER' | 'ADMIN';
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    type: 'PLAYER' | 'ADMIN';
  }
}
