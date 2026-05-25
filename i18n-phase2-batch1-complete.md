# i18n Phase 2 Batch 1 — Complete

## Branch
`feature/i18n-phase2-batch1`

## Commits
1. `feat(i18n): extract appointments namespace — termini page, modal, filters, table, status badge`
2. `feat(i18n): extract clients namespace — clients page, modal, details panel, delete modal, table`

## Namespaces extracted

### `appointments`
**Files created:**
- `messages/sl/appointments.json`
- `messages/en/appointments.json`

**Components updated:**
- `app/[locale]/termini/page.tsx` — page header, stats, errors, toasts, complete modal, delete/disabled modal props
- `components/appointments/StatusBadge.tsx` — translated labels via `statusLabels` map + `useTranslations`
- `components/appointments/AppointmentModal.tsx` — all field labels, validation errors, modal title, duration ICU plural, price/discount labels, notes, action buttons; `STATUS_OPTIONS` moved inside component body
- `components/appointments/AppointmentTable.tsx` — table headers, empty state, action button titles, pagination "od"
- `components/appointments/AppointmentFilters.tsx` — search, filter button, labels, chips; `STATUS_OPTIONS` moved inside component body
- `components/appointments/DeleteConfirmation.tsx` — all confirmation modal strings
- `components/DisabledActionModal.tsx` — title, message (defaulting to `t('disabledModal.defaultMessage')`), button

**Key translation decisions:**
- "No Show" kept as brand term (not translated)
- "Happy Hour", "Add-on", "Import CRM", "Export CRM" kept as brand terms
- Duration uses ICU plural: `=1 {1 minuta} =2 {2 minuti} few {{mins} minute} other {{mins} minut}`
- Pagination uses split bold spans, only "od"/"of" connector translated
- `getStatusConfig()` labels left as SL (used only for styling config); display labels come from `statusLabels` map in component

---

### `clients`
**Files created:**
- `messages/sl/clients.json`
- `messages/en/clients.json`

**Components updated:**
- `app/[locale]/clients/page.tsx` — page header, subtitle, stats labels, search placeholder, showing count, CRM dropdown items, new client button, error/toast messages, retry button, disabled modal message; `EmptyState` and `SearchEmptyState` sub-components use `useTranslations` directly
- `components/clients/ClientModal.tsx` — modal title/subtitle, all field labels and placeholders, gender options, contact warning messages, action buttons, all validation error messages
- `components/clients/ClientDetailsPanel.tsx` — header (added/edit/delete), contact info section, gender display, notes labels, stats section, appointment history, appointment note labels, final price label; status labels use `useTranslations('appointments')` via a `getStatusLabel` callback; `useMemo` import added
- `components/clients/DeleteClientModal.tsx` — title, confirmation, split-string bold warning (`warningPrefix`/`warningSuffix`), appointment count with ICU plural, cancel/delete buttons
- `components/clients/ClientTable.tsx` — all column headers, empty state, action button titles, pagination "od"/"of"

**Key translation decisions:**
- Delete modal warning uses split-string approach (`warningPrefix` + `<strong>{name}</strong>` + `warningSuffix`) to preserve bold styling without `t.rich()`
- Appointment count plural: `=1 {1 termin} =2 {{count} termine} few {{count} termine} other {{count} terminov}`
- Database value strings (`'moški'`, `'ženska'`, `'Zaključen'`, `DAY_INDEX_TO_SLOVENIAN` keys) left as-is — these are schema/data values, not UI
- `getStatusConfig.label` fields in `ClientDetailsPanel` are now unused; display comes from `getStatusLabel()` using `useTranslations('appointments')`

---

## TypeScript
`npx tsc --noEmit` — clean (zero errors) after both namespaces

## Routes to verify
- `/sl/termini` — appointments page in Slovenian
- `/en/termini` — appointments page in English
- `/sl/clients` — clients page in Slovenian
- `/en/clients` — clients page in English
