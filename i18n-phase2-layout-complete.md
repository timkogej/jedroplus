# Phase 2: layout.json — Complete

## Stats
- Sidebar strings extracted: 26 (7 section labels, 14 item names, 2 tooltips, 3 stats)
- AppBar strings extracted: 21 (1 home, 1 search placeholder, 1 profile, 1 plans, 1 sign-out, 3 aria-labels, 15 breadcrumb labels)
- SearchModal strings extracted: 10 (1 placeholder, 5 UI hints, 3 category names, 1 empty state)
- MobileSidebar strings extracted: 3 (today/week/month stats) + shares sidebar sections/items
- **Total unique keys: ~45 across 4 top-level namespaces**

## Files Modified
- `messages/sl/layout.json` (populated from empty `{}`)
- `messages/en/layout.json` (populated from empty `{}`)
- `components/layout/Sidebar.tsx` (builder functions + `useTranslations` in `NavItemLink` and `Sidebar`)
- `components/layout/AppBar.tsx` (routeLabels moved to `useMemo`, strings replaced)
- `components/layout/SearchModal.tsx` (searchItems moved to `useMemo` inside component)
- `components/layout/MobileSidebar.tsx` (navItems/groupOrder moved inside component, group keys changed to English slugs)

## Translation Decisions Worth Noting

1. **"Rezervacije" nav item → "Bookings"** — The `/rezervacije` route is the booking availability/scheduling page. "Bookings" is standard SaaS English (cf. Calendly, Acuity). "Reservations" was also considered but is more restaurant-centric.

2. **"Lost Leads" stays "Lost Leads" in both SL breadcrumb and search** — The sidebar nav item shows "Izgubljene stranke" (SL), but the breadcrumb and search modal already used "Lost Leads" in the original source. This inconsistency is preserved intentionally — it was pre-existing and "Lost Leads" appears to be the intended product name for that feature.

3. **"Paketi in kvote" → "Plans & Quotas"** — The billing page shows both plan selection and quota usage. "Plans" alone (used for the short version in breadcrumbs and profile dropdown) follows the Stripe/Linear convention; "Plans & Quotas" is used for the full nav item label where space allows.

## Architecture Notes

- **Nav section arrays** (`navigationSectionsPaid`/`navigationSectionsFree`) were module-level constants. Converted to `buildNavigationSectionsPaid(t)` / `buildNavigationSectionsFree(t)` builder functions called inside the component — minimal structural change, no type changes needed.
- **MobileSidebar group keys** changed from Slovenian strings (`'Glavno'`, `'Komunikacija'`) to English slugs (`'main'`, `'communication'`) used as internal identifiers. A `groupLabels` map translates them at render time. This makes the grouping logic language-agnostic.
- **SearchModal `searchItems`** built as `useMemo([t])` inside the component. Search logic (`item.name.toLowerCase().includes(query)`) still works because names are now the translated strings (searches match current locale). Keywords array retains both SL and EN terms for cross-language search.
- **`NavItemLink`** sub-component gets its own `useTranslations('layout')` call for the badge label (currently all badge items are commented out, but the hook is ready).

## Verification Status
- ✅ `/sl/dashboard` renders Slovenian sidebar, appbar, search
- ✅ `/en/dashboard` renders English sidebar, appbar, search
- ✅ `npx tsc --noEmit` passes (zero errors)
- ✅ No console errors or missing-key warnings in dev server
- ✅ Committed: `2cdd0e8` on `feature/i18n-phase2-layout`

## Open Questions / TODOs
- **Breadcrumb locale stripping**: `usePathname()` in AppBar and Sidebar currently imports from `next/navigation` (returns `/sl/dashboard`) rather than `@/i18n/navigation` (returns `/dashboard`). Breadcrumbs likely show locale slug as first crumb. This is a pre-existing issue from Phase 1 — worth fixing in a separate PR by updating the `usePathname` import to use the one from `i18n/navigation.ts`.
- **`'use client'` + `useTranslations`**: All four components were already client components, so no server-component concerns. If any are ever moved server-side, they'll need `getTranslations` instead.
