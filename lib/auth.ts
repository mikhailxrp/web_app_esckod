import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { comparePassword } from '@/lib/password';

const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

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

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  providers: [
    Credentials({
      id: 'player',
      name: 'Player',
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

        const user = await prisma.user.findUnique({
          where: { email },
          include: { accessKey: true },
        });

        if (!user) {
          return null;
        }

        if (user.isBlocked) {
          throw new Error('USER_BLOCKED');
        }

        if (user.accessKey.isBlocked) {
          throw new Error('KEY_BLOCKED');
        }

        const valid = await comparePassword(password, user.passwordHash);

        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          type: 'PLAYER' as const,
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
        token.type === 'PLAYER'
      ) {
        session.user.id = token.id;
        session.user.type = token.type;
      }

      return session;
    },
  },
});
