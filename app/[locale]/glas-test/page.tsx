'use client';

/**
 * Asistent+ — testna stran sprotnega pogovora (faza 1, ni v meniju).
 *
 * Tap → pogovor: asistent posluša, sam zazna konec govora, odgovori z glasom
 * (Soniox Nina) in posluša naprej; po ~8 s tišine se zapre. Dotik med govorom
 * ga prekine. Predlog sprememb potrdite z "ja" ali gumbom. Vse odločitve
 * (pravice, kvota, potrditev) so na strežniku; logika je v lib/glas/odjemalec.
 *
 * Izgled je začasen (faza 4: plavajoči gumb in "Siri bunka" na vsaki strani).
 * Pod odgovorom so izmerjeni časi, da vidimo, ali dosegamo cilj (~1–2 s).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Microphone, Stop, Check, X, PaperPlaneRight, SpeakerHigh, ArrowSquareOut } from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { Pogovor, type Meritev, type OdgovorOdjemalec, type StanjePogovora } from '@/lib/glas/odjemalec/pogovor';

type Stanje = { ok: boolean; vklopljeno?: boolean; pravica?: boolean; kvota?: number; porabljeno?: number; opozorilo?: string | null; sporocilo?: string };
type Vrstica = { kdo: 'jaz' | 'asistent' | 'napaka'; besedilo: string; meritev?: Meritev | null; pojdi?: string };

const OPIS: Record<StanjePogovora, string> = {
  mirovanje: 'Tapnite in začnite govoriti',
  povezujem: 'Povezujem …',
  poslusam: 'Poslušam …',
  razmisljam: 'Razmišljam …',
  govorim: 'Govorim … (tapnite za prekinitev)',
};

export default function GlasTestPage() {
  const [stanje, setStanje] = useState<Stanje | null>(null);
  const [s, setS] = useState<StanjePogovora>('mirovanje');
  const [slisano, setSlisano] = useState('');
  const [vrstice, setVrstice] = useState<Vrstica[]>([]);
  const [zadnji, setZadnji] = useState<OdgovorOdjemalec | null>(null);
  const [besedilo, setBesedilo] = useState('');
  const pogovor = useRef<Pogovor | null>(null);
  const jezik = useLocale();
  const konec = useRef<HTMLDivElement | null>(null);

  const osveziStanje = useCallback(async () => {
    try {
      const r = await fetch('/api/glas/stanje', { cache: 'no-store' });
      setStanje(await r.json());
    } catch {
      setStanje({ ok: false, sporocilo: 'Stanja ni bilo mogoče prebrati.' });
    }
  }, []);

  useEffect(() => {
    osveziStanje();
    const dodaj = (v: Vrstica) => setVrstice((x) => [...x.slice(-30), v]);
    pogovor.current = new Pogovor({
      stanje: (n) => {
        setS(n);
        if (n !== 'poslusam') setSlisano('');
      },
      slisano: setSlisano,
      izjava: (t) => {
        setSlisano('');
        dodaj({ kdo: 'jaz', besedilo: t });
      },
      odgovor: (o) => {
        setZadnji(o);
        dodaj({ kdo: 'asistent', besedilo: o.odgovor ?? '', pojdi: o.pojdi });
        osveziStanje();
      },
      potrditev: (o) => {
        setZadnji(null);
        dodaj({ kdo: o.ok ? 'asistent' : 'napaka', besedilo: o.sporocilo });
      },
      napaka: (t) => {
        setZadnji(null);
        dodaj({ kdo: 'napaka', besedilo: t });
      },
      meritev: (m) =>
        setVrstice((x) => {
          const i = x.map((v) => v.kdo).lastIndexOf('asistent');
          const j = Math.max(i, x.map((v) => v.kdo).lastIndexOf('napaka'));
          if (j < 0) return x;
          const kopija = [...x];
          kopija[j] = { ...kopija[j], meritev: m };
          return kopija;
        }),
    });
    return () => pogovor.current?.ustavi();
  }, [osveziStanje]);

  useEffect(() => {
    konec.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [vrstice, slisano]);

  const gumb = () => {
    const p = pogovor.current;
    if (!p) return;
    if (s === 'mirovanje') void p.zacni();
    else if (s === 'govorim') p.prekini();
    else p.ustavi();
  };

  const nedostopno = stanje && (!stanje.ok || !stanje.vklopljeno || !stanje.pravica);
  const zaseden = s === 'povezujem' || s === 'razmisljam';

  return (
    <ProtectedLayout>
      <div className="mx-auto w-full max-w-xl px-4 py-6 md:py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-label">Asistent+</h1>
          <p className="mt-1 text-sm text-label-secondary">
            Testna stran pogovora. Branje se izvede takoj, vsako spremembo potrdite z »ja« ali gumbom.
          </p>
          {stanje?.ok && stanje.vklopljeno && (
            <p className="mt-2 text-xs text-label-tertiary">
              Porabljeno ta mesec: {stanje.porabljeno ?? 0} / {stanje.kvota ?? 0}
            </p>
          )}
          {stanje?.opozorilo && <p className="mt-2 text-sm text-amber-700">{stanje.opozorilo}</p>}
        </header>

        {nedostopno ? (
          <div className="rounded-2xl border border-separator bg-white p-5 text-sm text-label-secondary">
            {!stanje?.ok
              ? stanje?.sporocilo ?? 'Asistent ni na voljo.'
              : !stanje?.vklopljeno
                ? 'Asistent+ za to podjetje ni vklopljen.'
                : 'Za glasovnega asistenta nimate pravice.'}
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 border-b border-separator pb-8">
              <button
                type="button"
                onClick={gumb}
                disabled={!stanje}
                aria-label={s === 'mirovanje' ? 'Začni pogovor' : s === 'govorim' ? 'Prekini' : 'Končaj pogovor'}
                className={`flex h-20 w-20 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-50 md:h-16 md:w-16 ${
                  s === 'poslusam' ? 'bg-red-500 animate-pulse' : 'btn-gradient-primary'
                }`}
              >
                {zaseden ? (
                  <GradientSpinner size={28} />
                ) : s === 'govorim' ? (
                  <SpeakerHigh size={30} weight="fill" />
                ) : s === 'poslusam' ? (
                  <Stop size={30} weight="fill" />
                ) : (
                  <Microphone size={30} weight="fill" />
                )}
              </button>
              <p className="text-sm text-label-secondary" aria-live="polite">
                {OPIS[s]}
              </p>
              {s !== 'mirovanje' && (
                <button type="button" onClick={() => pogovor.current?.ustavi()} className="text-xs text-label-tertiary underline">
                  Končaj pogovor
                </button>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {vrstice.map((v, i) => (
                <div key={i} className={v.kdo === 'jaz' ? 'self-end max-w-[85%]' : 'self-start max-w-[90%]'}>
                  <p
                    className={`whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                      v.kdo === 'jaz'
                        ? 'bg-fill text-label'
                        : v.kdo === 'napaka'
                          ? 'border border-red-200 bg-white text-red-600'
                          : 'border border-separator bg-white text-label'
                    }`}
                  >
                    {v.besedilo}
                  </p>
                  {v.pojdi && (
                    // Testna stran: povezava namesto samodejnega premika (pogovor bi se ustavil).
                    // Faza 4: plavajoča bunka ostane odprta in stran se odpre sama.
                    <a
                      href={`/${jezik}${v.pojdi}`}
                      className="mt-1 inline-flex items-center gap-1 px-1 text-xs font-medium text-label underline"
                    >
                      <ArrowSquareOut size={14} /> Odpri
                    </a>
                  )}
                  {v.meritev && (
                    <p className="mt-0.5 px-1 text-[11px] text-label-tertiary">
                      odgovor {v.meritev.doOdgovora} ms{v.meritev.doZvoka !== null ? ` · prvi zvok ${v.meritev.doZvoka} ms` : ' · brez glasu'}
                    </p>
                  )}
                </div>
              ))}
              {slisano && <p className="self-end max-w-[85%] rounded-2xl bg-fill px-3 py-2 text-sm text-label-secondary italic">{slisano}</p>}
              <div ref={konec} />
            </div>

            {zadnji?.status === 'vprasanje' && zadnji.vprasanje?.moznosti?.length ? (
              <div className="mt-3 flex flex-col divide-y divide-separator rounded-xl border border-separator bg-white">
                {zadnji.vprasanje.moznosti.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={zaseden}
                    onClick={() => pogovor.current?.izberi(m)}
                    className="px-3 py-3 text-left text-sm text-label hover:bg-fill disabled:opacity-50 md:py-2"
                  >
                    {m.oznaka}
                  </button>
                ))}
              </div>
            ) : null}

            {zadnji?.status === 'predlog' && zadnji.predlog && (
              <div className="mt-3 rounded-2xl border border-separator bg-white p-4">
                <p className="text-sm text-label">{zadnji.predlog.povzetek}</p>
                {zadnji.predlog.podrobnosti.length > 0 && (
                  <dl className="mt-3 divide-y divide-separator rounded-xl border border-separator text-sm">
                    {zadnji.predlog.podrobnosti.map((d) => (
                      <div key={d.oznaka} className="flex justify-between gap-4 px-3 py-2">
                        <dt className="text-label-secondary">{d.oznaka}</dt>
                        <dd className="text-right text-label">{d.vrednost}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={zaseden}
                    onClick={() => pogovor.current?.zavrniPredlog()}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-separator bg-white text-sm font-medium text-label disabled:opacity-50 md:h-9"
                  >
                    <X size={16} /> Prekliči
                  </button>
                  <button
                    type="button"
                    disabled={zaseden}
                    onClick={() => pogovor.current?.potrdiPredlog()}
                    className="btn-gradient-primary flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:opacity-50 md:h-9"
                  >
                    <Check size={16} weight="bold" /> Potrdi
                  </button>
                </div>
                <p className="mt-2 text-xs text-label-tertiary">Recite »ja« ali »ne«. Predlog velja 2 minuti.</p>
              </div>
            )}

            <form
              className="mt-5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (besedilo.trim() && !zaseden) {
                  void pogovor.current?.besedilo(besedilo.trim());
                  setBesedilo('');
                }
              }}
            >
              <input
                value={besedilo}
                onChange={(e) => setBesedilo(e.target.value)}
                maxLength={500}
                placeholder="Ali napišite ukaz …"
                className="h-11 min-w-0 flex-1 rounded-xl border border-separator bg-white px-3 text-base text-label outline-none focus:border-separator-strong md:h-9 md:text-sm"
              />
              <button
                type="submit"
                disabled={zaseden || !besedilo.trim()}
                aria-label="Pošlji"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-separator bg-white text-label disabled:opacity-40 md:h-9 md:w-9"
              >
                <PaperPlaneRight size={18} />
              </button>
            </form>
          </>
        )}
      </div>
    </ProtectedLayout>
  );
}
