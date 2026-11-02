// lib/auth/locationAccess.ts
//
// Location restriction for requests that go to n8n through /api/webhook.
//
// n8n writes with the service role, so the database cannot tell which user is
// behind a write. This is the same rule as jp_ima_dostop_do_lokacije in the
// database (1793400005), applied before the request is forwarded:
//
//   owner                                    all locations
//   member without rows in Clani_Lokacije    all locations (the case for every
//                                            company today)
//   member with rows                         only those locations
//
// Only a clearly wrong request is refused. If a lookup itself fails the
// request goes through: this is a second line behind the interface and the
// database, and must not take the whole app down.

import type { SupabaseClient } from '@supabase/supabase-js';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Events that create an appointment: without a location they land on the main one. */
const CREATE_EVENTS = new Set(['NOV_TERMIN', 'APPOINTMENT_CREATED']);

/** Keys that carry the id of an existing appointment in the payloads the app sends. */
const APPOINTMENT_ID_KEYS = new Set(['appointment_id', 'booking_id', 'ID termina', 'ID_termina']);

/**
 * Locations a member is limited to, or null when they have no limit.
 * Throws on a failed lookup so the caller can decide to let the request through.
 */
export async function allowedLocationIds(
  admin: SupabaseClient,
  userId: string,
  companyUuid: string
): Promise<Set<string> | null> {
  const { data: member, error: memberError } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', companyUuid)
    .maybeSingle();
  if (memberError) throw memberError;
  if (member?.role === 'owner') return null;

  const { data: rows, error } = await admin
    .from('Clani_Lokacije')
    .select('lokacija_id')
    .eq('user_id', userId)
    .eq('company_id', companyUuid);
  if (error) throw error;
  if (!rows || rows.length === 0) return null;
  return new Set(rows.map((row) => String(row.lokacija_id)));
}

/** Every value stored under one of `keys`, anywhere in the payload (depth-limited). */
function collect(value: unknown, keys: Set<string>, found: Set<string>, depth = 0): void {
  if (depth > 5) return;
  if (Array.isArray(value)) {
    for (const item of value) collect(item, keys, found, depth + 1);
    return;
  }
  if (!isObject(value)) return;
  for (const [key, inner] of Object.entries(value)) {
    if (keys.has(key) && (typeof inner === 'string' || typeof inner === 'number') && String(inner).trim()) {
      found.add(String(inner).trim());
    } else {
      collect(inner, keys, found, depth + 1);
    }
  }
}

const LOCATION_KEYS = new Set(['lokacija_id', 'lokacijaId']);

/**
 * `null` when the request is fine for this member, otherwise a short reason.
 * `companyText` is companies.company_id (e.g. "7LHB28").
 */
export async function locationViolation(
  admin: SupabaseClient,
  allowed: Set<string>,
  companyText: string,
  payload: Json
): Promise<string | null> {
  // 1. A location named in the payload must be one the member may use.
  const named = new Set<string>();
  collect(payload, LOCATION_KEYS, named);
  for (const id of named) {
    if (!allowed.has(id)) return 'Nimate dostopa do izbrane lokacije.';
  }

  // 2. An existing appointment must belong to one of the member's locations.
  const appointmentIds = new Set<string>();
  collect(isObject(payload.data) ? payload.data : payload, APPOINTMENT_ID_KEYS, appointmentIds);
  if (appointmentIds.size > 0) {
    const { data: rows, error } = await admin
      .from('Termini')
      .select('lokacija_id')
      .eq('ID podjetja', companyText)
      .in('ID termina', [...appointmentIds]);
    if (error) throw error;
    for (const row of rows ?? []) {
      if (row.lokacija_id && !allowed.has(String(row.lokacija_id))) {
        return 'Termin pripada lokaciji, do katere nimate dostopa.';
      }
    }
  }

  // 3. A new appointment without a location lands on the main one.
  const event = typeof payload.event === 'string' ? payload.event.toUpperCase() : '';
  if (CREATE_EVENTS.has(event) && named.size === 0) {
    const { data: main, error } = await admin
      .from('Lokacije')
      .select('id')
      .eq('ID podjetja', companyText)
      .eq('je_glavna', true)
      .maybeSingle();
    if (error) throw error;
    if (main && !allowed.has(String(main.id))) {
      return 'Izberite lokacijo, do katere imate dostop.';
    }
  }

  return null;
}
