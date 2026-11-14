// lib/glas/orodja/sporocila.ts
//
// »Sporoči Ani, da zamujamo 15 minut.« (docs/glasovni-asistent-dodatne-funkcije-nacrt.md, §3)
//
// Pravila, ki jih model ne more obiti (vse preveri strežnik, ob predlogu IN ob potrditvi):
//   * sporočilo je vedno vezano na termin stranke (danes ali v 30 dneh; tudi odpovedan),
//     zato je storitveno sporočilo in ne marketing;
//   * besedilo s ponudbo, ceno, povezavo ali telefonsko številko se zavrne;
//   * telefon in e-naslov prebere strežnik z uporabnikovo sejo (RLS); model ju ne vidi;
//   * podpis salona doda strežnik; SMS je en sam (160 znakov brez šumnikov);
//   * pošlje se šele po potrditvi uporabnika; omejitev 3/stranko in 30/podjetje na dan (SQL),
//     SMS kvota podjetja (n8n);
//   * brez telefona gre e-pošta (Timova odločitev O2).

import { z } from 'zod';
import { normalizeCommunicationLanguage } from '@/lib/communicationLanguage';
import { dodajDni, opisDatuma, vMinute } from '../razresevanje/datumi';
import { zJezikom } from '../jeziki/jezik';
import { jt, kt } from '../jeziki/t';
import type { Predogled, RezultatOrodja, TerminPovzetek } from '../tipi';
import { NAJVEC_EMAIL, NAJVEC_SMS, ocistiSms, preveriBesedilo, skritEmail, skritTelefon, zPodpisom } from '../sporocila/besedilo';
import { OMEJITEV_NA_PODJETJE, OMEJITEV_NA_STRANKO, type IzidPosiljanja, type Kanal } from '../sporocila/tipi';
import { datumIzParametra } from './branje';
import { samoSvojeUrejanje } from './obrazci';
import { razresiStranko, ID_STRANKE } from './stranke';
import type { OkoljeOrodja, PisalnoOrodje } from './tipi';

const JEZIKI = ['sl', 'en', 'de', 'it', 'hr'] as const;
type Jezik = (typeof JEZIKI)[number];
const IZ_KODE: Record<string, Jezik> = { slo: 'sl', eng: 'en', de: 'de', it: 'it', hr: 'hr' };
const IME_JEZIKA: Record<Jezik, string> = { sl: kt('slovenščina'), en: kt('angleščina'), de: kt('nemščina'), it: kt('italijanščina'), hr: kt('hrvaščina') };
const DNI_NAPREJ = 30;

const vhod = z.object({
  stranka: z.string().trim().min(1).max(80),
  stranka_id: z.string().regex(ID_STRANKE).nullable(),
  termin_id: z.string().max(40).nullable(),
  datum_termina: z.string().max(40).nullable(),
  besedilo: z.string().trim().min(1).max(NAJVEC_EMAIL),
  jezik_besedila: z.enum(JEZIKI),
  o_odpovedi: z.boolean(),
  podpis: z.boolean(),
});
type Vhod = z.infer<typeof vhod>;

const shranjeno = z.object({
  idStranke: z.string().regex(ID_STRANKE),
  imeStranke: z.string().max(160),
  idTermina: z.string().min(1).max(40),
  datumTermina: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kanal: z.enum(['sms', 'email']),
  besedilo: z.string().min(1).max(NAJVEC_EMAIL + 200),
  zadeva: z.string().max(120).nullable(),
  jezik: z.enum(JEZIKI),
  oOdpovedi: z.boolean(),
});

const aktiven = (t: TerminPovzetek) => t.status === 'scheduled' || t.status === 'confirmed';

/** Jezik sporočil stranke (kartica); brez = slovenščina. */
export function jezikStranke(koda: string | null): Jezik {
  return IZ_KODE[normalizeCommunicationLanguage(koda, 'slo')] ?? 'sl';
}

/** Termin, o katerem govori sporočilo: aktiven (prednost) ali odpovedan, danes ali v 30 dneh. */
async function izberiTermin(
  o: OkoljeOrodja,
  idStranke: string,
  ime: string,
  p: Pick<Vhod, 'termin_id' | 'datum_termina' | 'o_odpovedi'>
): Promise<{ termin: TerminPovzetek } | { odgovor: RezultatOrodja }> {
  const dan = p.datum_termina ? datumIzParametra(p.datum_termina, o.danes) : null;
  const od = dan ?? o.danes;
  const doo = dan ?? dodajDni(o.danes, DNI_NAPREJ);
  if (od < o.danes) return { odgovor: { sporocilo: jt('Sporočilo lahko pošljem samo o današnjem ali prihodnjem terminu.') } };
  let termini = (await o.podatki.termini(od, doo))
    .filter((t) => t.idStranke === idStranke && (aktiven(t) || t.status === 'cancelled'))
    // Današnji že končan termin ni več "o terminu" (odpovedan pa je).
    .filter((t) => !(aktiven(t) && t.datum === o.danes && vMinute(t.konec ?? t.zacetek) <= vMinute(o.uraZdaj)))
    .sort((a, b) => a.datum.localeCompare(b.datum) || vMinute(a.zacetek) - vMinute(b.zacetek));
  if (p.termin_id) termini = termini.filter((t) => t.id === p.termin_id);
  // Obvestilo o odpovedi samo za termin, ki je v bazi res odpovedan; sicer prednost aktivnim.
  const izbor = p.o_odpovedi ? termini.filter((t) => t.status === 'cancelled') : termini.some(aktiven) ? termini.filter(aktiven) : termini;
  if (p.o_odpovedi && izbor.length === 0 && termini.length > 0) {
    return { odgovor: { sporocilo: jt('Termin še ni odpovedan. Najprej ga odpovejte v koledarju, nato recite »obvesti stranko«.') } };
  }
  if (izbor.length === 0) {
    return { odgovor: { sporocilo: jt('Sporočilo lahko pošljem samo o terminu. {ime} nima termina v naslednjih {n} dneh.', { ime, n: DNI_NAPREJ }) } };
  }
  if (izbor.length > 1) {
    return {
      odgovor: {
        sporocilo: jt('{ime} ima več terminov. O katerem?', { ime }),
        podatki: { stranka_id: idStranke },
        vprasanje: {
          besedilo: jt('Kateri termin?'),
          moznosti: izbor.slice(0, 5).map((t) => ({ id: t.id, oznaka: `${jt('{datum} ob {ura}', { datum: opisDatuma(t.datum, o.danes), ura: t.zacetek })}${t.storitev ? `, ${t.storitev}` : ''}` })),
        },
      },
    };
  }
  return { termin: izbor[0] };
}

export function zavrnitevBesedila(besedilo: string): RezultatOrodja | null {
  const r = preveriBesedilo(besedilo);
  if (r === 'ponudba') return { sporocilo: jt('Sporočilo o terminu ne sme vsebovati ponudb, cen ali povezav. Ni poslano.') };
  if (r === 'telefon') return { sporocilo: jt('Sporočilo ne sme vsebovati telefonskih številk. Ni poslano.') };
  if (r === 'prazno') return { sporocilo: jt('Sporočilo je prazno.') };
  return null;
}

const nePrisvojem = (o: OkoljeOrodja, t: TerminPovzetek) => samoSvojeUrejanje(o.k) && t.osebaId !== o.k.osebaId;

export const sporociStranki: PisalnoOrodje<Vhod> = {
  ime: 'sporoci_stranki',
  opis:
    'Pošlje stranki kratko sporočilo o njenem terminu (SMS, brez telefona e-pošta): zamuda, sprememba, prošnja, odpoved ("sporoči Ani, da zamujamo 15 minut"). ' +
    'Besedilo napiši sam v jeziku stranke: kratko, vljudno, vikanje, brez podpisa, brez ponudb, cen, povezav in telefonskih številk. ' +
    'Orodje najde termin, doda podpis salona in pokaže predogled; pošlje se šele po potrditvi uporabnika. ' +
    'Popravek odprtega predloga (drugo besedilo, krajše, brez podpisa): pokliči znova z istim termin_id in popravljenimi polji.',
  razred: 'sporocila',
  pravica: 'sporocila.stranke',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      stranka: { type: 'string', description: 'Ime stranke, kot je bilo izgovorjeno.' },
      stranka_id: { type: ['string', 'null'], description: 'ID stranke iz uvoda ali prejšnjega iskanja, sicer null.' },
      termin_id: { type: ['string', 'null'], description: 'ID termina, če ga je uporabnik izbral ali gre za aktiven termin, sicer null.' },
      datum_termina: { type: ['string', 'null'], description: 'Datum termina YYYY-MM-DD, če ga je uporabnik povedal, sicer null.' },
      besedilo: { type: 'string', description: 'Besedilo sporočila stranki (en SMS, do ~120 znakov), brez podpisa.' },
      jezik_besedila: { type: 'string', enum: [...JEZIKI], description: 'Jezik, v katerem je napisano besedilo.' },
      o_odpovedi: { type: 'boolean', description: 'true, če sporočilo pove, da je termin odpovedan (obvestilo po odpovedi).' },
      podpis: { type: 'boolean', description: 'true = na koncu doda ime salona (privzeto). false samo, če uporabnik reče "brez podpisa".' },
    },
    required: ['stranka', 'stranka_id', 'termin_id', 'datum_termina', 'besedilo', 'jezik_besedila', 'o_odpovedi', 'podpis'],
    additionalProperties: false,
  },
  vhod,
  shranjeno: shranjeno as unknown as z.ZodType<Record<string, unknown>>,

  async predogled(p, o): Promise<Predogled | RezultatOrodja> {
    if (!o.sporocila) return { sporocilo: jt('Pošiljanje sporočil ni nastavljeno.') };
    const r = await razresiStranko(p.stranka, p.stranka_id, o);
    if ('odgovor' in r) return r.odgovor;
    const s = r.stranka;
    const ime = `${s.ime} ${s.priimek}`.trim();
    const izbran = await izberiTermin(o, s.id, ime, p);
    if ('odgovor' in izbran) return izbran.odgovor;
    const t = izbran.termin;
    if (nePrisvojem(o, t)) return { sporocilo: jt('Sporočila lahko pošiljate samo strankam svojih terminov.') };

    const kartica = await o.podatki.podrobnostiStranke(s.id, o.danes);
    const kanal: Kanal | null = kartica?.telefon ? 'sms' : kartica?.email ? 'email' : null;
    if (!kanal) return { sporocilo: jt('{ime} nima telefona ne e-pošte, zato sporočila ne morem poslati.', { ime }) };

    const jezik = jezikStranke(kartica?.jezik ?? null);
    if (p.jezik_besedila !== jezik) {
      // Gre modelu: napiše znova v pravem jeziku.
      return { sporocilo: jt('Stranka prejema sporočila v jeziku: {jezik}. Napiši besedilo v tem jeziku in pokliči sporoci_stranki znova.', { jezik: jt(IME_JEZIKA[jezik]) }) };
    }
    const zavrnjeno = zavrnitevBesedila(p.besedilo);
    if (zavrnjeno) return zavrnjeno;

    const podpis = p.podpis ? await o.podatki.imePodjetja() : '';
    let besedilo: string;
    let zadeva: string | null = null;
    if (kanal === 'sms') {
      besedilo = ocistiSms(zPodpisom(p.besedilo, podpis));
      if (besedilo.length > NAJVEC_SMS) {
        return { sporocilo: jt('Besedilo je predolgo za en SMS ({n} znakov s podpisom, največ {m}). Skrajšaj ga in pokliči sporoci_stranki znova.', { n: besedilo.length, m: NAJVEC_SMS }) };
      }
    } else {
      besedilo = zPodpisom(p.besedilo, podpis);
      zadeva = zJezikom(jezik, () => jt('Obvestilo o vašem terminu'));
    }

    const kdaj = jt('{datum} ob {ura}', { datum: opisDatuma(t.datum, o.danes), ura: t.zacetek });
    const vrstice = [
      { oznaka: jt('Prejemnik'), vrednost: `${ime}, ${kanal === 'sms' ? skritTelefon(kartica!.telefon!) : skritEmail(kartica!.email!)}` },
      { oznaka: jt('Termin'), vrednost: t.status === 'cancelled' ? `${kdaj} (${jt('odpovedan')})` : kdaj },
      { oznaka: jt('Kanal'), vrednost: kanal === 'sms' ? `SMS · ${besedilo.length}/${NAJVEC_SMS}` : jt('e-pošta (ni telefona)') },
    ];
    return {
      povzetek: kanal === 'sms' ? jt('SMS za {ime}: »{besedilo}«', { ime, besedilo }) : jt('E-pošta za {ime}: »{besedilo}«', { ime, besedilo }),
      parametri: { idStranke: s.id, imeStranke: ime, idTermina: t.id, datumTermina: t.datum, kanal, besedilo, zadeva, jezik, oOdpovedi: p.o_odpovedi },
      podrobnosti: vrstice,
      sporocil: 1,
    };
  },

  async potrdi(parametri, o) {
    const p = shranjeno.parse(parametri);
    const ni = (sporocilo: string): RezultatOrodja => ({ sporocilo, neuspeh: true });
    if (!o.sporocila) return ni(jt('Pošiljanje sporočil ni nastavljeno. Sporočilo ni bilo poslano.'));

    // Vse znova z uporabnikovo sejo: stranka, termin, pravica do termina, kontakt.
    const s = await o.podatki.stranka(p.idStranke);
    if (!s) return ni(jt('Stranke ni več mogoče najti. Sporočilo ni bilo poslano.'));
    const t = (await o.podatki.termini(p.datumTermina, p.datumTermina)).find((x) => x.id === p.idTermina && x.idStranke === p.idStranke);
    if (!t || !(aktiven(t) || t.status === 'cancelled')) return ni(jt('Termina ni več. Sporočilo ni bilo poslano.'));
    if (p.oOdpovedi && t.status !== 'cancelled') return ni(jt('Termin ni odpovedan. Sporočilo ni bilo poslano.'));
    if (nePrisvojem(o, t)) return ni(jt('Sporočila lahko pošiljate samo strankam svojih terminov.'));
    if (preveriBesedilo(p.besedilo)) return ni(jt('Sporočilo o terminu ne sme vsebovati ponudb, cen ali povezav. Ni poslano.'));
    const kartica = await o.podatki.podrobnostiStranke(p.idStranke, o.danes);
    const prejemnik = p.kanal === 'sms' ? kartica?.telefon : kartica?.email;
    if (!prejemnik) return ni(jt('Kontakta stranke ni več. Sporočilo ni bilo poslano.'));

    const rez = await o.sporocila.rezerviraj({
      podjetje: o.k.podjetje, userId: o.k.userId, ukazId: o.ukazId, idStranke: p.idStranke, idTermina: p.idTermina, kanal: p.kanal, dolzina: p.besedilo.length,
    });
    if (!rez.ok) return ni(omejitevSporocil(rez.koda));

    const izid = await o.sporocila.poslji({
      id: rez.id, podjetje: o.k.podjetje, kanal: p.kanal, prejemnik, besedilo: p.besedilo, zadeva: p.zadeva,
      imeSalona: await o.podatki.imePodjetja(), jezik: p.jezik, idStranke: p.idStranke, idTermina: p.idTermina,
    });
    return izidPosiljanja(izid, p.kanal, { sporocilo_id: rez.id, termin_id: p.idTermina, stranka_id: p.idStranke, kanal: p.kanal });
  },
};

/** Dnevna omejitev sporočil prek asistenta je dosežena. */
export function omejitevSporocil(koda: 'stranka' | 'podjetje'): string {
  return koda === 'stranka'
    ? jt('Tej stranki so danes prek asistenta že poslana {n} sporočila (dnevna omejitev). Ni poslano.', { n: OMEJITEV_NA_STRANKO })
    : jt('Dosežena je dnevna omejitev sporočil prek asistenta ({n}). Ni poslano.', { n: OMEJITEV_NA_PODJETJE });
}

/** Izid pošiljanja (n8n) → odgovor uporabniku. */
export function izidPosiljanja(izid: IzidPosiljanja, kanal: Kanal, podatki: Record<string, unknown>): RezultatOrodja {
  const ni = (sporocilo: string): RezultatOrodja => ({ sporocilo, neuspeh: true });
  switch (izid.status) {
    case 'poslano':
      return { sporocilo: kanal === 'sms' ? jt('SMS je poslan.') : jt('E-pošta je poslana.'), podatki };
    case 'kvota':
      return ni(jt('Mesečni SMS-i so porabljeni. Sporočilo ni bilo poslano.'));
    case 'blokirano':
      return ni(jt('SMS-ov v državo te številke ne pošiljamo. Sporočilo ni bilo poslano.'));
    case 'neznano':
      return ni(jt('Ne vem, ali je bilo poslano. Preverite dnevnik SMS, preden pošljete znova.'));
    default:
      return ni(izid.razlog === 'sms_disabled'
        ? jt('SMS-i v vašem paketu niso vklopljeni. Sporočilo ni bilo poslano.')
        : jt('Sporočilo ni bilo poslano. Poskusite znova čez trenutek.'));
  }
}

/** Ime jezika za navodilo modelu (»Stranka prejema sporočila v jeziku: …«). */
export function imeJezika(j: Jezik): string {
  return jt(IME_JEZIKA[j]);
}
