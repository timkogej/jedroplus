# Jedro+ AI Agent Instructions

Jedro+ is a multi-tenant appointment and client management SaaS built with Next.js 16, React 19, TypeScript, Supabase, and Tailwind CSS. It integrates with N8N for asynchronous business logic and webhooks.

## Architecture Overview

### Core Context Providers (Must Understand)
- **`app/auth-context.tsx`**: Manages Supabase user authentication (`user`, `loading`, `signIn`, `signUp`, `signOut`). Every protected page needs `useAuth()`.
- **`app/company-context.tsx`**: Manages multi-tenant company state (`companyId`, `companySettings`, `subscription`, `smsQuota`). Settings are loaded from `"Podatki podjetij"` table. **All data fetches must be scoped to the company ID.**
- **`app/providers.tsx`**: Root provider composition - wraps `CompanyProvider` → `AuthProvider` → `Toaster`. Do not change this order.

### Data Fetching & Multi-Tenancy
- **Company scoping is critical**: Use `lib/companyScope.ts` to find the company column (candidates: `"ID podjetja"`, `"ID Podjetja"`, `"ID_podjetja"`, `company_id`, `companyId`).
- **Key fetching patterns in `lib/data.ts`**: 
  - `fetchClients(companyId)` → queries `"Stranke"` table
  - `fetchBookings(companyId)` → queries `"Termini"` table
  - Always use `supabaseReadOnly` for reads; it's scoped to protect data.
- **Dynamic column detection**: Use `lib/tableIntrospection.ts` to detect ID columns and primary keys (clients may use different column names).

### Read-Only Frontend, N8N-Driven Writes
- **Frontend never writes to Supabase directly.** All mutations (create/update/delete) go through N8N webhooks.
- Use `lib/webhook.ts` (`sendWebhook()`) to trigger workflows: pass `event` (e.g., `"booking:create"`), `entity`, data, and `opts` with `companyId` and `actor`.
- Example: `sendWebhook("booking:complete", "appointment", { id, notes }, { companyId, actor: user.email })`.
- Supabase RLS policies deny all INSERT/UPDATE/DELETE for anon clients.

### Dashboard Data Flow
- `lib/dashboard/fetchDashboardData.ts` aggregates KPIs, appointments, services, revenue.
- Components use `useCompany()` to access `companyId` and `companySettings` for table name resolution.
- Charts use Recharts; metrics fallback to `"-"` if not available (graceful degradation).

## Routing & Protected Pages

- **Public**: `/login`, `/register`, `/signup`, `/onboarding/create`, `/onboarding/join`
- **Protected**: Use `ProtectedLayout` wrapper (in `components/ProtectedLayout.tsx`); enforces auth + company selection.
- **Company routing**: `/company` -> select/validate company → `/dashboard` (or other protected routes).
- **Redirect pattern**: On login redirect, preserve original destination with query param: `/login?redirect=<url>`.

## Key Workflows & Patterns

### Dashboard Initialization
1. `ProtectedLayout` checks `user` and `companyId` from context.
2. Page calls `fetchDashboardData(companyId, companySettings)`.
3. KPI cards display metrics or `"-"` with tooltip explaining why data is unavailable.
4. Smoke test in README: verify table names resolve, KPI cards show values, appointments filter by company.

### Booking Lifecycle
1. User creates booking via `QuickBookingModal` or `BookingDialog`.
2. Frontend collects data (client, service, time, staff).
3. Call `sendWebhook("booking:create", "appointment", { ...data }, { companyId, actor })`.
4. N8N writes to `"Termini"` table.
5. Frontend listens for webhook response or polls dashboard data.
6. Booking detail: `CompleteBookingDialog`, `EditBookingDialog` also trigger webhooks (e.g., `"booking:complete"`, `"booking:cancel"`).

### Company Settings Customization
- Settings are stored in `CompanySettings` type (e.g., `"Tabela stranke"`, `"Tabela termini"`, `"Tabela osebe"`, `"Tabela storitve"`).
- Use `lib/companyScope.ts:resolveCompanyTables()` to get table names from settings.
- Supports localized column names (e.g., Slovenian: `"Stranka"`, `"Termini"`, `"Osebe"`, `"Storitve"`).
- All queries must respect these dynamic table names.

## Common Code Patterns

### Reading Data in Components
```tsx
const { companyId, companySettings } = useCompany();
const { data, error } = await fetchClients(companyId);
// Use companySettings["Tabela stranke"] for custom table name if needed
```

### Sending a Mutation
```tsx
import { sendWebhook } from '@/lib/webhook';
import { useAuth } from '@/app/auth-context';
import { useCompany } from '@/app/company-context';

const { user } = useAuth();
const { companyId } = useCompany();

const createBooking = async (bookingData) => {
  sendWebhook('booking:create', 'appointment', bookingData, {
    companyId,
    actor: user?.email || 'unknown'
  });
  // Refresh UI or wait for webhook response
};
```

### UI Utilities
- **Icons**: `@phosphor-icons/react` (e.g., `Plus`, `Warning`, `CalendarCheck`).
- **Animations**: `motion/react` for smooth transitions.
- **Notifications**: `sonner` for toasts (configured in `providers.tsx`).
- **Styling**: Tailwind CSS v4 with `@tailwindcss/postcss`. Use class composition, avoid inline styles.

## Development Commands

```bash
npm run dev        # Start Next.js dev server (http://localhost:3000)
npm run build      # Production build (required before deployment)
npm run start      # Start production server
npm run lint       # Run ESLint on all files
```

## Deployment & Environment

- Hosted on Vercel (default Next.js platform).
- **Required env vars**:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase connection.
  - `WEBHOOK_URL` in `lib/webhook.ts`: N8N endpoint (hardcoded for now; should be env var).
- **Build output**: Next.js App Router generates static/SSR routes automatically.

## Testing & Smoke Tests

See README.md for full smoke tests. Key scenarios:
1. **Dashboard**: Company selection → KPI load → booking CRUD.
2. **Clients + Bookings**: Company filter → CRUD → webhook integration.
3. **Settings reload**: Verify `reloadSettings()` in `CompanyContext` refreshes company data.

## Common Pitfalls & What to Avoid

1. **Forgetting company scope**: Any table query without company filtering is a bug.
2. **Writing directly to Supabase**: Always use webhooks for mutations.
3. **Hard-coding table names**: Use `companySettings` for dynamic table resolution.
4. **Ignoring loading states**: Always check `loading` flags in context before rendering.
5. **Stale company context**: If company settings change externally, call `reloadSettings()` to sync.

## File Organization

```
app/                     # Next.js App Router pages & layouts
├── auth-context.tsx     # Auth provider
├── company-context.tsx  # Company/multi-tenant provider
├── providers.tsx        # Root provider wrapper
├── dashboard/
├── bookings/
├── clients/
└── ...
components/              # Reusable React components
├── ProtectedLayout.tsx  # Auth + company gate
├── Calendar.tsx         # Full calendar UI
├── Dashboard/           # Dashboard components
└── ...
lib/                     # Utilities & logic
├── supabaseClient.ts    # Anon Supabase client
├── supabaseServer.ts    # Server-side client (if needed)
├── companyScope.ts      # Multi-tenant scoping
├── data.ts              # Fetch patterns (clients, bookings, etc.)
├── webhook.ts           # N8N webhook dispatcher
├── dashboard/           # Dashboard helpers
└── ...
types/                   # TypeScript type definitions
└── *.ts                 # appointments, clients, services, etc.
```

## Quick Debug Tips

- **Webhook not firing?** Check `localStorage.debug_webhooks = '1'` and console logs in `lib/webhook.ts`.
- **Company context is null?** Ensure user has logged in and selected a company (check `companyId` in browser DevTools → React components).
- **Table queries return no data?** Verify table name in Supabase and company column name with `getCompanyColumnForTable()`.
- **Type errors on CompanySettings?** Use `as const` for hardcoded keys or check actual Supabase schema.
