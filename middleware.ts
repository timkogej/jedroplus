import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Paths that don't require a company to be set up
const PUBLIC_PATHS = ['/login', '/register', '/onboarding', '/logout'];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Skip company check for unauthenticated users or public paths
  if (!user || isPublicPath(pathname)) {
    return supabaseResponse;
  }

  // Check if the authenticated user has a company assigned in their profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_company_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.default_company_id && !pathname.startsWith('/api/')) {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = '/onboarding';
    return NextResponse.redirect(onboardingUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
