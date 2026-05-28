# i18n Koledar Patch — Completion Report

**Branch:** `feature/i18n-koledar-patch`  
**Commit:** `71c4f61`  
**Date:** 2026-05-28

---

## Summary

All hardcoded Slovenian UI strings in the calendar page and its components have been replaced with `t()` calls from `next-intl`. No new namespaces were created — only existing namespaces (`appointments`, `staff`, `common`) were extended.

---

## Files Changed (20)

### Components — 14 files

| File | Changes |
|---|---|
| `components/Calendar.tsx` | `AppointmentDetailModal`: getStatusLabel(), all field labels, price labels, action buttons, aria-label. `Calendar` fn: all error/success messages, reschedule dialog, complete dialog, navigation aria-labels, DeleteConfirmation props. |
| `components/calendar/ViewToggle.tsx` | View mode labels moved inside function, hooked to `t('appointments.calendarView.viewModes.*')` |
| `components/calendar/DateStrip.tsx` | `DAY_LETTER` array moved inside function, hooked to `t('common.dayLetters.*')` |
| `components/calendar/CalendarSidebar.tsx` | All 15 SL strings → `t('appointments.calendarView.sidebar.*')` |
| `components/calendar/AbsenceModal.tsx` | All labels, placeholders, validation, footer buttons |
| `components/calendar/AbsenceDetailModal.tsx` | All strings; renamed `t` in `TIME_OPTIONS.map` to `time` to avoid shadowing |
| `components/calendar/EventModal.tsx` | All strings; renamed `t` in `TIME_OPTIONS.map` to `opt` |
| `components/calendar/EventViewModal.tsx` | Delete flow, "Uredi" button |
| `components/calendar/CalendarAppointmentModal.tsx` | `STATUS_OPTIONS` moved inside function; reused existing `appointments.modal.*` and `appointments.status.*` keys |
| `components/calendar/MonthView.tsx` | moreEvents, moreAbsences, more counters; allEmployees fallback |
| `components/calendar/DayView.tsx` | notWorkingDay, appointmentNoun (ICU plural), noAppointmentsToday, allEmployees (4×) |
| `components/calendar/WeekView.tsx` | moreAbsences, moreEvents, allEmployees (4×) |
| `components/calendar/TwoDayView.tsx` | allEmployees (3×) |
| `components/employees/GradientSelector.tsx` | Color description string |

### Messages — 6 files

| File | Added |
|---|---|
| `messages/sl/appointments.json` | `calendarView` section: viewModes, sidebar, eventModal, absenceModal, absenceDetailModal, appointmentModal, detailModal (fields + actions), dayView, monthView, weekView, rescheduleDialog, completeDialog, navigation, toast, errors, saving, allEmployees |
| `messages/en/appointments.json` | Same structure in English |
| `messages/sl/common.json` | `dayLetters` section (N/P/T/S/Č/P/S) |
| `messages/en/common.json` | `dayLetters` section (S/M/T/W/T/F/S) |
| `messages/sl/staff.json` | `gradientSelector.description` |
| `messages/en/staff.json` | `gradientSelector.description` |

---

## Rules Followed

- ✅ Extended existing namespaces only — no new namespaces created
- ✅ DB column references untouched (`koledar_ure`, `koledar_vsi_dnevi`, `zaključen`, `Odpovedan`, `Telefonska številka`, etc.)
- ✅ Drag-and-drop logic untouched
- ✅ Date/time calculation logic untouched
- ✅ All `useState`, `useEffect`, `useMemo`, callbacks preserved exactly
- ✅ Component props and types unchanged
- ✅ `common.json` reused aggressively (`buttons.cancel`, `buttons.close`, etc.)
- ✅ Existing `appointments.modal.*`, `appointments.status.*`, `appointments.filters.*`, `appointments.toast.*`, `appointments.errors.*` keys reused wherever applicable
- ✅ ICU plural syntax for Slovenian appointment noun: `{count, plural, =1 {termin} =2 {termini} few {termini} other {terminov}}`
- ✅ Variable shadowing fixed: `TIME_OPTIONS.map((t) => …)` renamed to `time` / `opt`
- ✅ Single commit on branch `feature/i18n-koledar-patch`
- ✅ TypeScript check passed: `npx tsc --noEmit` — 0 errors

---

## Verification

```bash
# TypeScript — clean
npx tsc --noEmit

# No remaining hardcoded SL UI strings in calendar components
grep -rn "[ČčŠšŽž]" components/calendar/ components/Calendar.tsx components/employees/GradientSelector.tsx \
  | grep "'" | grep -v "DB\|column\|zaključen\|Zaključen\|Odpovedan\|prišel\|Telefonska\|telefon"

# JSON valid
python3 -m json.tool messages/sl/appointments.json > /dev/null
python3 -m json.tool messages/en/appointments.json > /dev/null
```
