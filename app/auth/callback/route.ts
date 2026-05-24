import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  try {
    const cookieStore = await cookies();

    // Collect cookies so we can attach them to whichever redirect URL we build
    const collectedCookies: Array<{ name: string; value: string; options: Partial<ResponseCookie> }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              collectedCookies.push({ name, value, options });
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error.message);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // Determine preferred locale from company settings
    let preferred = 'sl';

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('default_company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.default_company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('company_id')
          .eq('id', profile.default_company_id)
          .maybeSingle();

        if (company?.company_id) {
          const { data: companyData } = await supabase
            .from('Podatki podjetij')
            .select('preferred_language')
            .eq('ID Podjetja', company.company_id)
            .maybeSingle();

          preferred = companyData?.preferred_language ?? 'sl';

          const redirectTo = NextResponse.redirect(`${origin}/${preferred}/dashboard`);
          collectedCookies.forEach(({ name, value, options }) => {
            redirectTo.cookies.set(name, value, options);
          });
          return redirectTo;
        }
      }

      // New user with no company yet → onboarding
      const redirectTo = NextResponse.redirect(`${origin}/sl/onboarding`);
      collectedCookies.forEach(({ name, value, options }) => {
        redirectTo.cookies.set(name, value, options);
      });
      return redirectTo;
    }

    // Fallback — session exists but getUser failed; go to default locale dashboard
    const redirectTo = NextResponse.redirect(`${origin}/sl/dashboard`);
    collectedCookies.forEach(({ name, value, options }) => {
      redirectTo.cookies.set(name, value, options);
    });
    return redirectTo;
  } catch (err) {
    console.error('Auth callback unexpected error:', err);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }
}
