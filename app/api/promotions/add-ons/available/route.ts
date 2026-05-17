import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addMinutesToTime } from '@/lib/promotions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const SERVICE_ID_COLS = ['id', 'ID storitev', 'ID storitve', 'ID_storitve'];
const SERVICE_NAME_COLS = ['Naziv', 'naziv', 'Storitev', 'name'];
const PRICE_COLS = ['Cena', 'cena', 'price'];
const DURATION_COLS = ['Trajanje', 'trajanje', 'duration'];
const CURRENCY_COLS = ['Valuta', 'valuta', 'currency'];

const EMPLOYEE_ID_COLS = ['ID Osebe', 'ID osebe', 'ID osebja', 'id', 'person_id'];
const EMPLOYEE_SERVICES_COLS = ['Storitve', 'storitve', 'services'];

const APPOINTMENT_EMPLOYEE_COLS = ['ID Osebe', 'ID osebe'];
const APPOINTMENT_DATE_COLS = ['Datum', 'datum', 'date'];
const APPOINTMENT_START_COLS = ['Čas', 'cas_zacetek', 'start_time'];
const APPOINTMENT_END_COLS = ['Konec', 'cas_konec', 'end_time'];

async function fetchServiceDetails(
  supabase: ReturnType<typeof getClient>,
  storitev_id: string
): Promise<{ id: string; naziv: string; cena: number; trajanje: number; valuta: string } | null> {
  for (const col of SERVICE_ID_COLS) {
    const { data } = await supabase.from('Storitve').select('*').eq(col, storitev_id).limit(1);
    if (data && data.length > 0) {
      const svc = data[0] as Record<string, unknown>;
      const nameCol = SERVICE_NAME_COLS.find((c) => svc[c] !== undefined);
      const priceCol = PRICE_COLS.find((c) => svc[c] !== undefined && svc[c] !== null && svc[c] !== '');
      const durCol = DURATION_COLS.find((c) => svc[c] !== undefined);
      const currCol = CURRENCY_COLS.find((c) => svc[c] !== undefined);
      return {
        id: storitev_id,
        naziv: nameCol ? String(svc[nameCol] ?? '') : '',
        cena: priceCol ? Number(svc[priceCol] ?? 0) : 0,
        trajanje: durCol ? Number(svc[durCol] ?? 0) : 0,
        valuta: currCol ? String(svc[currCol] ?? 'EUR') : 'EUR',
      };
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      company_id: string;
      main_storitev_id: string;
      zaposleni_id: string;
      datum: string;
      cas_konec: string;
    };

    const { company_id, main_storitev_id, zaposleni_id, datum, cas_konec } = body;

    if (!company_id || !main_storitev_id || !zaposleni_id || !datum || !cas_konec) {
      return NextResponse.json({ ok: false, data: [], error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getClient();

    // 1 — Fetch employee to get their services list
    let employeeServices: string[] = [];
    for (const col of EMPLOYEE_ID_COLS) {
      const { data } = await supabase.from('Osebe').select('*').eq(col, zaposleni_id).limit(1);
      if (data && data.length > 0) {
        const emp = data[0] as Record<string, unknown>;
        const svcCol = EMPLOYEE_SERVICES_COLS.find((c) => emp[c] !== undefined);
        if (svcCol) {
          const raw = emp[svcCol];
          if (typeof raw === 'string') {
            try { employeeServices = JSON.parse(raw) as string[]; } catch { employeeServices = []; }
          } else if (Array.isArray(raw)) {
            employeeServices = raw.map(String);
          }
        }
        break;
      }
    }

    // 2 — Fetch active add-ons for this company
    const { data: addOns, error: aoErr } = await supabase
      .from('add_on_storitve')
      .select('*')
      .eq('company_id', company_id)
      .eq('aktiven', true)
      .neq('storitev_id', main_storitev_id);

    if (aoErr) throw aoErr;

    // Filter to only services the employee can perform
    const eligibleAddOns = (addOns || []).filter((ao) => {
      if (employeeServices.length === 0) return true; // employee does all services
      return employeeServices.includes(String(ao.storitev_id));
    });

    // 3 — For each eligible add-on, check availability and fetch service details
    const available = await Promise.all(
      eligibleAddOns.map(async (ao) => {
        const svcDetails = await fetchServiceDetails(supabase, ao.storitev_id);
        if (!svcDetails) return null;

        const addOnEndTime = addMinutesToTime(cas_konec, svcDetails.trajanje);

        // Check for conflicting appointments
        // Conflict: appointment starts before add-on ends AND appointment ends after add-on starts
        let hasConflict = false;
        for (const empCol of APPOINTMENT_EMPLOYEE_COLS) {
          const { data: conflicts } = await supabase
            .from('Termini')
            .select('*')
            .eq(empCol, zaposleni_id)
            .limit(1);

          // If query worked, filter in JS (avoids multi-column name issues)
          if (conflicts !== null) {
            for (const appt of conflicts) {
              const row = appt as Record<string, unknown>;
              const dateCol = APPOINTMENT_DATE_COLS.find((c) => row[c] !== undefined);
              const startCol = APPOINTMENT_START_COLS.find((c) => row[c] !== undefined);
              const endCol = APPOINTMENT_END_COLS.find((c) => row[c] !== undefined);

              if (!dateCol || !startCol || !endCol) continue;

              const apptDate = String(row[dateCol] ?? '').substring(0, 10);
              if (apptDate !== datum) continue;

              const apptStart = String(row[startCol] ?? '').substring(0, 5);
              const apptEnd = String(row[endCol] ?? '').substring(0, 5);

              // Conflict: appt starts before add-on ends AND appt ends after add-on starts
              if (apptStart < addOnEndTime && apptEnd > cas_konec) {
                hasConflict = true;
                break;
              }
            }
            break; // column name found
          }
        }

        if (hasConflict) return null;

        const originalCena = svcDetails.cena;
        const finalCena = ao.tip_popusta === 'percentage'
          ? Math.max(0, originalCena - (originalCena * ao.vrednost_popusta) / 100)
          : Math.max(0, originalCena - ao.vrednost_popusta);

        return {
          id: ao.id,
          storitev_id: ao.storitev_id,
          naziv: svcDetails.naziv,
          original_cena: originalCena,
          final_cena: finalCena,
          tip_popusta: ao.tip_popusta,
          vrednost_popusta: ao.vrednost_popusta,
          trajanje: svcDetails.trajanje,
          valuta: svcDetails.valuta,
        };
      })
    );

    const result = available.filter(Boolean);

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error('[api/promotions/add-ons/available]', err);
    return NextResponse.json({ ok: false, data: [], error: String(err) }, { status: 500 });
  }
}
