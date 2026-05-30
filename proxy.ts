import { NextResponse } from 'next/server';
import { decode } from '@auth/core/jwt';
import { auth } from '@/lib/auth';

const ADMIN_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Secure-admin.session-token'
    : 'admin.session-token';

export const proxy = auth(async (req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    const session = req.auth;

    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    if (session.user.type !== 'PLAYER') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin-login') {
    let adminType: string | undefined;
    const rawToken = req.cookies.get(ADMIN_COOKIE)?.value;

    if (rawToken) {
      try {
        const token = await decode({
          token: rawToken,
          secret: process.env.AUTH_SECRET!,
          salt: ADMIN_COOKIE,
        });
        adminType = token?.type as string | undefined;
      } catch {
        /* invalid token */
      }
    }

    if (!adminType) {
      return NextResponse.redirect(new URL('/admin-login', req.url));
    }

    if (adminType !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
