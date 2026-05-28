# Phase 2 Batch 6 (FINAL) — Complete — ALL 18 NAMESPACES DONE

## This Batch

| Namespace | Hash | Notes |
|---|---|---|
| `onboarding` | `dece883` | Entry + 4-step create wizard + join flow |
| `analytics` | `7787115` | All 9 analytics components, charts, metrics |

## Files Changed

### Namespace: onboarding
- `messages/sl/onboarding.json` (populated)
- `messages/en/onboarding.json` (populated)
- `app/[locale]/onboarding/page.tsx`
- `app/[locale]/onboarding/create/page.tsx`
- `app/[locale]/onboarding/join/page.tsx`

### Namespace: analytics
- `messages/sl/analytics.json` (populated)
- `messages/en/analytics.json` (populated)
- `app/[locale]/analytics/page.tsx` — no changes needed (no hardcoded strings)
- `components/analytics/AnalyticsHeader.tsx`
- `components/analytics/KeyMetricsCards.tsx`
- `components/analytics/RevenueBookingsChart.tsx`
- `components/analytics/AppointmentsByServiceChart.tsx`
- `components/analytics/AppointmentsByEmployeeChart.tsx`
- `components/analytics/HourlyOccupancyHeatmap.tsx`
- `components/analytics/ClientGrowthChart.tsx`
- `components/analytics/TopPerformersTable.tsx`
- `components/analytics/RetentionCancellationAnalysis.tsx`
- `components/analytics/PromotionsAnalytics.tsx`

## Key Design Decisions

### Country storage (onboarding/create)
- Task assumed ~200 SL country names stored in DB — **actual code had 26 English names**
- Decision: keep storing English country names unchanged; translate display only
- Approach: `COUNTRIES_DATA = [{ value: 'Slovenia', key: 'si' }, ...]` — stored value unchanged, `t('create.countries.si')` for display
- Skipped i18n-iso-countries integration (no data migration needed)

### Industry storage (onboarding/create)
- DB stores SL strings (e.g. `'Frizerstvo'`) as `panoga` value
- Decision: keep storing SL strings; translate display only
- Approach: `PANOGE_DATA = [{ value: 'Frizerstvo', key: 'hairSalons' }, ...]` — stored value unchanged, `t('create.industries.hairSalons')` for display

### Day names (onboarding/create working hours)
- SL day names (`Ponedeljek`, etc.) are DB keys in `urnik` object — must not change
- Display via `DAY_TO_COMMON_KEY` mapping → `tCommon('daysLong.mon')` etc.

### Analytics status names
- `calculations.ts` returns hardcoded SL strings (`'Zaključeni'`, `'Načrtovani'`, etc.)
- `STATUS_KEYS` lookup map in `RetentionCancellationAnalysis.tsx` maps SL → translation key
- No change to lib/analytics/calculations.ts (non-i18n file)

### Analytics heatmap days
- `DAYS_OF_WEEK` from `dateUtils.ts` are SL short names
- Display via `['mon','tue',...].map(k => tCommon('daysShort.k'))` — reuses `common.daysShort`

## Verification

- `npx tsc --noEmit` → clean (no output)
- SL char grep: only intentional DB schema keys remain:
  - `create/page.tsx`: `PANOGE_DATA` stored values, `DAYS` array, `DEFAULT_URNIK` keys, `DAY_TO_COMMON_KEY` keys
  - `RetentionCancellationAnalysis.tsx`: `STATUS_KEYS` lookup map keys

## Phase 2 Closeout

- ✅ ALL 18 namespaces extracted and populated (SL + EN)
- ✅ `ls messages/sl/` → 18 JSON files, all non-empty
- ✅ TypeScript clean across full project
- ✅ No untranslated UI strings outside intentional DB schema spots
- ✅ ICU plurals + select used consistently throughout
- ✅ Brand names (`Jedro+`, `Happy Hour`, `Add-on`) preserved
- ✅ All animations, styling, click handlers preserved

## All 18 Namespaces

| # | Namespace | Key files |
|---|---|---|
| 1 | `common` | Shared buttons, status, roles, days, errors |
| 2 | `auth` | Login, register, forgot password |
| 3 | `layout` | Sidebar, navigation, breadcrumbs |
| 4 | `dashboard` | Dashboard page, widgets, appointment cards |
| 5 | `appointments` | Calendar, appointment forms |
| 6 | `clients` | Client list, detail, forms |
| 7 | `services` | Service list, forms |
| 8 | `staff` | Staff list, detail, permissions |
| 9 | `communication` | Messages, email templates |
| 10 | `notifications` | Notification center |
| 11 | `reminders` | Reminder settings |
| 12 | `lost-leads` | Lost leads tracking |
| 13 | `reservations` | Public booking page (admin view) |
| 14 | `promotions` | Discounts, add-ons, happy hours |
| 15 | `billing` | Plans, quotas, FeatureGate, paketi |
| 16 | `settings` | nastavitve hub + 5 sub-pages + SaveIndicator |
| 17 | `onboarding` | Entry + 4-step create wizard + join flow |
| 18 | `analytics` | All charts, metrics, period selectors |

## Recommended Next Steps

1. **Visual smoke test** — visit `/sl/onboarding`, `/en/onboarding/create`, `/sl/analytics`, `/en/analytics`
2. **Merge to main** — `git checkout main && git merge feature/i18n-phase2-batch6-final`
3. **Deploy to Vercel** — i18n is now production-ready
4. **Future languages** — add HR/DE/IT by copying `messages/sl/*.json` and translating
