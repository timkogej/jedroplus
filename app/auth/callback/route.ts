import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Build the success redirect first so we can attach cookies to it
  const redirectTo = NextResponse.redirect(`${origin}/dashboard`);

  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          // Write cookies onto BOTH the cookie store AND the redirect response
          // so they survive the redirect and are available on the next request.
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              redirectTo.cookies.set(name, value, options);
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

    return redirectTo;
  } catch (err) {
    console.error('Auth callback unexpected error:', err);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }
}
