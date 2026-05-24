import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

// Paths that don't require a company to be set up (without locale prefix)
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/register', // legacy — still public
  '/onboarding',
  '/logout',
  '/forgot-password',
  '/auth',
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. OAuth callback — route handler, no locale prefix needed
  if (pathname === '/auth/callback') {
    return NextResponse.next();
  }

  // 2. Client self-registration — already multilingual, excluded from locale routing
  if (/^\/register\/[^/]+/.test(pathname)) {
    return NextResponse.next();
  }

  // 3. Internal dev pages — English UI, not locale-routed
  // TODO(i18n-review): confirm if these dev pages should be removed or included in i18n
  const devPaths = ['/app', '/calendar', '/bookings', '/settings'];
  if (devPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // 4. Run i18n middleware — handles locale detection, URL prefix, NEXT_LOCALE cookie
  const intlResponse = intlMiddleware(request);

  // If next-intl is redirecting (adding locale prefix), return immediately.
  // Auth check will run on the next request once the locale prefix is in the URL.
  if (intlResponse.status !== 200) {
    return intlResponse;
  }

  // 5. Refresh Supabase session
  const { supabaseResponse, user, supabase } = await updateSession(request);

  // Copy NEXT_LOCALE cookie from intl response to supabase response so it persists
  for (const cookie of intlResponse.cookies.getAll()) {
    supabaseResponse.cookies.set(cookie.name, cookie.value, cookie);
  }

  // 6. Determine locale and strip it for public-path matching
  const localeMatch = pathname.match(/^\/(sl|en)(\/|$)/);
  const locale = localeMatch?.[1] ?? 'sl';
  const pathnameWithoutLocale = localeMatch
    ? pathname.slice(locale.length + 1) || '/'
    : pathname;

  if (!user || isPublicPath(pathnameWithoutLocale)) {
    return supabaseResponse;
  }

  // 7. Check if the authenticated user has a company assigned
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_company_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.default_company_id && !pathname.startsWith('/api/')) {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = `/${locale}/onboarding`;
    return NextResponse.redirect(onboardingUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Match all routes except API, Next.js internals, static files, and images
    '/((?!api|_next/static|_next/image|favicon.ico|apple-icon\\.png|icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};