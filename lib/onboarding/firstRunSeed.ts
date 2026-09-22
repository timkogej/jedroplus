// lib/onboarding/firstRunSeed.ts
//
// After onboarding, a brand-new account has no services and no staff, so the
// very first thing an owner tries — adding an appointment — is blocked. The
// owner picks starter services (and whether they perform services themselves)
// in the last onboarding step; this module stores that choice and, once the
// dashboard has the company loaded, creates it through the SAME n8n events the
// Storitve and Osebje pages use (NOVA_STORITEV, NOV_PARTNER, connect-user).
//
// Progress is saved after every step, so a retry never creates duplicates.

import { callN8nAction, type N8nPayload } from '@/src/lib/n8nClient';
import { getNextServiceId, getNextStaffId, getNextPersonHumanId, generatePartnerId } from '@/src/lib/idGenerators';
import { getCompanyColumnForTable } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import {
  buildPartnerCreateData,
  buildServiceCreateData,
  getPodatkiPodjetja,
} from '@/lib/webhookPayloadBuilders';
import { buildEmployeeRow, detectEmployeeColumns } from '@/lib/supabase/employees';
import { loadCompanyRow } from '@/lib/settingsStore';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { DEFAULT_SERVICE_GRADIENT, SERVICE_GRADIENTS } from '@/lib/constants/serviceGradients';
import { getDefaultGradient } from '@/lib/constants/gradients';

const STORAGE_PREFIX = 'jedroplus_first_run_seed:';

export interface SeedService {
  name: string;
  durationMin: number;
  priceEur: number;
}

export interface FirstRunSeedPlan {
  companyUuid: string;
  services: SeedService[];
  addOwnerAsStaff: boolean;
  ownerFirstName: string;
  ownerLastName: string;
  // Progress — filled in as steps succeed.
  createdServiceIds: string[];
  ownerStaffId: string | null;
  ownerConnected: boolean;
}

export type SeedStep = 'services' | 'owner' | 'connect' | 'done';

// ─── Storage ────────────────────────────────────────────────────────────────

export function saveSeedPlan(plan: FirstRunSeedPlan) {
  try {
    localStorage.setItem(STORAGE_PREFIX + plan.companyUuid, JSON.stringify(plan));
  } catch {
    // storage unavailable — the owner can still add services by hand
  }
}

export function loadSeedPlan(companyUuid: string | null | undefined): FirstRunSeedPlan | null {
  if (!companyUuid) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + companyUuid);
    return raw ? (JSON.parse(raw) as FirstRunSeedPlan) : null;
  } catch {
    return null;
  }
}

export function clearSeedPlan(companyUuid: string) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + companyUuid);
  } catch {
    // ignore
  }
}

// The "ready for your first appointment" card must survive the dashboard
// reloading (which unmounts it), so its state lives in storage until dismissed.
const READY_PREFIX = 'jedroplus_first_run_ready:';

export function markSetupReady(companyUuid: string) {
  try {
    localStorage.setItem(READY_PREFIX + companyUuid, '1');
  } catch {
    // ignore
  }
}

export function isSetupReady(companyUuid: string | null | undefined): boolean {
  if (!companyUuid) return false;
  try {
    return localStorage.getItem(READY_PREFIX + companyUuid) === '1';
  } catch {
    return false;
  }
}

export function clearSetupReady(companyUuid: string) {
  try {
    localStorage.removeItem(READY_PREFIX + companyUuid);
  } catch {
    // ignore
  }
}

export function isSeedComplete(plan: FirstRunSeedPlan): boolean {
  const servicesDone = plan.createdServiceIds.length >= plan.services.length;
  const ownerDone = !plan.addOwnerAsStaff || (plan.ownerStaffId !== null && plan.ownerConnected);
  return servicesDone && ownerDone;
}

// ─── Execution ──────────────────────────────────────────────────────────────

export interface SeedContext {
  companyId: string; // text business id
  companyUuid: string;
  companySettings: Record<string, unknown> | null;
  userId: string;
  userEmail: string;
}

function payload(ctx: SeedContext, event: string, entity: string, data: Record<string, unknown>): N8nPayload {
  return {
    event,
    entity,
    data,
    company_id: ctx.companyId,
    actor: ctx.userEmail,
    timestamp: new Date().toISOString(),
    meta: { app: 'Integrate', version: '1.0' },
  };
}

function parseSchedule(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw ?? null;
}

async function findStaffRowId(ctx: SeedContext, staffId: string): Promise<string | null> {
  const companyColumn = await getCompanyColumnForTable(TABLES.staff, ctx.companyId);
  // n8n writes asynchronously; give it a few seconds.
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 + attempt * 500));
    const { data } = await supabaseReadOnly
      .from(TABLES.staff)
      .select('id')
      .eq('ID osebe', staffId)
      .eq(companyColumn, ctx.companyId)
      .maybeSingle();
    const id = (data as { id?: string | number } | null)?.id;
    if (id !== undefined && id !== null) return String(id);
  }
  return null;
}

/**
 * Runs whatever part of the plan is not done yet. Calls `onStep` before each
 * phase and `onSave` after each success so the caller can persist progress.
 * Throws on the first failure; the plan passed to onSave is always accurate.
 */
export async function runSeedPlan(
  plan: FirstRunSeedPlan,
  ctx: SeedContext,
  onStep: (step: SeedStep) => void,
  onSave: (plan: FirstRunSeedPlan) => void
): Promise<FirstRunSeedPlan> {
  let current = { ...plan, createdServiceIds: [...plan.createdServiceIds] };
  const companyProfile = getPodatkiPodjetja(ctx.companySettings ?? undefined);

  // 1. Services
  if (current.createdServiceIds.length < current.services.length) {
    onStep('services');
    const companyColumn = await getCompanyColumnForTable(TABLES.services, ctx.companyId);
    const currency =
      typeof ctx.companySettings?.default_currency === 'string' && ctx.companySettings.default_currency.trim()
        ? ctx.companySettings.default_currency.trim().toUpperCase()
        : 'EUR';

    for (let i = current.createdServiceIds.length; i < current.services.length; i++) {
      const svc = current.services[i];
      const buildRow = (serviceId: string) => ({
        service_id: serviceId,
        Naziv: svc.name,
        Kategorija: '',
        category: '',
        Barva: SERVICE_GRADIENTS[i % SERVICE_GRADIENTS.length]?.gradient ?? DEFAULT_SERVICE_GRADIENT,
        Trajanje: svc.durationMin,
        Cena: svc.priceEur,
        Valuta: currency,
        valuta: currency,
        currency,
        Opis: '',
        Aktivna: true,
        Spletne_rezervacije: true,
        zahteva_placilo: false,
        requires_payment: false,
        [companyColumn]: ctx.companyId,
      });
      const build = (serviceId: string) =>
        payload(
          ctx,
          'NOVA_STORITEV',
          'services',
          buildServiceCreateData({
            companyId: ctx.companyId,
            userEmail: ctx.userEmail,
            companyProfile,
            serviceRow: buildRow(serviceId),
            allServiceIds: [...current.createdServiceIds, serviceId],
          })
        );

      let serviceId = await getNextServiceId(ctx.companyId);
      const result = await callN8nAction(build(serviceId), async () => {
        serviceId = await getNextServiceId(ctx.companyId);
        return build(serviceId);
      });
      if (!result.ok) throw new Error('service_create_failed');

      current = { ...current, createdServiceIds: [...current.createdServiceIds, serviceId] };
      onSave(current);
    }
  }

  // 2. Owner as the first staff member
  if (current.addOwnerAsStaff && !current.ownerStaffId) {
    onStep('owner');
    const [columns, companyRow] = await Promise.all([
      detectEmployeeColumns(),
      loadCompanyRow(ctx.companyId),
    ]);
    const row = companyRow.data as Record<string, unknown> | null;
    const schedule = parseSchedule(row?.['Urnik'] ?? row?.['urnik']);

    const rowData = buildEmployeeRow(
      {
        ime: current.ownerFirstName,
        priimek: current.ownerLastName,
        email: ctx.userEmail,
        pozicija: 'Lastnik',
        barva: getDefaultGradient(),
      },
      columns,
      true
    );

    const staffId = await getNextStaffId(ctx.companyId);
    const personHumanId = await getNextPersonHumanId(ctx.companyId, 'Ekipa');
    const partnerRow: Record<string, unknown> = {
      ...rowData,
      'ID osebe': staffId,
      person_human_id: personHumanId,
      ...(schedule ? { Urnik: JSON.stringify(schedule), urnik: schedule } : {}),
      Storitve: JSON.stringify(current.createdServiceIds),
      storitve: current.createdServiceIds,
      'Ali opravlja vse': true,
      ali_opravlja_vse: true,
      'Ali ima urnik podjetja': true,
      ali_ima_urnik_podjetja: true,
    };
    if (columns.personHumanId) partnerRow[columns.personHumanId] = personHumanId;
    if (columns.id === 'partner_id') partnerRow.partner_id = generatePartnerId();

    const result = await callN8nAction(
      payload(
        ctx,
        'NOV_PARTNER',
        'partners',
        buildPartnerCreateData({
          companyId: ctx.companyId,
          userEmail: ctx.userEmail,
          companyProfile,
          partnerRow,
        })
      )
    );
    if (!result.ok) throw new Error('owner_create_failed');

    current = { ...current, ownerStaffId: staffId };
    onSave(current);
  }

  // 3. Link the owner's login to their staff card (so "my appointments" works)
  if (current.addOwnerAsStaff && current.ownerStaffId && !current.ownerConnected) {
    onStep('connect');
    const personId = await findStaffRowId(ctx, current.ownerStaffId);
    if (!personId) throw new Error('owner_not_found');

    const response = await fetch('/api/team/connect-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: ctx.userId,
        person_id: personId,
        company_id: ctx.companyId,
        company_uuid: ctx.companyUuid,
      }),
    });
    if (!response.ok) throw new Error('owner_connect_failed');

    current = { ...current, ownerConnected: true };
    onSave(current);
  }

  onStep('done');
  return current;
}
