# i18n Phase 2 Batch 5 — Complete

## Commits

| # | Hash | Namespace |
|---|------|-----------|
| 1 | `d43d963` | `billing` — billing page, success, cancel, FeatureGate, nastavitve/paketi |
| 2 | `795682a` | `settings` — nastavitve hub, splosno, podjetje, clani, sporocila, SaveIndicator |

## Files changed

### Namespace: billing
- `messages/sl/billing.json` (new)
- `messages/en/billing.json` (new)
- `app/[locale]/billing/page.tsx`
- `app/[locale]/billing/success/page.tsx`
- `app/[locale]/billing/cancel/page.tsx`
- `components/billing/FeatureGate.tsx`
- `app/[locale]/nastavitve/paketi/page.tsx`

### Namespace: settings
- `messages/sl/settings.json` (new)
- `messages/en/settings.json` (new)
- `app/[locale]/nastavitve/page.tsx`
- `app/[locale]/nastavitve/splosno/page.tsx`
- `app/[locale]/nastavitve/podjetje/page.tsx`
- `app/[locale]/nastavitve/clani/page.tsx`
- `app/[locale]/nastavitve/sporocila/page.tsx`
- `components/settings/SaveIndicator.tsx`

## Key patterns used

- `planKey()` helper: maps `JEDRO_PLUS → jedroPlus` for dynamic `t()` / `t.raw()` calls
- `t.raw('plans.jedroPlus.features') as string[]` for feature arrays
- ICU select for role-conditional page title: `{role, select, staff {Plans} other {Plans and quotas}}`
- ICU plural (SL 4 forms): `{count, plural, =1 {…} =2 {…} few {…} other {…}}`
- `t` prop-passing to sub-components: `t: ReturnType<typeof useTranslations<'billing'>>`
- `common.roles` reused in `RoleBadge`
- `common.daysLong` reused for working hours day display (DB keys kept as-is)
- `permissionSections` refactored to use `sectionKey` strings → `t('members.permissions.sections.{sectionKey}')`
- `KNOWN_ENTITY_TYPES` Set + safe fallback for message entity type labels

## DB schema exceptions (intentional SL chars in TSX)

`podjetje/page.tsx` retains SL strings as Supabase column keys:
- `DAYS_OF_WEEK` / `DAY_KEYS`: `'Četrtek'` etc. — keyed to DB working hours object
- `'Davčna številka'` — actual column name in `Podatki podjetij` table

## Verification

- `npx tsc --noEmit` → clean (no output)
- SL char grep: only DB schema keys remain in modified TSX files
