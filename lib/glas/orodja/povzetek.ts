// lib/glas/orodja/povzetek.ts
//
// Jutranji povzetek ("Kaj me danes čaka?"): termini in prvi, nove stranke, opombe
// strank, luknje, odsotnosti, neoznačeni včerajšnji termini in zahteve za
// rezervacijo. Kratko za glas, več na zaslonu. Samo branje, vse z uporabnikovo
// sejo (RLS); "samo svoji" in pravice vsilimo tukaj.
//
// Opombe strank so osebni podatki: gredo samo na zaslon (zasebno), modelu in v
// dnevnik gre samo njihovo število.

import { z } from 'zod';
import { imaPravico, samoSvojiTermini } from '../pravice';
import { dodajDni, izMinut, opisDatuma, vMinute } from '../razresevanje/datumi';
import { delovniBrezOdsotnosti, prosteLuknje, razcleniUrnik, urnikOsebe } from '../razresevanje/urnik';
import { datumZaGovor, razponZaGovor, uraZaGovor } from '../govor';
import type { OkoljeOrodja, BralnoOrodje } from './tipi';
import type { Kontekst, OsebaPovzetek, RezultatOrodja, TerminPovzetek } from '../tipi';
import { cap, datumIzParametra } from './branje';
import { inSeznam, jt } from '../jeziki/t';

const aktiven = (t: TerminPovzetek) => t.status !== 'cancelled' && t.status !== 'no_show';
const odprt = (t: TerminPovzetek) => t.status === 'scheduled' || t.status === 'confirmed';
const imeOsebe = (p: OsebaPovzetek) => `${p.ime} ${p.priimek}`.trim();
/** Najkrajša luknja, ki jo omenimo v povzetku. */
const NAJMANJ_LUKNJA = 30;
/** Koliko dni nazaj pogledamo, ali salon sploh označuje termine (zaključi / ni prišla). */
const DNI_OZNACEVANJA = 30;

/** Zahteve za rezervacijo vidi, kdor sme na stran Rezervacije. */
function vidiZahteve(k: Pick<Kontekst, 'vloga' | 'pravice'>): boolean {
  return k.vloga === 'owner' || k.vloga === 'admin' || k.pravice?.can_access_rezervacije === true;
}

export interface PodatkiPovzetka {
  datum: string;
  svoji: boolean;
  terminov: number;
  prvi: { ura: string; stranka: string; storitev: string; oseba: string } | null;
  zadnjiKonec: string | null;
  nove: string[];
  /** Ime stranke → opomba (samo zaslon). */
  opombe: { stranka: string; opomba: string }[];
  luknje: { oseba: string | null; od: string; do: string }[];
  odsotni: string[];
  neoznaceniVceraj: number | null;
  zahteve: number | null;
  /** Termini dneva (za zaslon), razvrščeni po uri. */
  termini: TerminPovzetek[];
}

export async function zberiPovzetek(dan: string, svoji: boolean, o: OkoljeOrodja): Promise<PodatkiPovzetka> {
  const vceraj = dodajDni(dan, -1);
  const jeDanes = dan === o.danes;
  const smeUrejati = imaPravico(o.k, 'termini.urejanje');
  const smeStranke = imaPravico(o.k, 'stranke.branje');
  const [osebe, urnikSurov, vsiTermini, odsotnosti, zahteve] = await Promise.all([
    o.podatki.osebe(),
    o.podatki.urnikPodjetja(),
    // Dan povzetka in 30 dni nazaj: včerajšnji neoznačeni in ali salon termine sploh označuje.
    o.podatki.termini(jeDanes ? dodajDni(dan, -DNI_OZNACEVANJA) : dan, dan),
    o.podatki.odsotnosti(dan, dan),
    vidiZahteve(o.k) && jeDanes ? o.podatki.zahteveVPregledu().catch(() => null) : Promise.resolve(null),
  ]);
  const moji = (t: TerminPovzetek) => !svoji || t.osebaId === o.k.osebaId;
  const termini = vsiTermini.filter((t) => t.datum === dan && aktiven(t) && moji(t)).sort((a, b) => vMinute(a.zacetek) - vMinute(b.zacetek));

  // Nove stranke: brez preteklega neodpovedanega termina pred tem dnem.
  const idji = [...new Set(termini.map((t) => t.idStranke).filter((x): x is string => Boolean(x)))];
  const [pretekli, opombe] = await Promise.all([
    smeStranke && idji.length ? o.podatki.strankeSPreteklimTerminom(idji, dan).catch(() => null) : Promise.resolve(null),
    smeStranke && idji.length ? o.podatki.opombeStrank(idji).catch(() => ({}) as Record<string, string>) : Promise.resolve({} as Record<string, string>),
  ]);
  const imeZaId = new Map(termini.filter((t) => t.idStranke).map((t) => [t.idStranke!, t.stranka || jt('stranka')]));
  const nove = pretekli ? idji.filter((id) => !pretekli.has(id)).map((id) => imeZaId.get(id)!) : [];

  // Luknje: samo za danes (od zdaj) in naprej, po zaposlenih, ki jih uporabnik sme videti.
  const urnikPodjetja = razcleniUrnik(urnikSurov);
  const aktivne = osebe.filter((p) => p.aktivna);
  const zaLuknje = svoji ? aktivne.filter((p) => p.id === o.k.osebaId) : aktivne;
  const odMinute = jeDanes ? Math.ceil(vMinute(o.uraZdaj) / 15) * 15 : 0;
  const luknje =
    dan < o.danes
      ? []
      : zaLuknje.flatMap((p) =>
          prosteLuknje({
            osebaId: p.id, urnik: urnikOsebe(p, urnikPodjetja), datum: dan, odMinute, najmanjMin: NAJMANJ_LUKNJA,
            termini: vsiTermini.filter((t) => t.datum === dan && aktiven(t)), odsotnosti, casovniPas: o.k.casovniPas,
          }).map(([a, b]) => ({ oseba: svoji ? null : p.ime, od: izMinut(a), do: izMinut(b) }))
        );

  // Odsotni: kdo bi po urniku delal, a je odsoten (samo-svoji: samo sam).
  const odsotni = zaLuknje
    .filter((p) => {
      const r = delovniBrezOdsotnosti(p.id, urnikOsebe(p, urnikPodjetja), dan, odsotnosti, o.k.casovniPas);
      return r.delovni.length > 0 && r.dela.length === 0;
    })
    .map((p) => (svoji ? imeOsebe(p) : p.ime));

  // Neoznačeni včerajšnji: samo, če salon termine sploh označuje (sicer bi bili vedno vsi).
  let neoznaceniVceraj: number | null = null;
  if (jeDanes && smeUrejati) {
    const pretekliMoji = vsiTermini.filter((t) => t.datum < dan && moji(t));
    const oznacuje = pretekliMoji.some((t) => t.status === 'completed' || t.status === 'no_show');
    if (oznacuje) neoznaceniVceraj = pretekliMoji.filter((t) => t.datum === vceraj && odprt(t)).length;
  }

  const p = termini[0];
  return {
    datum: dan,
    svoji,
    terminov: termini.length,
    prvi: p ? { ura: p.zacetek, stranka: p.stranka || jt('stranka'), storitev: p.storitev, oseba: p.oseba } : null,
    zadnjiKonec: termini.length ? (termini.map((t) => t.konec ?? t.zacetek).sort().at(-1) ?? null) : null,
    nove,
    opombe: termini
      .filter((t, i, a) => t.idStranke && opombe[t.idStranke] && a.findIndex((x) => x.idStranke === t.idStranke) === i)
      .map((t) => ({ stranka: t.stranka || jt('stranka'), opomba: opombe[t.idStranke!] })),
    luknje,
    odsotni,
    neoznaceniVceraj,
    zahteve,
    termini,
  };
}

/** Besedilo za zaslon (več) in za glas (kratko, največ ~5 stavkov). */
export function besediloPovzetka(p: PodatkiPovzetka, danes: string): RezultatOrodja {
  const termini = p.termini;
  const kdaj = cap(datumZaGovor(p.datum, danes));
  const kdajZaslon = cap(opisDatuma(p.datum, danes));
  const govor: string[] = [];
  const zaslon: string[] = [];

  if (p.terminov === 0) {
    govor.push(p.svoji ? jt('{kdaj} nimate terminov.', { kdaj }) : jt('{kdaj} ni terminov.', { kdaj }));
    zaslon.push(`${kdajZaslon}: ${jt('ni terminov.')}`);
  } else {
    const prvi = p.prvi!;
    const pri = !p.svoji && prvi.oseba ? `, ${jt('pri {oseba:mestnik}', { oseba: prvi.oseba })}` : '';
    govor.push(
      `${p.svoji ? jt('{kdaj} imate {n} {n|termin|termina|termine|terminov}', { kdaj, n: p.terminov }) : jt('{kdaj} je {n} {n|termin|termina|termine|terminov}', { kdaj, n: p.terminov })}, ${jt('prvi {ura}, {stranka}', { ura: uraZaGovor(prvi.ura), stranka: prvi.stranka })}${pri}.`
    );
    zaslon.push(
      `${kdajZaslon}: ${jt('{n} {n|termin|termina|termini|terminov}', { n: p.terminov })}, ${jt('prvi ob {ura} ({stranka})', { ura: prvi.ura, stranka: prvi.stranka })}${p.zadnjiKonec ? `, ${jt('zadnji do {ura}', { ura: p.zadnjiKonec })}` : ''}.`
    );
    for (const t of termini.slice(0, 30)) {
      zaslon.push(`  ${t.zacetek}${t.konec ? `–${t.konec}` : ''} ${t.stranka || jt('stranka')}${t.storitev ? `, ${t.storitev}` : ''}${!p.svoji && t.oseba ? ` (${t.oseba})` : ''}`);
    }
  }

  if (p.nove.length) {
    govor.push(p.nove.length === 1 ? jt('Nova stranka: {ime}.', { ime: p.nove[0] }) : jt('{n} {n|nova stranka|novi stranki|nove stranke|novih strank}.', { n: p.nove.length }));
    zaslon.push(`${jt('Nove stranke')}: ${p.nove.join(', ')}`);
  }
  if (p.opombe.length) {
    govor.push(
      p.opombe.length === 1
        ? jt('{ime} ima opombo, je na zaslonu.', { ime: p.opombe[0].stranka })
        : jt('{n} {n|stranka ima|stranki imata|stranke imajo|strank ima} opombe, so na zaslonu.', { n: p.opombe.length })
    );
    zaslon.push(`${jt('Opombe strank')}:`);
    for (const x of p.opombe) zaslon.push(`  ${x.stranka}: ${x.opomba}`);
  }
  if (p.luknje.length) {
    const prve = p.luknje.slice(0, 2).map((l) => `${l.oseba ? `${l.oseba} ` : ''}${razponZaGovor(l.od, l.do)}`);
    govor.push(
      p.luknje.length > 2
        ? jt('Prosto je {casi} in še {n} {n|luknja|luknji|luknje|lukenj} na zaslonu.', { casi: inSeznam(prve), n: p.luknje.length - 2 })
        : jt('Prosto je {casi}.', { casi: inSeznam(prve) })
    );
    zaslon.push(`${jt('Proste luknje')}: ${p.luknje.map((l) => `${l.oseba ? `${l.oseba} ` : ''}${l.od}–${l.do}`).join(', ')}`);
  }
  if (p.odsotni.length) {
    govor.push(jt('Odsotni: {osebe}.', { osebe: inSeznam(p.odsotni) }));
    zaslon.push(jt('Odsotni: {osebe}.', { osebe: p.odsotni.join(', ') }));
  }
  if (p.neoznaceniVceraj) {
    const s = jt('Včeraj {n} {n|termin ni označen|termina nista označena|termini niso označeni|terminov ni označenih}.', { n: p.neoznaceniVceraj });
    govor.push(s);
    zaslon.push(s);
  }
  if (p.zahteve) {
    const s = jt('{n} {n|zahteva za rezervacijo čaka|zahtevi za rezervacijo čakata|zahteve za rezervacijo čakajo|zahtev za rezervacijo čaka}.', { n: p.zahteve });
    govor.push(s);
    zaslon.push(s);
  }

  const dnevnik = [
    `povzetek ${p.datum}: ${p.terminov} terminov`,
    p.nove.length ? `nove ${p.nove.length}` : '',
    p.opombe.length ? `opombe ${p.opombe.length}` : '',
    p.luknje.length ? `luknje ${p.luknje.length}` : '',
    p.odsotni.length ? `odsotni ${p.odsotni.length}` : '',
    p.neoznaceniVceraj ? `neoznaceni ${p.neoznaceniVceraj}` : '',
    p.zahteve ? `zahteve ${p.zahteve}` : '',
  ].filter(Boolean).join(', ');

  return {
    sporocilo: zaslon.join('\n'),
    govor: govor.join(' '),
    podatki: { datum: p.datum, terminov: p.terminov, nove: p.nove.length, opombe: p.opombe.length, luknje: p.luknje.length, odsotni: p.odsotni.length, neoznaceni_vceraj: p.neoznaceniVceraj, zahteve: p.zahteve },
    ...(p.opombe.length ? { zasebno: { dnevnik } } : {}),
  };
}

export const povzetekDneva: BralnoOrodje<{ datum: string | null; samo_moji: boolean | null }> = {
  ime: 'povzetek_dneva',
  opis:
    'Povzetek dneva: "kaj me danes čaka", "kako izgleda jutri", "povzetek dneva". Vrne število terminov in prvega, nove stranke, opombe strank, proste luknje, odsotne, neoznačene včerajšnje termine in zahteve za rezervacijo. Za seznam terminov brez ostalega uporabi koledar_dan.',
  razred: 'branje',
  pravica: 'termini.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      datum: { type: ['string', 'null'], description: 'Izraz uporabnika ali YYYY-MM-DD; null = danes.' },
      samo_moji: { type: ['boolean', 'null'], description: 'true = moj dan, false = cel salon; null = privzeto.' },
    },
    required: ['datum', 'samo_moji'],
    additionalProperties: false,
  },
  vhod: z.object({ datum: z.string().max(60).nullable(), samo_moji: z.boolean().nullable() }),
  async izvedi({ datum, samo_moji }, o) {
    const dan = datumIzParametra(datum, o.danes) ?? (datum ? null : o.danes);
    if (!dan) return { sporocilo: jt('Datuma »{datum}« ne razumem. Povejte npr. »jutri« ali »v petek«.', { datum }) };
    const vsili = samoSvojiTermini(o.k);
    if (vsili && !o.k.osebaId) return { sporocilo: jt('Vaš račun ni povezan z zaposlenim, zato ne vidim vaših terminov.') };
    const svoji = Boolean(o.k.osebaId) && (vsili || (samo_moji ?? true));
    return besediloPovzetka(await zberiPovzetek(dan, svoji, o), o.danes);
  },
};
