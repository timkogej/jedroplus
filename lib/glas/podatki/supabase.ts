// lib/glas/podatki/supabase.ts
//
// Dostop do podatkov salona za orodja asistenta — VEDNO z uporabnikovo sejo
// (createServerSupabaseClient), zato RLS omeji podjetje in lokacije točno
// tako kot v aplikaciji. Service role se tukaj ne uporablja.
//
// Bere le stolpce, ki jih orodja potrebujejo. Telefon, e-pošto in opombe bere samo
// podrobnostiStranke (za glasovni odgovor; modelu AI ne gredo).

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAppointmentStatus } from '@/lib/appointments/status';
import type {
  LokacijePovzetek, NovZapisek, OdsotnostPovzetek, OsebaPovzetek, PodatkiSalona, PodrobnostiStranke, ResursPovzetek, StoritevPovzetek, StrankaPovzetek,
  TerminPovzetek, ZapisekPovzetek,
} from '../tipi';

type Vrstica = Record<string, unknown>;

const niz = (v: unknown) => (v === null || v === undefined ? '' : String(v)).trim();
const ura = (v: unknown) => {
  const s = niz(v);
  return s ? s.slice(0, 5) : '';
};

/** Trajanje storitve iz besedila ("60", "1h 30min", "90 min") v minutah. */
export function trajanjeVMinutah(skupno: unknown, osnovno: unknown): number {
  for (const v of [skupno, osnovno]) {
    const s = niz(v).toLowerCase();
    if (!s) continue;
    const h = s.match(/(\d+)\s*h/);
    const m = s.match(/(\d+)\s*m/);
    if (h || m) return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
    const n = parseInt(s, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 60;
}

function aktivna(v: unknown): boolean {
  const s = niz(v).toLowerCase();
  // Neaktivno samo, če je izrecno označeno; prazno = aktivno (kot v aplikaciji).
  return !(s === 'inactive' || s === 'false' || s === '0' || s.startsWith('neaktiv'));
}

function daNe(v: unknown, privzeto: boolean): boolean {
  const s = niz(v).toLowerCase();
  if (!s) return privzeto;
  return s === 'true' || s === '1' || s === 'da' || s === 'yes';
}

function seznamStoritev(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  const s = niz(v);
  if (!s) return [];
  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) return j.map(String);
  } catch {
    /* vejice */
  }
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

function vTermin(r: Vrstica): TerminPovzetek {
  return {
    id: niz(r['ID termina']),
    vrstica: niz(r['id']) || undefined,
    idStranke: niz(r['ID stranke']) || null,
    stranka: niz(r['Stranka']),
    datum: niz(r['Datum']).slice(0, 10),
    zacetek: ura(r['Čas']),
    konec: ura(r['Konec']) || null,
    storitev: niz(r['Storitev']),
    osebaId: niz(r['ID Osebe']) || null,
    oseba: niz(r['Oseba']),
    status: normalizeAppointmentStatus(r['Status']),
    lokacijaId: niz(r['lokacija_id']) || null,
  };
}

const STOLPCI_TERMINA = 'id,"ID termina","ID stranke",Stranka,Datum,"Čas",Konec,Storitev,"ID Osebe",Oseba,Status,lokacija_id';

export function podatkiSupabase(seja: SupabaseClient, podjetje: string): PodatkiSalona {
  let strankeCache: Promise<StrankaPovzetek[]> | null = null;

  return {
    stranke() {
      strankeCache ??= (async () => {
        const out: StrankaPovzetek[] = [];
        for (let od = 0; od < 20_000; od += 1000) {
          const { data, error } = await seja
            .from('Stranke')
            .select('"ID stranke",Ime,Priimek,Stranka,"Zadnja interakcija"')
            .eq('ID Podjetja', podjetje)
            .order('id', { ascending: true })
            .range(od, od + 999);
          if (error) throw new Error(`stranke: ${error.code ?? 'napaka'}`);
          for (const r of (data ?? []) as Vrstica[]) out.push(vStranko(r));
          if ((data ?? []).length < 1000) break;
        }
        return out;
      })();
      return strankeCache;
    },

    async stranka(idStranke) {
      const { data, error } = await seja
        .from('Stranke')
        .select('"ID stranke",Ime,Priimek,Stranka,"Zadnja interakcija"')
        .eq('ID Podjetja', podjetje)
        .eq('ID stranke', idStranke)
        .limit(1);
      if (error) throw new Error(`stranka: ${error.code ?? 'napaka'}`);
      const r = (data ?? [])[0] as Vrstica | undefined;
      return r ? vStranko(r) : null;
    },

    async storitve(): Promise<StoritevPovzetek[]> {
      const { data, error } = await seja
        .from('Storitve')
        .select('"ID storitve",Naziv,Trajanje,"Skupno trajanje",Status')
        .eq('ID podjetja', podjetje);
      if (error) throw new Error(`storitve: ${error.code ?? 'napaka'}`);
      return ((data ?? []) as Vrstica[]).map((r) => ({
        id: niz(r['ID storitve']),
        naziv: niz(r['Naziv']),
        trajanjeMin: trajanjeVMinutah(r['Skupno trajanje'], r['Trajanje']),
        aktivna: aktivna(r['Status']),
      }));
    },

    async osebe(): Promise<OsebaPovzetek[]> {
      const { data, error } = await seja
        .from('Osebe')
        .select('"ID osebe",Ime,Priimek,Status,Urnik,Storitve,"Ali opravlja vse","Ali ima urnik podjetja"')
        .eq('ID podjetja', podjetje);
      if (error) throw new Error(`osebe: ${error.code ?? 'napaka'}`);
      return ((data ?? []) as Vrstica[]).map((r) => ({
        id: niz(r['ID osebe']),
        ime: niz(r['Ime']),
        priimek: niz(r['Priimek']),
        aktivna: aktivna(r['Status']),
        urnik: r['Urnik'] ?? null,
        imaUrnikPodjetja: daNe(r['Ali ima urnik podjetja'], true),
        opravljaVse: daNe(r['Ali opravlja vse'], true),
        storitve: seznamStoritev(r['Storitve']),
      }));
    },

    async termini(od, doo, moznosti) {
      const { data, error } = await seja
        .from('Termini')
        .select(STOLPCI_TERMINA)
        .eq('ID podjetja', podjetje)
        .gte('Datum', od)
        .lte('Datum', doo)
        .is('deleted_at', null)
        .order('Datum', { ascending: !moznosti?.padajoce })
        .limit(2000);
      if (error) throw new Error(`termini: ${error.code ?? 'napaka'}`);
      return ((data ?? []) as Vrstica[]).map(vTermin);
    },

    async zgodovinaTerminov(od, doo) {
      // Po straneh (PostgREST vrne največ 1000 vrstic naenkrat); stabilen vrstni red po id.
      const STRAN = 1000;
      const vse: TerminPovzetek[] = [];
      for (let i = 0; i < 20; i++) {
        const { data, error } = await seja
          .from('Termini')
          .select(STOLPCI_TERMINA)
          .eq('ID podjetja', podjetje)
          .gte('Datum', od)
          .lte('Datum', doo)
          .is('deleted_at', null)
          .order('id', { ascending: true })
          .range(i * STRAN, i * STRAN + STRAN - 1);
        if (error) throw new Error(`zgodovina terminov: ${error.code ?? 'napaka'}`);
        const vrstice = (data ?? []) as Vrstica[];
        vse.push(...vrstice.map(vTermin));
        if (vrstice.length < STRAN) break;
      }
      return vse;
    },

    async zadnjiTermin(idStranke, predDatumom) {
      const { data, error } = await seja
        .from('Termini')
        .select(STOLPCI_TERMINA)
        .eq('ID podjetja', podjetje)
        .eq('ID stranke', idStranke)
        .lt('Datum', predDatumom)
        .is('deleted_at', null)
        .order('Datum', { ascending: false })
        .limit(10);
      if (error) throw new Error(`zadnji termin: ${error.code ?? 'napaka'}`);
      return ((data ?? []) as Vrstica[]).map(vTermin).find((t) => t.status !== 'cancelled' && t.status !== 'no_show') ?? null;
    },

    async naslednjiTermin(idStranke, odDatuma) {
      const { data, error } = await seja
        .from('Termini')
        .select(STOLPCI_TERMINA)
        .eq('ID podjetja', podjetje)
        .eq('ID stranke', idStranke)
        .gte('Datum', odDatuma)
        .is('deleted_at', null)
        .order('Datum', { ascending: true })
        .limit(10);
      if (error) throw new Error(`naslednji termin: ${error.code ?? 'napaka'}`);
      return ((data ?? []) as Vrstica[]).map(vTermin).find((t) => t.status === 'scheduled' || t.status === 'confirmed') ?? null;
    },

    async urnikPodjetja() {
      const { data } = await seja.from('Podatki podjetij').select('urnik').eq('ID Podjetja', podjetje).maybeSingle();
      return (data as Vrstica | null)?.urnik ?? null;
    },

    async odsotnosti(od, doo): Promise<OdsotnostPovzetek[]> {
      const { data, error } = await seja
        .from('absences')
        .select('employee_id,start_at,end_at,status')
        .eq('company_id', podjetje)
        .lte('start_at', `${doo}T23:59:59Z`)
        .gte('end_at', `${od}T00:00:00Z`);
      if (error) return []; // odsotnosti so dodatek; brez njih je odgovor še vedno okviren
      // absences.employee_id je Osebe.id (bigint); termini uporabljajo "ID osebe".
      // Preslikamo v orodju ni mogoče brez dodatnega branja, zato tukaj:
      const ids = [...new Set(((data ?? []) as Vrstica[]).map((r) => niz(r.employee_id)).filter(Boolean))];
      const preslikava = new Map<string, string>();
      if (ids.length) {
        const { data: osebe } = await seja.from('Osebe').select('id,"ID osebe"').eq('ID podjetja', podjetje).in('id', ids);
        for (const o of (osebe ?? []) as Vrstica[]) preslikava.set(niz(o.id), niz(o['ID osebe']));
      }
      return ((data ?? []) as Vrstica[])
        .filter((r) => !/zavrn|reject|cancel|preklic/i.test(niz(r.status)))
        .map((r) => ({
          osebaId: r.employee_id ? preslikava.get(niz(r.employee_id)) ?? `id:${niz(r.employee_id)}` : null,
          zacetek: niz(r.start_at),
          konec: niz(r.end_at),
        }));
    },

    async dodajZapisek(z: NovZapisek) {
      // Vstavi uporabnik sam (RLS: članstvo + can_edit_clients + stranka podjetja).
      const { data, error } = await seja
        .from('stranke_zapiski')
        .insert({
          'ID podjetja': z.podjetje,
          'ID stranke': z.idStranke,
          kategorija: z.kategorija,
          besedilo: z.besedilo,
          podrobnosti: z.podrobnosti,
          vir: 'glas',
          ukaz_id: z.ukazId,
          avtor_ime: z.avtorIme,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(`zapisek: ${error?.code ?? 'napaka'}`);
      return { id: String(data.id) };
    },

    async zapiskiStranke(idStranke, najvec): Promise<ZapisekPovzetek[]> {
      const { data, error } = await seja
        .from('stranke_zapiski')
        .select('kategorija,besedilo,podrobnosti,created_at')
        .eq('ID podjetja', podjetje)
        .eq('ID stranke', idStranke)
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(1, najvec), 20));
      if (error) throw new Error(`zapiski: ${error.code ?? 'napaka'}`);
      return ((data ?? []) as Vrstica[]).map((r) => ({
        kategorija: niz(r.kategorija) as ZapisekPovzetek['kategorija'],
        besedilo: niz(r.besedilo),
        podrobnosti: (r.podrobnosti && typeof r.podrobnosti === 'object' ? r.podrobnosti : {}) as ZapisekPovzetek['podrobnosti'],
        datum: niz(r.created_at).slice(0, 10),
      }));
    },

    async interneOpombe(idStranke) {
      const { data, error } = await seja
        .from('Stranke')
        .select('"Interne opombe"')
        .eq('ID Podjetja', podjetje)
        .eq('ID stranke', idStranke)
        .limit(1);
      if (error) return null; // dodatek; brez njega je kartica še vedno uporabna
      const v = niz(((data ?? [])[0] as Vrstica | undefined)?.['Interne opombe']);
      return v || null;
    },

    async podrobnostiStranke(idStranke, danes): Promise<PodrobnostiStranke | null> {
      // Imena stolpcev se med starimi in novimi bazami razlikujejo (kot lib/supabase/clients.ts).
      const [st, te] = await Promise.all([
        seja.from('Stranke').select('*').eq('ID Podjetja', podjetje).eq('ID stranke', idStranke).limit(1),
        seja.from('Termini').select('Datum,Status').eq('ID podjetja', podjetje).eq('ID stranke', idStranke).is('deleted_at', null).limit(2000),
      ]);
      if (st.error) throw new Error(`podrobnosti stranke: ${st.error.code ?? 'napaka'}`);
      const r = (st.data ?? [])[0] as Vrstica | undefined;
      if (!r) return null;
      const prvo = (imena: string[]) => {
        for (const i of imena) if (i in r && niz(r[i])) return niz(r[i]);
        return null;
      };
      const odjava = Boolean(r.marketing_opt_out_at);
      const privolitev = r.marketing_consent;
      let obiski = 0;
      let neprihodi = 0;
      for (const t of (te.error ? [] : (te.data ?? [])) as Vrstica[]) {
        const status = normalizeAppointmentStatus(t['Status']);
        if (status === 'no_show') neprihodi++;
        else if (status !== 'cancelled' && niz(t['Datum']).slice(0, 10) < danes) obiski++;
      }
      return {
        telefon: prvo(['Telefonska številka', 'Telefon', 'telefon', 'phone', 'Phone', 'tel']),
        email: prvo(['Email stranke', 'Email', 'email', 'e-mail', 'E-mail']),
        jezik: prvo(['language', 'Language', 'Jezik komunikacije', 'jezik_komunikacije', 'Jezik', 'jezik', 'preferred_language']),
        opombe: prvo(['Opombe stranke', 'Opombe', 'opombe', 'notes', 'Notes', 'Opombe strank']),
        interneOpombe: prvo(['Interne opombe', 'interne_opombe', 'internal_notes', 'Internal notes']),
        marketing: odjava ? false : privolitev === true ? true : privolitev === false ? false : null,
        obiski,
        neprihodi,
      };
    },

    async resursi(): Promise<ResursPovzetek[]> {
      const { data, error } = await seja
        .from('Resursi')
        .select('id,Naziv,Kolicina,Status')
        .eq('ID podjetja', podjetje)
        .order('Naziv');
      if (error) throw new Error(`resursi: ${error.code ?? 'napaka'}`);
      return ((data ?? []) as Vrstica[]).map((r) => ({
        id: niz(r.id),
        naziv: niz(r['Naziv']),
        kolicina: Math.max(1, Number(r['Kolicina']) || 1),
        aktivna: aktivna(r['Status']),
      }));
    },

    async resursiTerminov(vrstice) {
      const ids = [...new Set(vrstice.filter((v) => /^\d+$/.test(v)))];
      if (ids.length === 0) return [];
      const out: { vrstica: string; resursId: string }[] = [];
      for (let i = 0; i < ids.length; i += 300) {
        const { data, error } = await seja
          .from('Termini_Resursi')
          .select('termin_id,resurs_id')
          .eq('ID podjetja', podjetje)
          .in('termin_id', ids.slice(i, i + 300));
        if (error) throw new Error(`resursi terminov: ${error.code ?? 'napaka'}`);
        for (const r of (data ?? []) as Vrstica[]) out.push({ vrstica: niz(r.termin_id), resursId: niz(r.resurs_id) });
      }
      return out;
    },

    async zahteveVPregledu() {
      const { count, error } = await seja
        .from('zahteve_termini')
        .select('id', { count: 'exact', head: true })
        .eq('ID podjetja', podjetje)
        .eq('status', 'v_pregledu');
      if (error) throw new Error(`zahteve: ${error.code ?? 'napaka'}`);
      return count ?? 0;
    },

    async strankeSPreteklimTerminom(idStrank, predDatumom) {
      const ids = [...new Set(idStrank.filter(Boolean))];
      const out = new Set<string>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await seja
          .from('Termini')
          .select('"ID stranke",Status')
          .eq('ID podjetja', podjetje)
          .in('ID stranke', ids.slice(i, i + 200))
          .lt('Datum', predDatumom)
          .is('deleted_at', null)
          .limit(2000);
        if (error) throw new Error(`pretekli termini: ${error.code ?? 'napaka'}`);
        for (const r of (data ?? []) as Vrstica[]) {
          if (normalizeAppointmentStatus(r['Status']) !== 'cancelled') out.add(niz(r['ID stranke']));
        }
      }
      return out;
    },

    async opombeStrank(idStrank) {
      const ids = [...new Set(idStrank.filter(Boolean))].slice(0, 200);
      if (ids.length === 0) return {};
      // '*': ime stolpca z opombami se med bazami razlikuje (kot podrobnostiStranke).
      const { data, error } = await seja.from('Stranke').select('*').eq('ID Podjetja', podjetje).in('ID stranke', ids);
      if (error) return {}; // dodatek: povzetek brez opomb je še vedno uporaben
      const out: Record<string, string> = {};
      for (const r of (data ?? []) as Vrstica[]) {
        for (const i of ['Opombe stranke', 'Opombe', 'opombe', 'notes', 'Notes', 'Opombe strank']) {
          if (i in r && niz(r[i])) {
            out[niz(r['ID stranke'])] = niz(r[i]).slice(0, 300);
            break;
          }
        }
      }
      return out;
    },

    async analitika(od, doo) {
      // Isto kot stran Analitika (fetchTableRowsByDateRange + fetchTableRows), a na strežniku z uporabnikovo sejo.
      const termini: Vrstica[] = [];
      for (let i = 0; i < 50_000; i += 1000) {
        const { data, error } = await seja
          .from('Termini')
          .select('*')
          .eq('ID podjetja', podjetje)
          .gte('Datum', od)
          .lte('Datum', doo)
          .order('Datum', { ascending: false })
          .order('id', { ascending: false })
          .range(i, i + 999);
        if (error) throw new Error(`analitika termini: ${error.code ?? 'napaka'}`);
        termini.push(...((data ?? []) as Vrstica[]));
        if ((data ?? []).length < 1000) break;
      }
      const [st, os] = await Promise.all([
        seja.from('Storitve').select('*').eq('ID podjetja', podjetje).limit(1000),
        seja.from('Osebe').select('*').eq('ID podjetja', podjetje).limit(1000),
      ]);
      if (st.error || os.error) throw new Error(`analitika cenik: ${(st.error ?? os.error)?.code ?? 'napaka'}`);
      return { termini, storitve: (st.data ?? []) as Vrstica[], osebe: (os.data ?? []) as Vrstica[] };
    },

    async imePodjetja() {
      // RLS: član bere svoje podjetje.
      const { data } = await seja.from('companies').select('name').eq('company_id', podjetje).maybeSingle();
      return niz((data as { name?: unknown } | null)?.name).slice(0, 40);
    },

    async lokacije(): Promise<LokacijePovzetek> {
      const { data, error } = await seja
        .from('Lokacije')
        .select('id,naziv,je_glavna')
        .eq('ID podjetja', podjetje)
        .eq('status', 'active')
        .order('je_glavna', { ascending: false })
        .order('zaporedje');
      if (error) throw new Error(`lokacije: ${error.code ?? 'napaka'}`);
      const vse = ((data ?? []) as Vrstica[]).map((r) => ({ id: niz(r.id), naziv: niz(r.naziv), glavna: r.je_glavna === true }));
      if (vse.length <= 1) return { seznam: vse, osebe: {}, storitve: {} };
      // Član z omejitvijo (Clani_Lokacije) vidi samo svoje lokacije — isto pravilo kot v bazi
      // in /api/webhook. Če preverjanje odpove, lokacija ostane (zapis jo preveri še enkrat).
      const dostop = await Promise.all(
        vse.map(async (l) => {
          const { data: ok, error: e } = await seja.rpc('jp_ima_dostop_do_lokacije', { p_company: podjetje, p_lokacija: l.id });
          return e ? true : ok !== false;
        })
      );
      const seznam = vse.filter((_, i) => dostop[i]);
      const [po, ps] = await Promise.all([
        seja.from('Osebe_Lokacije').select('"ID osebe",lokacija_id').eq('ID podjetja', podjetje),
        seja.from('Storitve_Lokacije').select('"ID storitve",lokacija_id').eq('ID podjetja', podjetje),
      ]);
      if (po.error || ps.error) throw new Error(`lokacije povezave: ${(po.error ?? ps.error)?.code ?? 'napaka'}`);
      const zdruzi = (vrstice: Vrstica[], stolpec: string) => {
        const out: Record<string, string[]> = {};
        for (const r of vrstice) (out[niz(r[stolpec])] ??= []).push(niz(r.lokacija_id));
        return out;
      };
      return {
        seznam,
        osebe: zdruzi((po.data ?? []) as Vrstica[], 'ID osebe'),
        storitve: zdruzi((ps.data ?? []) as Vrstica[], 'ID storitve'),
      };
    },
  };
}

function vStranko(r: Vrstica): StrankaPovzetek {
  let ime = niz(r['Ime']);
  let priimek = niz(r['Priimek']);
  if (!ime && !priimek) {
    const deli = niz(r['Stranka']).split(/\s+/);
    ime = deli[0] ?? '';
    priimek = deli.slice(1).join(' ');
  }
  return { id: niz(r['ID stranke']), ime, priimek, zadnjaInterakcija: niz(r['Zadnja interakcija']).slice(0, 10) || null };
}
