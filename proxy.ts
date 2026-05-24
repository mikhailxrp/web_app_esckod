import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const proxy = auth((req) => {
  const session = req.auth;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    if (session.user.type !== 'PLAYER') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin-login') {
    if (!session) {
      return NextResponse.redirect(new URL('/admin-login', req.url));
    }

    if (session.user.type !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
