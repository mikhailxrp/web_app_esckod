import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Игровая зона — редирект на /login
  if (pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Админская зона (кроме /admin-login) — редирект на /admin-login
  if (pathname.startsWith('/admin') && pathname !== '/admin-login') {
    return NextResponse.redirect(new URL('/admin-login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
