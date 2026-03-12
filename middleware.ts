import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';

const AUTH_ROUTES = ['/sign-in', '/sign-up'];

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((r) => pathname.startsWith(r));
}

function isCompanyRoute(pathname: string) {
  return pathname.startsWith('/c/');
}

function isProtectedRoute(pathname: string) {
  return pathname.startsWith('/dashboard') || isCompanyRoute(pathname);
}

/**
 * Extract a numeric companyId from `/c/[companyId]/...` paths.
 * Returns null if the pattern doesn't match or the ID isn't a valid number.
 */
function extractCompanyId(pathname: string): number | null {
  const match = pathname.match(/^\/c\/(\d+)(\/|$)/);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return isNaN(id) ? null : id;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');

  // ── Auth routes: pass through (no session needed) ──────────────
  if (isAuthRoute(pathname)) {
    return NextResponse.next();
  }

  // ── Protected routes: require session ──────────────────────────
  if (isProtectedRoute(pathname) && !sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  let res = NextResponse.next();

  // ── Refresh session cookie on every GET ────────────────────────
  if (sessionCookie && request.method === 'GET') {
    try {
      const parsed = await verifyToken(sessionCookie.value);
      const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);

      res.cookies.set({
        name: 'session',
        value: await signToken({
          ...parsed,
          expires: expiresInOneDay.toISOString(),
        }),
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        expires: expiresInOneDay,
      });
    } catch (error) {
      console.error('Error updating session:', error);
      res.cookies.delete('session');
      if (isProtectedRoute(pathname)) {
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }
    }
  }

  // ── /c/[companyId]/... — sync activeCompanyId cookie ───────────
  //
  // The actual access check (verifyCompanyAccess) happens in the
  // layout server component — not here — because middleware should
  // stay lightweight. We just persist the companyId in the cookie
  // so API routes and server actions can read it.
  const companyId = extractCompanyId(pathname);
  if (companyId !== null) {
    res.cookies.set({
      name: 'activeCompanyId',
      value: String(companyId),
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  // ── /dashboard (exact) — redirect to active company if available ─
  // Sub-routes like /dashboard/general and /dashboard/security are
  // user-level pages and should NOT be redirected.
  if (pathname === '/dashboard') {
    const activeCompanyId = request.cookies.get('activeCompanyId')?.value;
    if (activeCompanyId && /^\d+$/.test(activeCompanyId)) {
      return NextResponse.redirect(
        new URL(`/c/${activeCompanyId}/dashboard`, request.url)
      );
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs',
};
