// lib/clients/fetchClientsData.server.ts
//
// Server-side loader for the Stranke (clients) page. Session-aware, de-duplicated
// counterpart to the browser fetchClientsWithCount + getClientStats pair.
//
// Differences from the browser path, both deliberate:
//  1. Runs on the server with the user's COOKIE session (createServerSupabaseClient),
//     so RLS (auth.uid()) is satisfied.
//  2. Fetches clients + bookings ONCE and derives BOTH the client list (with
//     appointment_count) and the stats from the shared rows. The browser path
//     fetched clients + the 5000-row bookings table TWICE — getClientStats calls
//     fetchClientsWithCount again purely to recompute 3 numbers.
//
// Parsing/counting/stat logic mirrors lib/supabase/clients.ts exactly (reusing the
// exported parseClient), so the rendered output is identical. The browser
// functions there are left untouched.

import "server-only";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { safeDate } from "@/lib/dashboardHelpers";
import { parseClient } from "@/lib/supabase/clients";
import { TABLES } from "@/lib/data";
import type { Client, ClientStats } from "@/types/clients";

type Row = Record<string, unknown>;
type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export interface ClientsInitialData {
  clients: Client[];
  stats: ClientStats;
}

const COMPANY_COLUMN_CANDIDATES = [
  "ID podjetja",
  "ID Podjetja",
  "ID_podjetja",
  "company_id",
  "companyId",
];

const isMissingColumnError = (error: { message?: string; code?: string }) => {
  if (error.code === "42703") return true;
  if (!error.message) return false;
  return error.message.includes("does not exist") && error.message.includes("column");
};

async function fetchTableOnce(
  supabase: ServerClient,
  tableName: string,
  companyId: string,
  orderColumn?: string
): Promise<Row[]> {
  for (const col of COMPANY_COLUMN_CANDIDATES) {
    const rows: Row[] = [];
    let columnExists = false;

    for (let from = 0; ; from += 1000) {
      let query = supabase
        .from(tableName)
        .select("*")
        .eq(col, companyId);

      if (orderColumn) {
        query = query.order(orderColumn, { ascending: false });
      }

      const { data, error } = await query.range(from, from + 999);

      if (error) {
        if (isMissingColumnError(error)) break;
        console.warn(`[Clients.server] ${tableName} fetch error:`, error.message);
        return [];
      }

      columnExists = true;
      const page = (data as Row[] | null) ?? [];
      rows.push(...page);

      if (page.length < 1000) return rows;
    }

    if (columnExists) return rows;
  }
  return [];
}

// Build the client list with appointment_count — mirrors fetchClientsWithCount.
function buildClients(clientRows: Row[], bookingRows: Row[]): Client[] {
  const appointmentCounts = new Map<string, number>();
  for (const apt of bookingRows) {
    const clientId = apt["ID stranke"] || apt["stranka_id"] || apt["client_id"];
    if (clientId) {
      const id = String(clientId);
      appointmentCounts.set(id, (appointmentCounts.get(id) || 0) + 1);
    }
  }

  const clients: Client[] = [];
  for (const row of clientRows) {
    const client = parseClient(row);
    if (client) {
      client.appointment_count = appointmentCounts.get(client.id) || 0;
      clients.push(client);
    }
  }

  clients.sort((a, b) => {
    const lastNameCompare = a.priimek.localeCompare(b.priimek, "sl");
    if (lastNameCompare !== 0) return lastNameCompare;
    return a.ime.localeCompare(b.ime, "sl");
  });

  return clients;
}

// Derive stats from the already-built client list — mirrors getClientStats.
function buildStats(clients: Client[]): ClientStats {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    total: clients.length,
    withAppointments: clients.filter((c) => (c.appointment_count || 0) > 0).length,
    newThisMonth: clients.filter((c) => {
      if (!c.created_at) return false;
      const parsedDate = safeDate(c.created_at);
      if (!parsedDate) return false;
      return parsedDate >= startOfMonth;
    }).length,
  };
}

/**
 * Loads the Stranke page's initial data server-side for the given company.
 * Returns null when there is no authenticated session (page should fall back).
 */
export async function fetchClientsDataServer(companyId: string): Promise<ClientsInitialData | null> {
  if (!companyId || companyId.trim() === "") return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Single fetch per table, shared across the list + stats (was 2x each before).
  const [clientRows, bookingRows] = await Promise.all([
    fetchTableOnce(supabase, TABLES.clients, companyId),
    fetchTableOnce(supabase, TABLES.bookings, companyId, "Datum"),
  ]);

  const clients = buildClients(clientRows, bookingRows);
  return { clients, stats: buildStats(clients) };
}
