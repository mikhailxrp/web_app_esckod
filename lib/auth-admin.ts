import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { comparePassword } from '@/lib/password';

const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

const ADMIN_COOKIE_NAME =
  process.env.NODE_ENV === 'production'
    ? '__Secure-admin.session-token'
    : 'admin.session-token';

type CredentialKey = 'email' | 'password';

function getCredentialValue(
  credentials: Partial<Record<CredentialKey, unknown>>,
  key: CredentialKey,
): string | null {
  const value = credentials[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return key === 'email' ? value.toLowerCase().trim() : value;
}

export const {
  handlers: adminHandlers,
  auth: adminAuth,
  signIn: adminSignIn,
  signOut: adminSignOut,
} = NextAuth({
  basePath: '/api/auth-admin',
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: ADMIN_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    Credentials({
      id: 'admin',
      name: 'Admin',
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        const email = getCredentialValue(credentials ?? {}, 'email');
        const password = getCredentialValue(credentials ?? {}, 'password');

        if (!email || !password) {
          return null;
        }

        const admin = await prisma.adminUser.findUnique({
          where: { email },
        });

        if (!admin) {
          return null;
        }

        const valid = await comparePassword(password, admin.passwordHash);

        if (!valid) {
          return null;
        }

        await prisma.adminUser.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: admin.id,
          email: admin.email,
          name: 'Admin',
          type: 'ADMIN' as const,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id && user.type) {
        token.id = user.id;
        token.type = user.type;
      }

      return token;
    },
    async session({ session, token }) {
      if (
        session.user &&
        typeof token.id === 'string' &&
        token.type === 'ADMIN'
      ) {
        session.user.id = token.id;
        session.user.type = token.type;
      }

      return session;
    },
  },
});
