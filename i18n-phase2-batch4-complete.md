# Phase 2 Batch 4 — Complete

## Stats
- **reservations.json**: ~75 keys — covers rezervacije page + BookingSettingsModal
- **promotions.json**: ~90 keys — covers layout + discounts, add-ons, happy-hours sub-pages

## Commits
- `1e57d8d` feat(i18n): extract reservations namespace (booking page admin)
- `9a04d5b` feat(i18n): extract promotions namespace (discounts, add-ons, happy hours)

## Files Changed
**Reservations**
- `messages/sl/reservations.json` — populated from empty
- `messages/en/reservations.json` — populated from empty
- `app/[locale]/rezervacije/page.tsx` — useTranslations('reservations'); redesigned data arrays to use `designKey` instead of hardcoded SL strings
- `components/booking/BookingSettingsModal.tsx` — useTranslations('reservations'); t prop passed to ChannelPicker subcomponent

**Promotions**
- `messages/sl/promotions.json` — populated from empty
- `messages/en/promotions.json` — populated from empty
- `app/[locale]/promotions/layout.tsx` — useTranslations('promotions'); tab labels + header
- `app/[locale]/promotions/discounts/page.tsx` — full extraction incl. ICU plural serviceCount
- `app/[locale]/promotions/add-ons/page.tsx` — full extraction incl. ICU plural addOnCount (count key)
- `app/[locale]/promotions/happy-hours/page.tsx` — full extraction; DAYS_SL replaced with common.daysShort (Sunday-first mapped)

## Pluralization Patterns

**Discounts — serviceCount** (SL 4 forms):
```json
"serviceCount": "{count, plural, =1 {1 storitev} =2 {2 storitvi} few {{count} storitve} other {{count} storitev}}"
```
EN: `"{count, plural, =1 {1 service} other {{count} services}}"`

**Add-ons — count** (SL 4 forms, brand name preserved):
```json
"count": "{count, plural, =1 {1 Add-on} =2 {2 Add-ona} few {{count} Add-oni} other {{count} Add-onov}}"
```
EN: `"{count, plural, =1 {1 Add-on} other {{count} Add-ons}}"`

**Happy Hours — count** (same in both languages, English brand term):
```json
"count": "{count} happy hours"
```
(plain string — "happy hours" is invariant in SL colloquial usage)

## Brand Name Handling
- ✅ **Happy Hour / Happy Hours** — kept untranslated in both locales; appears as `"newButton": "Nov Happy Hour"` in SL and `"New Happy Hour"` in EN
- ✅ **Add-on / Add-ons** — kept untranslated and capitalized per brand convention
- ✅ **Magazine** — kept as-is (already EN in original SL copy)
- ✅ **Casino** — kept as-is (already EN in original SL copy)
- ✅ **Premium** — badge label kept untranslated (brand/product tier)

## Translation Decisions
1. **BookingDesign data array refactored**: Removed hardcoded `name/subtitle/description` fields from `STANDARD_DESIGNS` / `PREMIUM_DESIGNS`. Replaced with `designKey: string` — JSON lookup via `t(\`designs.${design.designKey}.name\`)`. Cleaner, no SL strings in code.
2. **Day labels — common.daysShort reuse**: Happy-hours page used `DAYS_SL` from `lib/promotions.ts` (Sunday-first `['Ned','Pon',...]`). Replaced with a translated array built from `tc('daysShort.sun/mon/...')` in Sunday-first order, reusing common.json without duplicating day names.
3. **Status labels — common.status reuse**: `Aktiven/Neaktiven/Potekel` pulled from `tc('status.active/inactive/expired')` across all promotions pages; not duplicated in promotions.json.
4. **ChannelPicker in BookingSettingsModal**: Subcomponent needed the `t` function — passed as a prop typed as `ReturnType<typeof useTranslations<'reservations'>>` to avoid a second `useTranslations` call.
5. **promotions.shared**: Shared strings (`cancelButton`, `deleteButton`, `createButton`, `saveButton`, `cannotUndo`, `activeLabel`, `discountType`, `valueUnit`, `serviceSearch`, `noServices`) extracted once and reused across all 3 sub-pages.

## Verification
- ✅ `/sl/rezervacije` — SL texts render, settings icon works
- ✅ `/en/rezervacije` — EN texts render
- ✅ `/sl/promotions/discounts` — SL texts, plural serviceCount correct at 1/2/3/5
- ✅ `/en/promotions/discounts` — EN texts
- ✅ `/sl/promotions/add-ons` — SL texts, Add-on count plural correct
- ✅ `/en/promotions/add-ons` — EN texts
- ✅ `/sl/promotions/happy-hours` — SL texts, day abbreviations from common.daysShort
- ✅ `/en/promotions/happy-hours` — EN texts, day abbreviations in EN
- ✅ TypeScript: `npx tsc --noEmit` — clean (no output)
- ✅ Slovenian char grep: zero SL characters remaining in modified `.tsx` files

## Open Questions
- `happyHours.count` uses a plain string `"{count} happy hours"` for SL (not ICU plural) — "happy hours" in SL is typically used invariantly in colloquial speech. If the team prefers a proper SL plural form, it could be updated to an ICU pattern.
- The booking design "Casino" is not in the original batch plan (listed 5 designs, actual code has 6). Added `casino` key to cover the existing premium design card.
