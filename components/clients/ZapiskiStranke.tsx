'use client';

// Zapiski s kartice stranke (stranke_zapiski): recepture barve, preference in
// opombe, ki jih doda Asistent+ z glasom. Bere z uporabnikovo sejo (RLS:
// pravica branja strank). Brez zapiskov se razdelek ne pokaže.

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Microphone, NotePencil, Palette, Heart } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabaseClient';
import { intlLocale } from '@/lib/format';

type Zapisek = {
  id: string;
  kategorija: 'barva' | 'preferenca' | 'opomba';
  besedilo: string;
  podrobnosti: { odtenki?: string[]; gramov?: number; oksidant_pct?: number; cas_min?: number } | null;
  vir: string;
  created_at: string;
};

const IKONA = { barva: Palette, preferenca: Heart, opomba: NotePencil } as const;

function receptura(p: Zapisek['podrobnosti']): string {
  if (!p) return '';
  const deli: string[] = [];
  if (p.odtenki?.length) deli.push(p.odtenki.join(' + '));
  if (typeof p.gramov === 'number') deli.push(`${p.gramov} g`);
  if (typeof p.oksidant_pct === 'number') deli.push(`${p.oksidant_pct} %`);
  if (typeof p.cas_min === 'number') deli.push(`${p.cas_min} min`);
  return deli.join(' · ');
}

export default function ZapiskiStranke({ companyId, clientId }: { companyId: string; clientId: string }) {
  const t = useTranslations('clients.zapiski');
  const locale = useLocale();
  const [zapiski, setZapiski] = useState<Zapisek[]>([]);
  const [napaka, setNapaka] = useState(false);

  useEffect(() => {
    let aktivno = true;
    setZapiski([]);
    setNapaka(false);
    supabase
      .from('stranke_zapiski')
      .select('id,kategorija,besedilo,podrobnosti,vir,created_at')
      .eq('ID podjetja', companyId)
      .eq('ID stranke', clientId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!aktivno) return;
        if (error) setNapaka(true);
        else setZapiski((data ?? []) as Zapisek[]);
      });
    return () => {
      aktivno = false;
    };
  }, [companyId, clientId]);

  if (!napaka && zapiski.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-gray-500">{t('title')}</h3>
      {napaka ? (
        <p className="rounded-xl bg-white px-4 py-3 text-sm text-gray-500">{t('loadError')}</p>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white">
          {zapiski.map((z) => {
            const Ikona = IKONA[z.kategorija] ?? NotePencil;
            const rec = receptura(z.podrobnosti);
            return (
              <div key={z.id} className="flex items-start gap-3 px-4 py-3">
                <Ikona className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" weight="regular" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-gray-500">
                    <span>{t(z.kategorija)}</span>
                    <span>·</span>
                    <span>
                      {new Date(z.created_at).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {z.vir === 'glas' && (
                      <span className="inline-flex items-center gap-0.5">
                        <Microphone className="h-3 w-3" weight="fill" /> {t('glas')}
                      </span>
                    )}
                  </div>
                  {rec && <p className="tnum mt-0.5 text-sm font-medium text-gray-900">{rec}</p>}
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900">{z.besedilo}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
