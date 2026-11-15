// lib/glas/orodja/opomniki.ts
//
// Osebni opomniki (docs/glasovni-asistent-dodatne-funkcije-nacrt.md, §5):
//   nov_opomnik      »Opomni me jutri ob devetih, da pokličem dobavitelja.« / »Ko pride Ana, me opomni …«
//   moji_opomniki    »Kateri opomniki so mi ostali?«
//   preklici_opomnik »Izbriši opomnik za dobavitelja.«
//
// Opomnik je za uporabnika samega; lastnik in admin lahko opomnita tudi sodelavca z
// računom (»opomni Tino …«, v2). Pred shranjevanjem asistent pove točen čas (dan, datum,
// ura) in komu; shrani šele po potrditvi. Čas se računa v pasu podjetja.

import { z } from 'zod';
import { imaPravico, samoSvojiTermini } from '../pravice';
import { dodajDni, opisDatuma, vMinute, zdajVPasu } from '../razresevanje/datumi';
import { brezSumnikov } from '../razresevanje/besedilo';
import { uraZaGovor } from '../govor';
import { trenutniJezik } from '../jeziki/jezik';
import { inSeznam, jt } from '../jeziki/t';
import { casVPasu, DELI_DNEVA, type DelDneva } from '../opomniki/cas';
import { NAJVEC_OPOMNIKOV, type Opomnik } from '../opomniki/tipi';
import type { OsebaPovzetek, Predogled, RezultatOrodja, TerminPovzetek } from '../tipi';
import { datumIzParametra } from './branje';
import { uraIzParametra } from './obrazci';
import { izberiOsebo, jeRezultat } from './obrazci';
import { ID_STRANKE, razresiStranko } from './stranke';
import type { BralnoOrodje, OkoljeOrodja, PisalnoOrodje } from './tipi';

const DNI_TERMIN = 60;
const NAJVEC_DNI_NAPREJ = 366;
const JEZIKI = ['sl', 'en', 'de', 'it', 'hr'] as const;
const aktiven = (t: TerminPovzetek) => t.status === 'scheduled' || t.status === 'confirmed';

/** "jutri, sobota 15. 11. ob 9:00" za zaslon. */
function kdajZaslon(ob: Date, o: OkoljeOrodja): string {
  const l = zdajVPasu(ob, o.k.casovniPas);
  return jt('{datum} ob {ura}', { datum: opisDatuma(l.datum, o.danes), ura: l.ura });
}
function kdajGovor(ob: Date, o: OkoljeOrodja): string {
  const l = zdajVPasu(ob, o.k.casovniPas);
  return jt('{datum} ob {ura}', { datum: opisDatuma(l.datum, o.danes), ura: uraZaGovor(l.ura) });
}

const NI_NASTAVLJENO: RezultatOrodja = { sporocilo: jt('Opomniki še niso nastavljeni.') };

// ───────────────────────────────────────────────────────────────────────────
// Brez unij tipov (Anthropic dovoli največ 16 v strogih orodjih): prazno = "" ali 0.
const prazno = (n: number) => z.string().max(n).nullable().transform((s) => s?.trim() || null);
const vhodNov = z.object({
  besedilo: z.string().trim().min(1).max(300),
  datum: prazno(60),
  ura: prazno(40),
  del_dneva: z.enum(['', 'zjutraj', 'dopoldne', 'popoldne', 'zvecer']).nullable().transform((s) => (s || null) as DelDneva | null),
  cez_minut: z.number().int().min(0).max(60 * 24 * 7).nullable().transform((n) => n || null),
  ob_terminu: z.boolean(),
  stranka: prazno(80),
  stranka_id: z.union([z.literal(''), z.string().regex(ID_STRANKE)]).nullable().transform((s) => s || null),
  termin_id: prazno(40),
  za: prazno(80),
});
type VhodNov = z.output<typeof vhodNov>;

const shranjenNov = z.object({
  besedilo: z.string().min(1).max(300),
  ob: z.string().datetime(),
  idTermina: z.string().max(40).nullable(),
  datumTermina: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  idStranke: z.string().regex(ID_STRANKE).nullable(),
  /** Sodelavec ("ID osebe"); brez = uporabnik sam. */
  zaOsebo: z.string().max(40).nullable().optional(),
});

const imeOsebe = (x: OsebaPovzetek) => `${x.ime} ${x.priimek}`.trim();
const vodja = (o: OkoljeOrodja) => o.k.vloga === 'owner' || o.k.vloga === 'admin';

/** Prejemnik opomnika: uporabnik sam ali sodelavec z računom (samo lastnik/admin). */
async function prejemnik(o: OkoljeOrodja, za: string | null): Promise<{ userId: string; oseba: OsebaPovzetek | null } | RezultatOrodja> {
  if (!za) return { userId: o.k.userId, oseba: null };
  if (!vodja(o)) return { sporocilo: jt('Opomnim lahko samo vas. Sodelavce opomnita lastnik ali admin.') };
  const x = izberiOsebo(za, await o.podatki.osebe());
  if (jeRezultat(x)) return x;
  if (x.id === o.k.osebaId) return { userId: o.k.userId, oseba: null };
  const userId = await o.opomniki!.prejemnik(o.k.podjetjeUuid, x.id);
  if (!userId) return { sporocilo: jt('{ime} nima računa v aplikaciji, zato je ne morem opomniti.', { ime: imeOsebe(x) }) };
  if (userId === o.k.userId) return { userId, oseba: null };
  return { userId, oseba: x };
}

/** Termin stranke, ob katerem opomnimo: izbran ali prvi prihodnji (60 dni). */
async function terminStranke(o: OkoljeOrodja, p: VhodNov): Promise<{ t: TerminPovzetek; ime: string } | RezultatOrodja> {
  if (!imaPravico(o.k, 'termini.branje')) return { sporocilo: jt('Za opomnik ob terminu nimate pravice do terminov.') };
  if (!p.stranka && !p.stranka_id) return { sporocilo: jt('Ob terminu katere stranke vas opomnim?') };
  const r = await razresiStranko(p.stranka ?? '', p.stranka_id, o);
  if ('odgovor' in r) return r.odgovor;
  const ime = `${r.stranka.ime} ${r.stranka.priimek}`.trim();
  const zdaj = vMinute(o.uraZdaj);
  let termini = (await o.podatki.termini(o.danes, dodajDni(o.danes, DNI_TERMIN)))
    .filter((t) => t.idStranke === r.stranka.id && aktiven(t))
    .filter((t) => t.datum > o.danes || vMinute(t.zacetek) > zdaj)
    .filter((t) => !samoSvojiTermini(o.k) || t.osebaId === o.k.osebaId)
    .sort((a, b) => a.datum.localeCompare(b.datum) || vMinute(a.zacetek) - vMinute(b.zacetek));
  if (p.termin_id) termini = termini.filter((t) => t.id === p.termin_id);
  if (!termini[0]) return { sporocilo: jt('{ime} nima prihodnjega termina v naslednjih {n} dneh.', { ime, n: DNI_TERMIN }) };
  return { t: termini[0], ime };
}

export const novOpomnik: PisalnoOrodje<VhodNov> = {
  ime: 'nov_opomnik',
  opis:
    'Opomnik za uporabnika: "opomni me jutri ob devetih, da pokličem dobavitelja", "čez eno uro me opomni, naj preverim barvo", ' +
    'ali za sodelavca (za = ime zaposlenega): "opomni Tino jutri ob desetih, naj naroči barve" (samo lastnik/admin). ' +
    '"ko pride Ana, me opomni, da ji povem za novo barvo" (ob_terminu true). Besedilo je kratko, kaj naj naredi (npr. "pokliči dobavitelja"). ' +
    'Čas: datum + ura, ali del_dneva brez ure, ali cez_minut ("čez pol ure" = 30). Shrani šele po potrditvi.',
  razred: 'pisanje',
  pravica: 'glas.uporaba',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      besedilo: { type: 'string', description: 'Kaj naj uporabnik naredi, kratko, v jeziku pogovora (npr. "pokliči dobavitelja").' },
      datum: { type: 'string', description: 'Dan (YYYY-MM-DD ali izraz uporabnika); "" = danes.' },
      ura: { type: 'string', description: 'Ura (HH:MM ali izraz), če jo je povedal; sicer "".' },
      del_dneva: { type: 'string', enum: ['', 'zjutraj', 'dopoldne', 'popoldne', 'zvecer'], description: 'Samo del dneva brez ure; sicer "".' },
      cez_minut: { type: 'integer', description: '"Čez X": število minut od zdaj; sicer 0.' },
      ob_terminu: { type: 'boolean', description: 'true = ob naslednjem terminu stranke ("ko pride Ana").' },
      stranka: { type: 'string', description: 'Ime stranke pri ob_terminu, sicer "".' },
      stranka_id: { type: 'string', description: 'ID stranke, če je znan, sicer "".' },
      termin_id: { type: 'string', description: 'ID termina, če je izbran, sicer "".' },
      za: { type: 'string', description: 'Ime sodelavca, ki ga opomnim ("opomni Tino"); "" = uporabnik sam.' },
    },
    required: ['besedilo', 'datum', 'ura', 'del_dneva', 'cez_minut', 'ob_terminu', 'stranka', 'stranka_id', 'termin_id', 'za'],
    additionalProperties: false,
  },
  vhod: vhodNov,
  shranjeno: shranjenNov as unknown as z.ZodType<Record<string, unknown>>,

  async predogled(p, o): Promise<Predogled | RezultatOrodja> {
    if (!o.opomniki) return NI_NASTAVLJENO;
    const komu = await prejemnik(o, p.za);
    if (!('userId' in komu)) return komu;
    let ob: Date;
    let termin: { t: TerminPovzetek; ime: string } | null = null;
    if (p.ob_terminu) {
      const r = await terminStranke(o, p);
      if (!('t' in r)) return r;
      termin = r;
      ob = casVPasu(r.t.datum, r.t.zacetek, o.k.casovniPas);
    } else if (p.cez_minut) {
      ob = new Date(o.k.zdaj.getTime() + p.cez_minut * 60_000);
    } else {
      const datum = p.datum ? datumIzParametra(p.datum, o.danes) : o.danes;
      if (!datum) return { sporocilo: jt('Datuma »{datum}« ne razumem. Povejte npr. »jutri« ali »v petek«.', { datum: p.datum }) };
      const ura = p.ura ? uraIzParametra(p.ura) : p.del_dneva ? DELI_DNEVA[p.del_dneva] : null;
      if (p.ura && !ura) return { sporocilo: jt('Ure »{ura}« ne razumem.', { ura: p.ura }) };
      if (!ura) return { sporocilo: jt('Ob kateri uri vas opomnim?'), vprasanje: { besedilo: jt('Ob kateri uri vas opomnim?') } };
      ob = casVPasu(datum, ura, o.k.casovniPas);
    }
    if (ob.getTime() <= o.k.zdaj.getTime()) return { sporocilo: jt('Ta čas je že mimo.') };
    if (ob.getTime() > o.k.zdaj.getTime() + NAJVEC_DNI_NAPREJ * 86_400_000) return { sporocilo: jt('Opomnik lahko nastavim največ eno leto vnaprej.') };
    if ((await o.opomniki.cakajoci(o.k.podjetje, komu.userId)).length >= NAJVEC_OPOMNIKOV) {
      return komu.oseba
        ? { sporocilo: jt('{ime} ima že {n} opomnikov.', { ime: imeOsebe(komu.oseba), n: NAJVEC_OPOMNIKOV }) }
        : { sporocilo: jt('Imate že {n} opomnikov. Najprej izbrišite kakšnega.', { n: NAJVEC_OPOMNIKOV }) };
    }
    const kdaj = termin ? jt('ob terminu stranke {ime}, {kdaj}', { ime: termin.ime, kdaj: kdajZaslon(ob, o) }) : kdajZaslon(ob, o);
    const zaKoga = komu.oseba ? [{ oznaka: jt('Za'), vrednost: imeOsebe(komu.oseba) }] : [];
    return {
      povzetek: komu.oseba
        ? jt('Opomnik za {ime} {kdaj}: {besedilo}', { ime: imeOsebe(komu.oseba), kdaj, besedilo: p.besedilo })
        : jt('Opomnik {kdaj}: {besedilo}', { kdaj, besedilo: p.besedilo }),
      parametri: {
        besedilo: p.besedilo,
        ob: ob.toISOString(),
        idTermina: termin?.t.id ?? null,
        datumTermina: termin?.t.datum ?? null,
        idStranke: termin ? (termin.t.idStranke ?? null) : null,
        zaOsebo: komu.oseba?.id ?? null,
      },
      podrobnosti: [
        ...zaKoga,
        { oznaka: jt('Kdaj'), vrednost: kdaj },
        { oznaka: jt('Opomnik'), vrednost: p.besedilo },
      ],
    };
  },

  async potrdi(parametri, o) {
    const p = shranjenNov.parse(parametri);
    const ni = (sporocilo: string): RezultatOrodja => ({ sporocilo, neuspeh: true });
    if (!o.opomniki) return ni(jt('Opomniki še niso nastavljeni.'));
    let ob = new Date(p.ob);
    if (p.idTermina && p.datumTermina) {
      // Termin znova z uporabnikovo sejo: še obstaja, ni odpovedan.
      const t = (await o.podatki.termini(p.datumTermina, p.datumTermina)).find((x) => x.id === p.idTermina && aktiven(x));
      if (!t) return ni(jt('Termina ni več. Opomnik ni shranjen.'));
      ob = casVPasu(t.datum, t.zacetek, o.k.casovniPas);
    }
    if (ob.getTime() <= o.k.zdaj.getTime() - 60_000) return ni(jt('Ta čas je že mimo. Opomnik ni shranjen.'));
    // Prejemnik znova ob potrditvi (vloga in račun se lahko vmes spremenita).
    const komu = await prejemnik(o, p.zaOsebo ?? null);
    if (!('userId' in komu)) return { ...komu, neuspeh: true };
    let besedilo = p.besedilo;
    if (komu.oseba) {
      const jaz = o.k.osebaId ? (await o.podatki.osebe()).find((x) => x.id === o.k.osebaId) : null;
      const od = jaz ? jaz.ime : jt('vodstvo');
      besedilo = `${p.besedilo.slice(0, 300 - od.length - 3)} — ${od}`;
    }
    const jezik = (JEZIKI as readonly string[]).includes(trenutniJezik()) ? (trenutniJezik() as (typeof JEZIKI)[number]) : 'sl';
    const r = await o.opomniki.dodaj({
      podjetje: o.k.podjetje, podjetjeUuid: o.k.podjetjeUuid, userId: komu.userId, besedilo, ob: ob.toISOString(),
      idTermina: p.idTermina, idStranke: p.idStranke, casovniPas: o.k.casovniPas, jezik, ukazId: o.ukazId,
    });
    if (!r.ok) {
      return ni(komu.oseba
        ? jt('{ime} ima že {n} opomnikov.', { ime: imeOsebe(komu.oseba), n: NAJVEC_OPOMNIKOV })
        : jt('Imate že {n} opomnikov. Najprej izbrišite kakšnega.', { n: NAJVEC_OPOMNIKOV }));
    }
    if (komu.oseba) {
      return { sporocilo: jt('Opomnik za {ime} je shranjen. Vidi in prekliče ga lahko samo {ime}.', { ime: imeOsebe(komu.oseba) }), podatki: { opomnik_id: r.id } };
    }
    const push = await o.opomniki.imaPush(o.k.podjetjeUuid, o.k.userId);
    const brezPusha = push ? '' : ` ${jt('Push obvestila niso vklopljena, opomnik boste videli samo v obvestilih aplikacije. Vklopite jih v Nastavitvah.')}`;
    return { sporocilo: `${jt('Opomnik je shranjen.')}${brezPusha}`, podatki: { opomnik_id: r.id } };
  },
};

// ───────────────────────────────────────────────────────────────────────────
function vrstica(x: Opomnik, o: OkoljeOrodja): string {
  return x.ob ? `${kdajZaslon(new Date(x.ob), o)} — ${x.besedilo}` : `${jt('ob terminu stranke')} — ${x.besedilo}`;
}

export const mojiOpomniki: BralnoOrodje<Record<string, never>> = {
  ime: 'moji_opomniki',
  opis: 'Seznam uporabnikovih čakajočih opomnikov: "kateri opomniki so mi ostali", "kaj me moraš opomniti".',
  razred: 'branje',
  pravica: 'glas.uporaba',
  omogoceno: true,
  shema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  vhod: z.object({}).strict() as unknown as z.ZodType<Record<string, never>>,
  async izvedi(_p, o) {
    if (!o.opomniki) return NI_NASTAVLJENO;
    const vsi = await o.opomniki.cakajoci(o.k.podjetje, o.k.userId);
    if (vsi.length === 0) return { sporocilo: jt('Nimate čakajočih opomnikov.'), podatki: { opomniki: [] } };
    const prvi = vsi.slice(0, 3).map((x) => `${x.besedilo}, ${x.ob ? kdajGovor(new Date(x.ob), o) : jt('ob terminu stranke')}`);
    return {
      sporocilo: [jt('Vaši opomniki ({n}):', { n: vsi.length }), ...vsi.map((x) => `• ${vrstica(x, o)}`)].join('\n'),
      govor: `${jt('Imate {n} {n|opomnik|opomnika|opomnike|opomnikov}', { n: vsi.length })}: ${inSeznam(prvi)}.${vsi.length > 3 ? ` ${jt('Ostali so na zaslonu.')}` : ''}`,
      podatki: { opomniki: vsi.map((x) => ({ opomnik_id: x.id, besedilo: x.besedilo, ob: x.ob })) },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
const vhodIzbrisi = z.object({
  opis: z.string().trim().max(200),
  opomnik_id: z.union([z.literal(''), z.string().uuid()]).nullable().transform((s) => s || null),
});
type VhodIzbrisi = z.output<typeof vhodIzbrisi>;
const shranjenIzbris = z.object({ id: z.string().uuid(), besedilo: z.string().max(300) });

const MASILA = new Set(['opomnik', 'opomnika', 'opomnike', 'izbrisi', 'zbrisi', 'odstrani', 'preklici', 'tistega', 'tisti', 'reminder', 'delete', 'erinnerung', 'promemoria', 'podsjetnik']);
const besede = (s: string) => brezSumnikov(s.toLowerCase()).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !MASILA.has(w));

/** Opomniki, ki se najbolj ujemajo z opisom (prve 4 črke besed, zaradi sklonov). */
export function ujemanjeOpomnikov(opis: string, vsi: Opomnik[]): Opomnik[] {
  const iskane = besede(opis).map((w) => w.slice(0, 4));
  if (iskane.length === 0) return [];
  const tocke = vsi.map((x) => {
    const b = besede(x.besedilo);
    return { x, n: iskane.filter((w) => b.some((y) => y.startsWith(w))).length };
  });
  const naj = Math.max(...tocke.map((t) => t.n));
  return naj > 0 ? tocke.filter((t) => t.n === naj).map((t) => t.x) : [];
}

export const prekliciOpomnik: PisalnoOrodje<VhodIzbrisi> = {
  ime: 'preklici_opomnik',
  opis: 'Prekliče (izbriše) enega od uporabnikovih opomnikov: "izbriši opomnik za dobavitelja", "prekliči opomnik". Samo svoje opomnike; po potrditvi.',
  razred: 'pisanje',
  pravica: 'glas.uporaba',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      opis: { type: 'string', description: 'Kateri opomnik (besede iz njegovega besedila, npr. "dobavitelj").' },
      opomnik_id: { type: 'string', description: 'opomnik_id iz moji_opomniki ali izbire, sicer "".' },
    },
    required: ['opis', 'opomnik_id'],
    additionalProperties: false,
  },
  vhod: vhodIzbrisi,
  shranjeno: shranjenIzbris as unknown as z.ZodType<Record<string, unknown>>,

  async predogled(p, o): Promise<Predogled | RezultatOrodja> {
    if (!o.opomniki) return NI_NASTAVLJENO;
    const vsi = await o.opomniki.cakajoci(o.k.podjetje, o.k.userId);
    if (vsi.length === 0) return { sporocilo: jt('Nimate čakajočih opomnikov.') };
    const zadetki = p.opomnik_id ? vsi.filter((x) => x.id === p.opomnik_id) : vsi.length === 1 && !besede(p.opis).length ? vsi : ujemanjeOpomnikov(p.opis, vsi);
    if (zadetki.length === 0) return { sporocilo: jt('Takega opomnika ne najdem. Recite »kateri opomniki so mi ostali«.') };
    if (zadetki.length > 1) {
      return {
        sporocilo: jt('Kateri opomnik?'),
        vprasanje: { besedilo: jt('Kateri opomnik?'), moznosti: zadetki.slice(0, 6).map((x) => ({ id: x.id, oznaka: vrstica(x, o) })) },
      };
    }
    const x = zadetki[0];
    return {
      povzetek: jt('Izbrišem opomnik: {opomnik}', { opomnik: vrstica(x, o) }),
      parametri: { id: x.id, besedilo: x.besedilo },
      podrobnosti: [{ oznaka: jt('Opomnik'), vrednost: vrstica(x, o) }],
    };
  },

  async potrdi(parametri, o) {
    const p = shranjenIzbris.parse(parametri);
    if (!o.opomniki) return { sporocilo: jt('Opomniki še niso nastavljeni.'), neuspeh: true };
    const ok = await o.opomniki.preklici(o.k.podjetje, o.k.userId, p.id);
    return ok ? { sporocilo: jt('Opomnik je izbrisan.') } : { sporocilo: jt('Tega opomnika ni več.'), neuspeh: true };
  },
};
