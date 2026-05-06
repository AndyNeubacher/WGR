import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/auth.config';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  if (!req.auth) {
    if (pathname !== '/login') return NextResponse.redirect(new URL('/login', req.url));
    return NextResponse.next();
  }

  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (role === 'technician' && pathname.startsWith('/manager')) {
    return NextResponse.redirect(new URL('/gauges', req.url));
  }

  if (
    role === 'manager' &&
    (pathname === '/' ||
      pathname.startsWith('/capture') ||
      pathname.startsWith('/gauges') ||
      pathname.startsWith('/readings'))
  ) {
    return NextResponse.redirect(new URL('/manager/readings', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
