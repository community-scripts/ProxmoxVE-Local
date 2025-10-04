import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabase } from './src/server/database';

// Paths that don't require authentication
const publicPaths = [
  '/api/auth/login',
  '/api/auth/setup',
  '/login',
  '/setup',
  '/_next',
  '/favicon',
  '/favicon.ico',
  '/favicon.png'
];

// Paths that should redirect to setup if no users exist
const protectedPaths = [
  '/',
  '/api/servers',
  '/api/trpc'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  try {
    const db = getDatabase();

    // Check if this is a first-time setup (no admin user exists)
    const adminUser = db.getUserByUsername('admin');
    if (!adminUser && protectedPaths.some(path => pathname.startsWith(path))) {
      // Redirect to setup page
      return NextResponse.redirect(new URL('/setup', request.url));
    }

    // Check for valid session
    const sessionId = request.cookies.get('session')?.value;
    if (!sessionId) {
      // Redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const session = db.getSession(sessionId);
    if (!session) {
      // Invalid session, redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('session');
      return response;
    }

    // Valid session, allow access
    return NextResponse.next();

  } catch (error) {
    console.error('Middleware error:', error);
    // On error, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};