import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

// "/sl/…", "/en/…" — built from the configured locales so adding one is a
// config change only.
const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join('|')})(/|$)`);

// Holds the id of a user already known to have a company (see step 7).
const HAS_COMPANY_COOKIE = 'jp_has_company';

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

  // 2b. Marketing unsubscribe link — public, in the client's language
  if (/^\/unsubscribe\/[^/]+/.test(pathname)) {
    return NextResponse.next();
  }

  // 2c. Legal documents — public, five languages (/legal/<lang>/<doc>)
  if (/^\/legal\//.test(pathname)) {
    return NextResponse.next();
  }

  // 3. Old pages from before the current app (untranslated, blank when signed
  // out): send them to the page that replaced each one.
  const LEGACY_REDIRECTS: Record<string, string> = {
    '/app': '/dashboard',
    '/calendar': '/koledar',
    '/bookings': '/termini',
    '/settings': '/nastavitve',
  };
  const legacy = Object.keys(LEGACY_REDIRECTS).find((p) => pathname === p || pathname.startsWith(p + '/'));
  if (legacy) {
    const target = request.nextUrl.clone();
    target.pathname = LEGACY_REDIRECTS[legacy];
    return NextResponse.redirect(target);
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
  const localeMatch = pathname.match(LOCALE_PREFIX);
  const locale = localeMatch?.[1] ?? routing.defaultLocale;
  const pathnameWithoutLocale = localeMatch
    ? pathname.slice(locale.length + 1) || '/'
    : pathname;

  if (!user || isPublicPath(pathnameWithoutLocale)) {
    return supabaseResponse;
  }

  // 7. Check if the authenticated user has a company assigned. The answer is
  // remembered per user for a few hours, so ordinary page changes skip this
  // database round trip.
  if (request.cookies.get(HAS_COMPANY_COOKIE)?.value === user.id) {
    return supabaseResponse;
  }

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

  if (profile?.default_company_id) {
    supabaseResponse.cookies.set(HAS_COMPANY_COOKIE, user.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 12,
    });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Match all routes except API, Next.js internals, static files, and images
    '/((?!api|_next/static|_next/image|favicon.ico|apple-icon\\.png|icon\\.png|manifest\\.webmanifest|sw\\.js|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
};
