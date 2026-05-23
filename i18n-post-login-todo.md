# TODO: Post-Login Locale Sync

## What needs to happen

After a user logs in, if their company has a `preferred_language` different from the
current URL locale, they should be redirected to the matching locale version.

Example: user visits `/sl/login`, logs in, but their company's `preferred_language` = `en` →
redirect to `/en/dashboard` instead of `/sl/dashboard`.

## Prerequisite

**Run the Supabase migration first:**
`supabase/migrations/1779563134_add_preferred_language.sql`

Then regenerate Supabase types.

## Where to implement

**Option A — Login page** (`app/[locale]/login/page.tsx`):

After a successful `signInWithPassword` call and before `router.push('/dashboard')`,
fetch the company's preferred_language:

```ts
const { data: company } = await supabase
  .from('Podatki podjetij')
  .select('preferred_language')
  .eq('company_id', companyData.company_id)
  .maybeSingle();

const preferred = company?.preferred_language ?? 'sl';
if (preferred !== currentLocale) {
  router.push('/dashboard', { locale: preferred as 'sl' | 'en' });
} else {
  router.push('/dashboard');
}
```

**Option B — Middleware** (`middleware.ts`):

After the company check passes (user has a company), additionally read
`preferred_language` from `Podatki podjetij` and compare with the URL locale.
If they differ, redirect to the preferred locale.

This is slightly more expensive (extra DB query on every request) but handles
all entry points (Google OAuth, direct URL, etc.).

**Recommended**: Option A for email/password login + update `app/auth/callback/route.ts`
to read preferred_language after exchangeCodeForSession for Google OAuth.

## Note on auth/callback

`app/auth/callback/route.ts` currently redirects to `/dashboard` (no locale prefix).
The next-intl middleware will add the locale prefix based on Accept-Language.
After the migration runs, update the callback to read `preferred_language` from the DB
and redirect to `/{preferred_language}/dashboard` directly.
