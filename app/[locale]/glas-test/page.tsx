'use client';

/**
 * Asistent+ — minimalna testna stran (ni v meniju).
 *
 * Gumb za snemanje (tudi iOS Safari: MediaRecorder z audio/mp4), besedilni
 * vnos kot nadomestek, kartica predloga s Potrdi/Prekliči in izbira med več
 * strankami. Vse odločitve (pravice, kvota, potrditev) so na strežniku;
 * stran samo prikazuje.
 *
 * Oblikovanje: bela površina, hairline ločnice, gradient samo na glavnem
 * dejanju (snemanje, Potrdi), kontrole večje na telefonu kot na namizju.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Microphone, Stop, Check, X, PaperPlaneRight } from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { GradientSpinner } from '@/components/ui/GradientSpinner';

type Predlog = {
  id: string;
  zeton: string;
  orodje: string;
  povzetek: string;
  podrobnosti: { oznaka: string; vrednost: string }[];
  potece: string;
  sporocil: number;
};
type Vprasanje = { besedilo: string; moznosti?: { id: string; oznaka: string }[] };
type Odgovor = {
  ok: boolean;
  ukazId?: string;
  status?: 'odgovor' | 'predlog' | 'vprasanje';
  prepis?: string;
  odgovor?: string;
  predlog?: Predlog;
  vprasanje?: Vprasanje;
  opozorilo?: string | null;
  sporocilo?: string;
  porabljeno?: number;
  kvota?: number;
  zvok?: { mime: string; base64: string } | null;
};
type Stanje = { ok: boolean; vklopljeno?: boolean; pravica?: boolean; kvota?: number; porabljeno?: number; opozorilo?: string | null; sporocilo?: string };

const NAJDALJE_S = 30;

function izberiFormat(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

export default function GlasTestPage() {
  const [stanje, setStanje] = useState<Stanje | null>(null);
  const [snemam, setSnemam] = useState(false);
  const [sekunde, setSekunde] = useState(0);
  const [delam, setDelam] = useState(false);
  const [besedilo, setBesedilo] = useState('');
  const [rezultat, setRezultat] = useState<Odgovor | null>(null);
  const [potrditev, setPotrditev] = useState<{ ok: boolean; sporocilo: string } | null>(null);
  const [napaka, setNapaka] = useState<string | null>(null);

  const snemalnik = useRef<MediaRecorder | null>(null);
  const kosi = useRef<Blob[]>([]);
  const casovnik = useRef<ReturnType<typeof setInterval> | null>(null);
  const zadnjiUkaz = useRef<string | null>(null);
  const potrjujem = useRef(false);

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
    return () => {
      if (casovnik.current) clearInterval(casovnik.current);
      snemalnik.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, [osveziStanje]);

  const obdelajOdgovor = useCallback(
    async (r: Response) => {
      const j = (await r.json().catch(() => ({ ok: false, sporocilo: 'Neveljaven odgovor strežnika.' }))) as Odgovor;
      if (!j.ok) {
        setNapaka(j.sporocilo ?? 'Napaka.');
        setRezultat(null);
      } else {
        setRezultat(j);
        zadnjiUkaz.current = j.ukazId ?? null;
        if (j.zvok) new Audio(`data:${j.zvok.mime};base64,${j.zvok.base64}`).play().catch(() => {});
      }
      osveziStanje();
    },
    [osveziStanje]
  );

  const poslji = useCallback(
    async (telo: { zvok?: Blob; besedilo?: string; izbira?: { id: string; oznaka: string } }) => {
      setDelam(true);
      setNapaka(null);
      setPotrditev(null);
      try {
        let r: Response;
        if (telo.zvok) {
          const fd = new FormData();
          const konc = telo.zvok.type.includes('mp4') ? 'm4a' : telo.zvok.type.includes('ogg') ? 'ogg' : 'webm';
          fd.append('zvok', telo.zvok, `ukaz.${konc}`);
          if (zadnjiUkaz.current && rezultat?.status === 'vprasanje') fd.append('prejsnji', zadnjiUkaz.current);
          r = await fetch('/api/glas/ukaz', { method: 'POST', body: fd });
        } else {
          r = await fetch('/api/glas/ukaz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              besedilo: telo.besedilo,
              izbira: telo.izbira,
              prejsnji: rezultat?.status === 'vprasanje' ? zadnjiUkaz.current : null,
            }),
          });
        }
        await obdelajOdgovor(r);
      } catch {
        setNapaka('Povezava ni uspela. Nič ni bilo spremenjeno.');
      } finally {
        setDelam(false);
      }
    },
    [obdelajOdgovor, rezultat?.status]
  );

  const ustavi = useCallback(() => {
    if (casovnik.current) clearInterval(casovnik.current);
    casovnik.current = null;
    if (snemalnik.current?.state === 'recording') snemalnik.current.stop();
    setSnemam(false);
  }, []);

  const zacni = useCallback(async () => {
    setNapaka(null);
    const format = izberiFormat();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      setNapaka('Ta brskalnik ne podpira snemanja. Uporabite besedilo.');
      return;
    }
    let tok: MediaStream;
    try {
      tok = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setNapaka('Dostop do mikrofona ni dovoljen.');
      return;
    }
    const s = new MediaRecorder(tok, { mimeType: format, audioBitsPerSecond: 32_000 });
    kosi.current = [];
    s.ondataavailable = (e) => e.data.size && kosi.current.push(e.data);
    s.onstop = () => {
      tok.getTracks().forEach((t) => t.stop());
      const zvok = new Blob(kosi.current, { type: format.split(';')[0] });
      if (zvok.size > 0) poslji({ zvok });
    };
    snemalnik.current = s;
    s.start();
    setSnemam(true);
    setSekunde(0);
    const zacetek = Date.now();
    casovnik.current = setInterval(() => {
      const n = Math.floor((Date.now() - zacetek) / 1000);
      setSekunde(n);
      if (n >= NAJDALJE_S) ustavi();
    }, 250);
  }, [poslji, ustavi]);

  const potrdi = useCallback(async (p: Predlog) => {
    if (potrjujem.current) return; // dvojni klik — strežnik je tudi idempotenten
    potrjujem.current = true;
    setDelam(true);
    try {
      const r = await fetch('/api/glas/potrdi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predlog: p.id, zeton: p.zeton }),
      });
      const j = await r.json().catch(() => ({ ok: false, sporocilo: 'Napaka.' }));
      setPotrditev({ ok: j.ok === true, sporocilo: j.sporocilo ?? (j.ok ? 'Izvedeno.' : 'Napaka.') });
      if (j.ok) setRezultat(null);
    } catch {
      setPotrditev({ ok: false, sporocilo: 'Povezava ni uspela. Preverite, ali je bilo shranjeno, preden poskusite znova.' });
    } finally {
      potrjujem.current = false;
      setDelam(false);
    }
  }, []);

  const zavrni = useCallback(async (p: Predlog) => {
    setRezultat(null);
    setPotrditev({ ok: true, sporocilo: 'Preklicano. Nič ni bilo spremenjeno.' });
    fetch('/api/glas/zavrni', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ predlog: p.id }),
    }).catch(() => {});
  }, []);

  const nedostopno = stanje && (!stanje.ok || !stanje.vklopljeno || !stanje.pravica);

  return (
    <ProtectedLayout>
      <div className="mx-auto w-full max-w-xl px-4 py-6 md:py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-label">Asistent+</h1>
          <p className="mt-1 text-sm text-label-secondary">Testna stran glasovnega asistenta. Branje se izvede takoj, vsako spremembo potrdite.</p>
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
                onClick={snemam ? ustavi : zacni}
                disabled={delam || !stanje}
                aria-label={snemam ? 'Ustavi snemanje' : 'Začni snemanje'}
                className={`flex h-20 w-20 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-50 md:h-16 md:w-16 ${
                  snemam ? 'bg-red-500' : 'btn-gradient-primary'
                }`}
              >
                {delam ? <GradientSpinner size={28} /> : snemam ? <Stop size={30} weight="fill" /> : <Microphone size={30} weight="fill" />}
              </button>
              <p className="text-sm text-label-secondary" aria-live="polite">
                {snemam ? `Snemam … ${sekunde} s (tapnite za konec)` : delam ? 'Obdelujem …' : 'Tapnite in povejte ukaz'}
              </p>
            </div>

            <form
              className="mt-5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (besedilo.trim() && !delam) {
                  poslji({ besedilo: besedilo.trim() });
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
                disabled={delam || !besedilo.trim()}
                aria-label="Pošlji"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-separator bg-white text-label disabled:opacity-40 md:h-9 md:w-9"
              >
                <PaperPlaneRight size={18} />
              </button>
            </form>
          </>
        )}

        {napaka && <p className="mt-5 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-600">{napaka}</p>}
        {potrditev && (
          <p className={`mt-5 rounded-xl border bg-white px-4 py-3 text-sm ${potrditev.ok ? 'border-separator text-label' : 'border-red-200 text-red-600'}`}>
            {potrditev.sporocilo}
          </p>
        )}

        {rezultat && (
          <section className="mt-5 rounded-2xl border border-separator bg-white">
            {rezultat.prepis && (
              <p className="border-b border-separator px-4 py-3 text-sm text-label-secondary">
                <span className="text-label-tertiary">Slišal sem: </span>„{rezultat.prepis}“
              </p>
            )}
            <div className="px-4 py-4">
              <p className="whitespace-pre-line text-base text-label">{rezultat.odgovor}</p>

              {rezultat.status === 'vprasanje' && rezultat.vprasanje?.moznosti?.length ? (
                <div className="mt-3 flex flex-col divide-y divide-separator rounded-xl border border-separator">
                  {rezultat.vprasanje.moznosti.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={delam}
                      onClick={() => poslji({ besedilo: rezultat.prepis ?? '', izbira: m })}
                      className="px-3 py-3 text-left text-sm text-label hover:bg-fill disabled:opacity-50 md:py-2"
                    >
                      {m.oznaka}
                    </button>
                  ))}
                </div>
              ) : null}

              {rezultat.status === 'predlog' && rezultat.predlog && (
                <div className="mt-4">
                  {rezultat.predlog.podrobnosti.length > 0 && (
                    <dl className="divide-y divide-separator rounded-xl border border-separator text-sm">
                      {rezultat.predlog.podrobnosti.map((d) => (
                        <div key={d.oznaka} className="flex justify-between gap-4 px-3 py-2">
                          <dt className="text-label-secondary">{d.oznaka}</dt>
                          <dd className="text-right text-label">{d.vrednost}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {rezultat.predlog.sporocil > 0 && (
                    <p className="mt-2 text-xs text-label-secondary">Pošlje se {rezultat.predlog.sporocil} sporočil(o) strankam.</p>
                  )}
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={delam}
                      onClick={() => zavrni(rezultat.predlog!)}
                      className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-separator bg-white text-sm font-medium text-label disabled:opacity-50 md:h-9"
                    >
                      <X size={16} /> Prekliči
                    </button>
                    <button
                      type="button"
                      disabled={delam}
                      onClick={() => potrdi(rezultat.predlog!)}
                      className="btn-gradient-primary flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:opacity-50 md:h-9"
                    >
                      <Check size={16} weight="bold" /> Potrdi
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-label-tertiary">Predlog velja 2 minuti.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </ProtectedLayout>
  );
}
