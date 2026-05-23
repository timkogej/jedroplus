# Jedro+ i18n Page Inventory

> **Purpose**: Pre-implementation planning document for `next-intl` integration.
> **Scope**: All user-facing routes under `app/` and shared components under `components/`.
> **Language**: UI is Slovenian (sl). Target: extract all hardcoded strings into `next-intl` message files.
> **Generated**: 2026-05-23 — READ-ONLY scan, no code modified.

---

## 1. Route Tree

```
app/
├── page.tsx                          → redirect to /dashboard (no text)
├── layout.tsx                        → metadata: "Jedro+", "Jedro+ - Sistem za upravljanje terminov"
│
├── login/page.tsx                    ✅ user-facing
├── signup/page.tsx                   ✅ user-facing
├── forgot-password/page.tsx          ✅ user-facing
├── register/page.tsx                 ⚠️  legacy (superseded by /signup)
│
├── auth/
│   ├── check-email/page.tsx          ✅ user-facing
│   ├── confirm/page.tsx              ✅ user-facing
│   ├── confirm-error/page.tsx        ✅ user-facing
│   └── reset-password/page.tsx       ✅ user-facing
│
├── onboarding/
│   ├── page.tsx                      ✅ user-facing
│   ├── create/page.tsx               ✅ user-facing (HIGH density)
│   └── join/page.tsx                 ✅ user-facing
│
├── dashboard/page.tsx                ✅ user-facing (HIGH density)
├── termini/page.tsx                  ✅ user-facing (HIGH density)
├── clients/page.tsx                  ✅ user-facing (HIGH density)
├── storitve/page.tsx                 ✅ user-facing
├── services/page.tsx                 ⚠️  duplicate of /storitve (same SL strings)
├── staff/page.tsx                    ✅ user-facing (HIGH density)
├── analytics/page.tsx                ✅ user-facing (delegates to components)
├── komunikacija/page.tsx             ✅ user-facing (HIGH density)
├── obvestila/page.tsx                ✅ user-facing
├── reminders/page.tsx                ✅ user-facing
├── lost-leads/page.tsx               ✅ user-facing  🐛 mixed-language bug
├── rezervacije/page.tsx              ✅ user-facing
├── qr-koda/page.tsx                  ✅ user-facing (LOW density)
├── logout/page.tsx                   ✅ user-facing (minimal)
│
├── billing/
│   ├── page.tsx                      ✅ user-facing (HIGH density)
│   ├── success/page.tsx              ✅ user-facing
│   └── cancel/page.tsx               ✅ user-facing
│
├── promotions/
│   ├── page.tsx                      → redirect to /promotions/discounts (no text)
│   ├── discounts/page.tsx            ✅ user-facing
│   ├── add-ons/page.tsx              ✅ user-facing
│   └── happy-hours/page.tsx          ✅ user-facing
│
├── nastavitve/
│   ├── layout.tsx                    → wrapper (minimal text)
│   ├── page.tsx                      ✅ user-facing (menu hub)
│   ├── splosno/page.tsx              ✅ user-facing (HIGH density)
│   ├── podjetje/page.tsx             ✅ user-facing (HIGH density)
│   ├── clani/page.tsx                ✅ user-facing (HIGH density)
│   ├── sporocila/page.tsx            ✅ user-facing
│   └── paketi/page.tsx               ✅ user-facing (billing sub-page)
│
├── -- INTERNAL DEV PAGES (not user-facing, English UI) --
├── app/page.tsx                      ❌ internal
├── settings/page.tsx                 ❌ internal (1 SL error string present)
├── bookings/page.tsx                 ❌ internal (1 SL error string present)
└── calendar/page.tsx                 ❌ internal placeholder
```

---

## 2. Pages by Category

### 2a. Auth & Password

| Route | File | Density | Notes |
|---|---|---|---|
| `/login` | `app/login/page.tsx` | MEDIUM | Google OAuth button, "Pozabljeno geslo?", toast messages |
| `/signup` | `app/signup/page.tsx` | MEDIUM | Email match validation message, Google OAuth |
| `/forgot-password` | `app/forgot-password/page.tsx` | LOW | 2-state: form + success |
| `/auth/check-email` | `app/auth/check-email/page.tsx` | LOW | "Skoraj končano", resend button |
| `/auth/confirm` | `app/auth/confirm/page.tsx` | MINIMAL | Loading state only |
| `/auth/confirm-error` | `app/auth/confirm-error/page.tsx` | LOW | Error + back link |
| `/auth/reset-password` | `app/auth/reset-password/page.tsx` | MEDIUM | 4 states: loading/invalid/form/success |

Key strings:
- `"Prijava v sistem"`, `"Prijava z Google"`, `"Pozabljeno geslo?"`
- `"Ustvarite nov račun"`, `"Registracija z Google"`
- `"Ponastavitev gesla"`, `"Pošlji povezavo za ponastavitev"`
- `"Skoraj končano"`, `"Ponovno pošlji email"`
- `"Potrjevanje ni uspelo"`, `"Potrditvena povezava ni veljavna"`
- `"Potrjujemo vaš email…"`

---

### 2b. Onboarding

| Route | File | Density | Notes |
|---|---|---|---|
| `/onboarding` | `app/onboarding/page.tsx` | LOW | 2-option choice screen |
| `/onboarding/create` | `app/onboarding/create/page.tsx` | **VERY HIGH** | 4-step wizard; COUNTRIES list; LANGUAGES; 22 industries |
| `/onboarding/join` | `app/onboarding/join/page.tsx` | MEDIUM | Role selection, code entry |

Key strings (create wizard):
- Steps: `"Lokalizacija"`, `"Ime podjetja"`, `"Panoga"`, `"Delovni urnik"`
- Countries dropdown (full localised list)
- Languages: `"Slovenščina"`, `"Angleščina"`, `"Nemščina"`, etc.
- 22 industry names in SL (Lepotni saloni, Frizerstvo, Fitnes, Wellness…)
- Days of week (SL short + long forms)
- Success screen: `"Podjetje uspešno ustvarjeno!"`

Key strings (join):
- `"Pridruži se kot Admin"`, `"Pridruži se kot Zaposleni"`
- Role descriptions, code input label, submit/loading states

---

### 2c. Main App Pages

| Route | File | Density | Notes |
|---|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` | **HIGH** | Time-based greeting (Dobro jutro/Dan/Popoldne/Večer), metric cards, appointment list, complete modal |
| `/termini` | `app/termini/page.tsx` | **HIGH** | Stats, filters, appointment table, DisabledActionModal, status labels |
| `/clients` | `app/clients/page.tsx` | **HIGH** | Import/Export dropdowns, search, empty states, CRM section |
| `/storitve` | `app/storitve/page.tsx` | MEDIUM | Stats, search, service cards, toggle active, empty states |
| `/staff` | `app/staff/page.tsx` | **HIGH** | Employee cards, pluralization issue, permissions modal |
| `/analytics` | `app/analytics/page.tsx` | LOW direct | Delegates to `components/analytics/` |
| `/komunikacija` | `app/komunikacija/page.tsx` | **HIGH** | 2-step email send, recipient selection, pluralization issues |
| `/obvestila` | `app/obvestila/page.tsx` | MEDIUM | Filters, relative time strings, notification cards |
| `/reminders` | `app/reminders/page.tsx` | MEDIUM | Stats cards, settings sections, "Ni nastavljeno", incomplete banner |
| `/lost-leads` | `app/lost-leads/page.tsx` | MEDIUM | Stats, table, 🐛 English empty state (line 359) |
| `/rezervacije` | `app/rezervacije/page.tsx` | MEDIUM | Booking page management, design names SL, copy link, settings panel |
| `/qr-koda` | `app/qr-koda/page.tsx` | LOW | 2 strings + error state |

---

### 2d. Settings

| Route | File | Density | Notes |
|---|---|---|---|
| `/nastavitve` | `app/nastavitve/page.tsx` | LOW | Hub menu with section titles and nav item labels |
| `/nastavitve/splosno` | `app/nastavitve/splosno/page.tsx` | **HIGH** | Account, language/region, company codes; save/cancel buttons throughout |
| `/nastavitve/podjetje` | `app/nastavitve/podjetje/page.tsx` | **HIGH** | Company data form, working hours table, save/cancel |
| `/nastavitve/clani` | `app/nastavitve/clani/page.tsx` | **HIGH** | Members list, RBAC permission toggles, role badges, invite flow |
| `/nastavitve/sporocila` | `app/nastavitve/sporocila/page.tsx` | MEDIUM | Message history, 14-day filter, pluralization issue |
| `/nastavitve/paketi` | `app/nastavitve/paketi/page.tsx` | MEDIUM | Plan cards (also exists at `/billing`), enterprise modal |

Key role badge strings: `"Lastnik"`, `"Admin"`, `"Zaposleni"`

---

### 2e. Billing

| Route | File | Density | Notes |
|---|---|---|---|
| `/billing` | `app/billing/page.tsx` | **HIGH** | Plan selector, quota bars, billing period toggle, enterprise inquiry modal |
| `/billing/success` | `app/billing/success/page.tsx` | MEDIUM | 4 polling states: verifying/success/timeout/error |
| `/billing/cancel` | `app/billing/cancel/page.tsx` | LOW | Cancellation confirmation |

Key strings:
- `"Paketi in kvote"` (owner/admin), `"Paketi"` (staff)
- `"Trenutni paket"`, `"Podrobnosti naročnine"`, `"Naslednja obnova"`
- `"SMS kvota"`, `"Email kvota"`, `"Porabljeno"`, `"Na voljo"`
- `"Mesečno"`, `"Letno"`, `"Najbolj priljubljen"`
- `"Preizkusi Brezplačno"`, `"Izberi paket"`, `"Trenutni paket"` (CTA states)
- `"Odpri Billing Portal"` — **MIXED**: "Billing Portal" is English product name; keep as-is or confirm
- Plan feature lists: all hardcoded SL strings per plan tier
- Enterprise modal fields: `"Ime in priimek"`, `"Email"`, `"Telefon"`, `"Ime podjetja"`, `"Število zaposlenih"`, `"Vaše zahteve in potrebe"`

---

### 2f. Promotions

| Route | File | Density | Notes |
|---|---|---|---|
| `/promotions/discounts` | `app/promotions/discounts/page.tsx` | MEDIUM | Search, table, CRUD modal, pluralization issue |
| `/promotions/add-ons` | `app/promotions/add-ons/page.tsx` | MEDIUM | "{n} add-onov"; "Add-on" is product name |
| `/promotions/happy-hours` | `app/promotions/happy-hours/page.tsx` | MEDIUM | Days, time pickers, "Vse storitve" |

---

## 3. Shared Components

Components with significant user-facing text that need i18n treatment:

### Layout

| Component | File | Key Strings |
|---|---|---|
| Sidebar | `components/layout/Sidebar.tsx` | Section labels: `"Glavno"`, `"AI"`, `"Komunikacija"`, `"Moduli"`, `"Promocije"`, `"Analitika"`, `"Račun"`; nav item names |
| AppBar | `components/layout/AppBar.tsx` | Route-to-breadcrumb map; `"Domov"` (root); `"Iskanje..."` placeholder; `"Moj profil"`, `"Paketi"`, `"Odjava"`; aria-labels: `"Zapri meni"`, `"Odpri meni"`, `"Iskanje"` |
| SearchModal | `components/layout/SearchModal.tsx` | Categories: `"Strani"`, `"Hitri dostop"`; quick actions: `"Nov termin"`, `"Nova stranka"`, `"Nova storitev"`; page names with SL keywords |

### Billing

| Component | File | Key Strings |
|---|---|---|
| FeatureGate | `components/billing/FeatureGate.tsx` | `"Nadgradite za dostop"`, `"Ta funkcija zahteva paket {plan} ali višje."`, `"Oglej si pakete"` |

### Appointments

| Component | File | Notes |
|---|---|---|
| AppointmentModal | `components/appointments/AppointmentModal.tsx` | Create/edit form — HIGH density; not fully read in this scan |
| AppointmentTable | `components/appointments/AppointmentTable.tsx` | Table headers, status labels, action buttons; not fully read |
| DisabledActionModal | `components/DisabledActionModal.tsx` | Upgrade-required blocker modal; not fully read |

### Calendar

| Component | File | Notes |
|---|---|---|
| CalendarSidebar | `components/calendar/CalendarSidebar.tsx` | Day/month navigation labels; not fully read |
| DayView / WeekView / MonthView / TwoDayView | `components/calendar/` | View labels, time strings; not fully read |

### Clients

| Component | File | Notes |
|---|---|---|
| ClientModal | `components/clients/ClientModal.tsx` | Create/edit form; not fully read |
| ClientDetailsPanel | `components/clients/ClientDetailsPanel.tsx` | Detail panel labels; not fully read |

### Employees

| Component | File | Notes |
|---|---|---|
| EmployeeModal | `components/employees/EmployeeModal.tsx` | Create/edit form; not fully read |
| EmployeeCard | `components/employees/EmployeeCard.tsx` | Card labels, actions; not fully read |

### Services

| Component | File | Notes |
|---|---|---|
| ServiceModal | `components/services/ServiceModal.tsx` | Create/edit form; not fully read |
| ServiceCard | `components/services/ServiceCard.tsx` | Card labels; not fully read |

### Reminders & Lost Leads

| Component | File | Notes |
|---|---|---|
| ReminderSettingsModal | `components/reminders/ReminderSettingsModal.tsx` | Settings form; not fully read |
| LostLeadsSettingsModal | `components/lost-leads/LostLeadsSettingsModal.tsx` | Settings form; not fully read |

### SMS

| Component | File | Notes |
|---|---|---|
| SMSQuotaBar | `components/sms/SMSQuotaBar.tsx` | Quota display strings; not fully read |
| SMSSendGuard | `components/sms/SMSSendGuard.tsx` | Guard messages; not fully read |

### Analytics

| Component | File | Notes |
|---|---|---|
| AnalyticsHeader | `components/analytics/AnalyticsHeader.tsx` | Period selectors, labels; not fully read |
| PromotionsAnalytics | `components/analytics/PromotionsAnalytics.tsx` | Chart labels; not fully read |
| Dashboard cards | `components/dashboard/` (6 files) | Metric labels, chart axis labels, "Top" labels; not fully read |

### Settings

| Component | File | Notes |
|---|---|---|
| SettingsSection | `components/settings/SettingsSection.tsx` | Section wrapper; not fully read |
| Switch | `components/settings/Switch.tsx` | Likely minimal (on/off); not fully read |

---

## 4. Hot Spots

Pages and components with the highest i18n extraction complexity:

### Priority 1 — Highest Density + Complexity

| File | Why |
|---|---|
| `app/onboarding/create/page.tsx` | 4-step wizard; COUNTRIES array (~200 entries); 22 industries; full SL day names; success/error states |
| `app/dashboard/page.tsx` | Time-based greeting (4 variants); dynamic metric labels; appointment status badges; action buttons |
| `app/termini/page.tsx` | Filter tabs; status labels; stats; action buttons; modal strings |
| `app/clients/page.tsx` | Import/export UI; search; empty states; CRM copy |
| `app/staff/page.tsx` | Employee list; permissions matrix; role selectors; **pluralization** |
| `app/komunikacija/page.tsx` | 2-step send flow; recipient count display; **pluralization (2 locations)** |
| `app/nastavitve/splosno/page.tsx` | Account + profile + language/region forms; all field labels |
| `app/nastavitve/podjetje/page.tsx` | Company data + working hours; all field labels and day names |
| `app/nastavitve/clani/page.tsx` | Members + RBAC permission toggles; role badge strings; invite flow |
| `app/billing/page.tsx` | Plan cards; quota bars; billing period; enterprise modal; plan feature lists |
| `components/appointments/AppointmentModal.tsx` | Create/edit modal (not fully scanned — likely very high density) |

### Priority 2 — Medium Density

| File | Why |
|---|---|
| `app/login/page.tsx` — `app/auth/reset-password/page.tsx` | Auth flow strings; toast messages |
| `app/promotions/discounts/page.tsx` | CRUD modal; table; validation; **pluralization** |
| `app/reminders/page.tsx` | Stats; section labels; incomplete banner |
| `app/lost-leads/page.tsx` | Stats; table headers; **🐛 English bug line 359** |
| `app/billing/success/page.tsx` | 4-state polling page |
| `app/nastavitve/sporocila/page.tsx` | Message history; **pluralization** |
| `app/obvestila/page.tsx` | Relative time strings; filter labels |
| `app/rezervacije/page.tsx` | Design names; settings panel |
| `components/layout/AppBar.tsx` | Full breadcrumb map; profile dropdown |

---

## 5. Excluded — for Confirmation

The following modules were found in the codebase but are excluded from this i18n scan per the original task requirements. **Confirm these exclusions before beginning extraction.**

| Module | Path | Reason for Exclusion |
|---|---|---|
| Chatbot+ | `app/chatbot-plus/` | Excluded per task spec |
| Asistent+ | `app/asistent/` | Excluded per task spec |
| Receptionist+ | `app/receptionist-plus/` | Excluded per task spec (online booking system) |
| Client self-registration | `app/register/[slug]/` | Excluded per task spec |
| API routes | `app/api/` | Server-side, no user-facing text |

Additionally, the following routes exist but are **internal developer pages** (English UI, not deployed to end users) and should likely be excluded from i18n scope:

| Route | File | Notes |
|---|---|---|
| `/app` | `app/app/page.tsx` | Dev dashboard; mixed EN/SL |
| `/settings` | `app/settings/page.tsx` | Legacy internal settings; EN tabs; 1 SL error string |
| `/bookings` | `app/bookings/page.tsx` | Legacy internal booking list; EN headers; 1 SL error string |
| `/calendar` | `app/calendar/page.tsx` | Placeholder ("Calendar", "Implement calendar view here.") |

The 2 SL error strings in `/settings` and `/bookings` could be extracted as part of a cleanup pass, but these pages are not user-facing.

---

## 6. Proposed Namespace Structure

Recommended `next-intl` namespace layout (one JSON file per namespace):

```
messages/sl/
├── common.json          # Shared: buttons (Shrani, Prekliči, Uredi, Izbriši, Zapri),
│                        # status labels (Aktiven, Neaktiven, Nalaganje...),
│                        # error fallbacks, confirmation dialogs
│
├── auth.json            # login, signup, forgot-password, auth/*, reset-password
│
├── onboarding.json      # /onboarding, /onboarding/create, /onboarding/join
│                        # Includes: COUNTRIES array, LANGUAGES array, INDUSTRIES array,
│                        # days of week, time format strings
│
├── dashboard.json       # /dashboard — greeting variants, metric labels
│
├── appointments.json    # /termini + AppointmentModal + AppointmentTable
│                        # Status labels shared with calendar
│
├── clients.json         # /clients + ClientModal + ClientDetailsPanel
│
├── services.json        # /storitve (/services) + ServiceModal + ServiceCard
│
├── staff.json           # /staff + EmployeeModal + EmployeeCard
│
├── analytics.json       # /analytics + all components/analytics/*
│                        # + components/dashboard/* metric labels
│
├── communication.json   # /komunikacija + SMSQuotaBar + SMSSendGuard
│
├── notifications.json   # /obvestila — relative time strings, filter labels
│
├── reminders.json       # /reminders + ReminderSettingsModal
│
├── lost-leads.json      # /lost-leads + LostLeadsSettingsModal
│
├── reservations.json    # /rezervacije — booking page management
│
├── promotions.json      # /promotions/discounts, /promotions/add-ons,
│                        # /promotions/happy-hours
│
├── billing.json         # /billing, /billing/success, /billing/cancel,
│                        # /nastavitve/paketi, FeatureGate
│                        # Includes: plan names, feature lists per plan
│
├── settings.json        # /nastavitve/* (splosno, podjetje, clani, sporocila)
│                        # + SettingsSection, Switch
│
└── layout.json          # Sidebar nav labels, AppBar breadcrumbs,
                         # SearchModal quick actions, QR page, logout
```

**Notes on sharing:**
- Status labels (`Aktiven`, `Neaktiven`, `Potekel`) appear in appointments, services, and promotions — consolidate in `common.json`
- Day-of-week arrays appear in onboarding AND nastavitve/podjetje AND happy-hours — consolidate in `common.json` or `onboarding.json` and import
- Confirmation dialog pattern (`"Ali ste prepričani?"`, `"Te akcije ni mogoče razveljaviti."`) is universal — `common.json`
- Role names (`Lastnik`, `Admin`, `Zaposleni`) appear in sidebar, members page, and communication — `common.json`

---

## 7. Slovenian Grammar Concerns

### 7a. Pluralization (Critical)

Slovenian has 4 plural forms (1 / 2 / 3–4 / 5+), which `next-intl` supports via ICU message format `{count, plural, one{} two{} few{} other{}}`.

**Confirmed pluralization hotspots requiring 4-form ICU rules:**

| Location | Current Hardcoded Pattern | Variables |
|---|---|---|
| `app/staff/page.tsx` | `"X zaposleni/zaposlenih za 'query'"` | `count`, `query` |
| `app/komunikacija/page.tsx` (L1) | `"Naprej z X stranko/strankami"` (step 1 button) | `count` |
| `app/komunikacija/page.tsx` (L2) | `"X stranka/stranke/strank izbranih"` (recipient summary) | `count` |
| `app/nastavitve/sporocila/page.tsx` | `"X sporočilo/sporočila/sporočil"` | `count` |
| `app/promotions/discounts/page.tsx` | `"{n} storitev/storitve"` (service count in discount) | `count` |
| `app/promotions/add-ons/page.tsx` | `"{n} add-onov"` | `count` |
| `app/promotions/happy-hours/page.tsx` | `"{n} happy hours"` | `count` |

Example ICU pattern for `count` stranke:
```json
"recipientCount": "{count, plural, =1 {1 stranka} =2 {2 stranki} few {{count} stranke} other {{count} strank}}"
```

Slovenian plural rules:
- `=1` → stranka / zaposleni / storitev
- `=2` → stranki / zaposlena / storitvi
- `=3`, `=4` → stranke / zaposleni / storitve (same as `few`)
- `5+` → strank / zaposlenih / storitev

### 7b. Gendered Forms

Slovenian adjectives and some nouns are gendered. Known instances:
- Greeting adjectives: `"Dobro jutro"` (neutral), `"Dober dan"` (m), `"Dobro popoldne"` (neutral), `"Dober večer"` (m) — these are set phrases, no gender variable needed
- Role names (`Lastnik` m / `Lastnica` f) are currently always masculine; if user gender data becomes available, these would need variants. **Currently: not in scope.**
- Past participles in toast messages (e.g., `"Stranka dodana"` / `"Zaposleni dodan"`) — feminine/masculine forms differ. If toast strings reference the entity name, gender must be considered.

### 7c. Formal vs. Informal Register

The current UI uses **informal/familiar `ti`** forms throughout (e.g., `"Pridruži se"`, `"Ustvari"`, `"Pošlji"`). This is consistent. Maintain `ti` form across all translations. Do **not** introduce `vi` (formal) forms unless a deliberate UX decision is made.

### 7d. Date & Time Formatting

- `date-fns` with `sl` locale is already imported across the codebase — this handles display formatting correctly.
- Relative time strings in `/obvestila` are **custom-coded** (`"Pred X min"`, `"Pred X h"`, `"Včeraj"`) and should be moved to `notifications.json` with ICU `{count}` variables.
- Month names in `date-fns` sl locale use genitive case when needed (e.g., `"3. marca"`) — do not override with bare month names.

### 7e. Ordinal Numbers

Not observed in current scan, but if added (e.g., step indicators `"1. korak"`), use ordinal dot notation `{n}.` — standard in SL.

### 7f. Noun Declension in Concatenated Strings

Avoid building sentences by concatenation (e.g., `"Paket" + planName + "je aktiven"`). SL requires case agreement that breaks with naive concatenation. Use ICU message templates with named placeholders instead:
```json
"planActive": "Paket {planName} je aktiven."
```

---

## 8. Open Questions

### Q1 — Mixed-Language Bug (Action Required)
`app/lost-leads/page.tsx` **line 359** contains English: `"There are currently no inactive customers."`.  
This should be `"Trenutno ni neaktivnih strank."` (or equivalent SL).  
**Recommend fixing this string before or as part of i18n extraction, not after.**

### Q2 — Duplicate Routes `/storitve` and `/services`
Both routes render the same Slovenian UI. The `/services` route appears to be a legacy or alias.  
**Decision needed**: Keep both with same message keys? Deprecate `/services`? The namespace proposal treats them as one (`services.json`).

### Q3 — English Product Names Inside SL UI
Several English names appear intentionally in the SL UI:
- `"Happy Hour"` / `"Happy Hours"` (product name for promotion type)
- `"Add-on"` / `"Add-ons"` (product name)
- `"Billing Portal"` (third-party portal name, currently `"Odpri Billing Portal"`)
- `"Dashboard"` (used in billing/success CTA)
- Plan tier names: `"JEDRO_PLUS"`, `"JEDRO_PRO"`, `"JEDRO_PREMIUM"`, `"ENTERPRISE"` (brand names)

**Decision needed**: Which of these are brand names (extract but do not translate) vs. UI labels that should be SL? Recommend keeping `Add-on`, `Happy Hour`, `Billing Portal` as brand/product names and wrapping only the surrounding SL text.

### Q4 — Country & Language Arrays in Onboarding
`app/onboarding/create/page.tsx` contains full localised arrays for countries and languages (hardcoded in the component). These are large (~200 country names, ~20 languages).

**Options**:
- Move arrays to `onboarding.json` under `common.countries` / `common.languages` namespaces
- Keep as TypeScript constants but pull display labels from message files
- Use an external library (e.g., `i18n-iso-countries`) for country names

**Recommendation**: Use `i18n-iso-countries` with `sl` locale for country names to avoid maintaining a custom list. Language names can remain as a small static JSON array.

### Q5 — RBAC-Conditional Text
Several pages show different text/sections based on user role (owner vs. admin vs. staff). Examples:
- `/billing` shows `"Paketi in kvote"` for owner/admin, `"Paketi"` for staff
- Some sections are entirely hidden for staff

These are `{role}` select ICU messages:
```json
"billingTitle": "{role, select, staff {Paketi} other {Paketi in kvote}}"
```
Or alternatively, two separate keys with conditional rendering kept in component code. **Decision needed** on approach.

### Q6 — Toast Message Completeness
Toast messages (via `sonner`) are scattered across pages and modals. They were partially catalogued but not exhaustively. A dedicated pass through all `toast.success()`, `toast.error()`, and `toast.loading()` calls is recommended before finalising `common.json` vs. per-page namespace placement.

### Q7 — `next-intl` Version and Server Components
The project uses Next.js App Router with `'use client'` on every page. If `next-intl` v3+ is used, the `useTranslations()` hook approach applies throughout (no async RSC `getTranslations()` needed). Confirm `next-intl` target version before starting extraction.

### Q8 — Incomplete Settings Banners
Both `/reminders` and `/rezervacije` show an "incomplete settings" banner. The banner text itself needs i18n, but the **conditions** that trigger it (e.g., `!settings.smsEnabled`) are logic-dependent. Ensure the banner strings are namespaced with the respective module (`reminders.json`, `reservations.json`).

### Q9 — Currency & Number Formatting
Prices appear in billing pages as `"{X}€/mesec"` and `"{X}€/leto"`. SL convention: `120 €` (space before €). Currently prices are hardcoded per plan. When extracting:
- Use ICU number format: `{price, number, ::currency/EUR}` with sl locale (produces `120,00 €`)
- Or keep prices as plain numbers and wrap in `{price} €/mesec` template

### Q10 — Internal Dev Pages
`/app/app`, `/app/settings`, `/app/bookings`, `/app/calendar` are English internal pages.  
**Confirm**: These are permanently excluded from i18n scope. If they become user-facing in future, a separate pass will be needed.

---

*End of inventory. Next step: confirm exclusions (§5), answer open questions (§8), then begin extraction starting with Priority 1 hot spots (§4).*
