# i18n Phase 1 Complete

**Branch:** `feature/i18n-foundation`  
**Date:** 2026-05-23  
**Commits:** 13 commits (see `git log --oneline feature/i18n-foundation ^main`)

---

## What was done

### Infrastructure

| File | Change |
|------|--------|
| `i18n/config.ts` | Locales: `['sl', 'en']`, defaultLocale: `sl`, localePrefix: `always` |
| `i18n/routing.ts` | `defineRouting(...)` — used by both middleware and navigation |
| `i18n/navigation.ts` | `createNavigation(routing)` — locale-aware `Link`, `useRouter`, `usePathname`, `redirect` |
| `i18n/request.ts` | Server-side message loader — dynamically imports all 18 namespaces |
| `next.config.ts` | `withSentryConfig(withNextIntl(nextConfig), ...)` |
| `proxy.ts` | Renamed from `middleware.ts`; function renamed `middleware` → `proxy` (Next.js 16 requirement) |

### Route restructuring

All user-facing pages moved under `app/[locale]/`:

- Auth: `login`, `signup`, `forgot-password`, `auth/confirm`, `auth/confirm-error`, `auth/reset-password`, `auth/check-email`
- App: `dashboard`, `dashboard/new`, `termini`, `termini/[id]`, `clients`, `clients/[id]`, `storitve`, `staff`, `staff/[id]`, `reminders`, `lost-leads`, `asistent`, `chatbot-plus`, `analytics`, `obvestila`
- Settings: `nastavitve`, `nastavitve/splosno`, `nastavitve/delovni-cas`, `nastavitve/zaposleni`, `nastavitve/zaposleni/[id]`, `nastavitve/storitve`, `nastavitve/storitve/[id]`, `nastavitve/spletni-narocilnik`, `nastavitve/receptionist`, `nastavitve/integracije`, `nastavitve/obvestila`, `nastavitve/billing`
- Other: `onboarding`, `billing`, `rezervacije`, `promotions`, `koledar`

**Excluded from locale routing** (kept in place):
- `app/auth/callback/route.ts` — Google OAuth handler; `redirectTo` URL has no locale prefix
- `app/register/[slug]/` — client self-registration; excluded via regex in proxy
- Internal dev pages (`app/app/`, `app/calendar/`, `app/bookings/`, `app/settings/`) — English-only, excluded via proxy

### Layouts

- `app/layout.tsx` — minimal shell: `return children` (no html/body)
- `app/[locale]/layout.tsx` — full layout: `<html lang={locale}>`, fonts, `NextIntlClientProvider`, `generateStaticParams`

### Message namespaces (18 total)

| Namespace | sl | en |
|-----------|----|----|
| `common` | Fully extracted | `[EN PENDING]` values |
| `auth` | Fully extracted | `[EN PENDING]` values |
| 16 others | `{}` placeholder | `{}` placeholder |

### Language switcher

- `components/layout/LanguageSwitcher.tsx` — switches URL locale, sets `NEXT_LOCALE` cookie, saves `preferred_language` to `Podatki podjetij` via Supabase
- Integrated into `components/layout/AppBar.tsx` profile dropdown (between Paketi and Odjava)

### Supabase migration (DO NOT RUN YET)

`supabase/migrations/1779563134_add_preferred_language.sql`

Adds `preferred_language VARCHAR(2) NOT NULL DEFAULT 'sl'` with a CHECK constraint to `Podatki podjetij`. Run this manually in the Supabase SQL editor when ready to deploy.

### Bug fix

`app/[locale]/lost-leads/page.tsx` line 359: "There are currently no inactive customers." → "Trenutno ni neaktivnih strank."

### Deleted

- `app/services/page.tsx` — duplicate of `/storitve`
- `app/register/page.tsx` — legacy, superseded by `/signup`

---

## What is NOT done (Phase 2 / later)

- **`[EN PENDING]` translations** — 35 keys in `messages/en/common.json`, auth strings in `messages/en/auth.json`. Replace prefixes with real English.
- **Remaining 16 namespaces** — all are `{}` placeholders. Extract strings from each page in Phase 2.
- **Post-login locale sync** — redirect to company's `preferred_language` after sign-in. Requires the migration to run first. See `i18n-post-login-todo.md`.
- **`app/auth/callback/route.ts`** — after migration runs, update to read `preferred_language` and redirect to `/{preferred_language}/dashboard` instead of `/dashboard`.
- **Dev pages i18n audit** — `app/app/`, `app/calendar/`, `app/bookings/` have a `TODO(i18n-review)` comment. Confirm if they should be removed or kept.
- **`useRouter` / `Link` audit** — pages that were moved but not yet extracted (16 namespaces) may still import from `next/navigation` instead of `@/i18n/navigation`. Fix as each page is extracted in Phase 2.

---

## How to continue

1. Run the Supabase migration (`supabase/migrations/1779563134_add_preferred_language.sql`)
2. Regenerate Supabase types (`npx supabase gen types typescript --local > types/supabase.ts`)
3. Implement post-login locale sync per `i18n-post-login-todo.md`
4. Phase 2: extract remaining 16 namespaces one page group at a time

---

## Verification

```bash
# TypeScript — must pass clean
npx tsc --noEmit

# Dev server — must start without warnings or errors
npm run dev
```

Both verified clean as of this commit.
