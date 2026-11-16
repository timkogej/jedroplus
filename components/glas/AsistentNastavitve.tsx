'use client';

// Stran AI → Asistent+: vklop za podjetje, jezik, poraba in izklop posameznih članov.
// Ureja lastnik ali admin; Asistent+ je vključen v paket Pro (strežnik preveri oboje).

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { useCompany } from '@/app/company-context';
import { SettingsSection, SettingRow, Switch, Select } from '@/components/settings';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { DOGODEK_NASTAVITVE_ASISTENTA } from '@/lib/glas/odjemalec/nastavitve';


/** Imena jezikov v lastnem jeziku — enaka v vseh prevodih vmesnika. */
const IME_JEZIKA: Record<string, string> = { sl: 'Slovenščina', en: 'English', de: 'Deutsch', it: 'Italiano', hr: 'Hrvatski' };

interface Stanje {
  urednik: boolean;
  paket: boolean;
  vklopljeno: boolean;
  jezik: string;
  jeziki: string[];
  jezikiNaVoljo: string[];
  kvota: number;
  porabljeno: number;
  jaz: { userId: string; vklopljen: boolean };
  izklopljeniClani: string[];
  pravicaZaposlenih: boolean;
}

interface Clan {
  user_id: string;
  role: 'owner' | 'admin' | 'staff';
  ime: string;
}

export function AsistentNastavitve() {
  const t = useTranslations('layout.aiStran.asistent');
  const { companyUuid } = useCompany();
  const [s, setS] = useState<Stanje | null>(null);
  const [napaka, setNapaka] = useState(false);
  const [clani, setClani] = useState<Clan[]>([]);
  const [shranjujem, setShranjujem] = useState(false);

  const nalozi = useCallback(async () => {
    setNapaka(false);
    try {
      const r = await fetch('/api/glas/nastavitve', { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.koda ?? 'napaka');
      setS(j as Stanje);
    } catch {
      setNapaka(true);
    }
  }, []);

  useEffect(() => {
    void nalozi();
  }, [nalozi]);

  // Imena članov (isti vir kot Nastavitve → Člani), samo za lastnika ali admina.
  useEffect(() => {
    if (!s?.urednik || !companyUuid) return;
    let preklic = false;
    fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyUuid }) })
      .then((r) => r.json())
      .then((j: { ok?: boolean; members?: { user_id: string; role: Clan['role'] }[]; users?: Record<string, { display_name?: string; email?: string }> }) => {
        if (preklic || !j.ok) return;
        const red = { owner: 0, admin: 1, staff: 2 } as const;
        setClani(
          (j.members ?? [])
            .map((m) => ({ user_id: m.user_id, role: m.role, ime: j.users?.[m.user_id]?.display_name || j.users?.[m.user_id]?.email || '—' }))
            .sort((a, b) => (red[a.role] ?? 3) - (red[b.role] ?? 3) || a.ime.localeCompare(b.ime))
        );
      })
      .catch(() => {});
    return () => {
      preklic = true;
    };
  }, [s?.urednik, companyUuid]);

  const shrani = useCallback(
    async (telo: Record<string, unknown>, lokalno: (x: Stanje) => Stanje) => {
      if (!s) return;
      const prej = s;
      setS(lokalno(s));
      setShranjujem(true);
      try {
        const r = await fetch('/api/glas/nastavitve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telo),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.koda ?? 'napaka');
        toast.success(t('shranjeno'));
        window.dispatchEvent(new Event(DOGODEK_NASTAVITVE_ASISTENTA));
        void nalozi();
      } catch (e) {
        setS(prej);
        const koda = e instanceof Error ? e.message : '';
        toast.error(koda === 'paket' ? t('samoPro') : t('napaka'));
      } finally {
        setShranjujem(false);
      }
    },
    [s, t, nalozi]
  );

  if (napaka) return <p className="py-10 text-center text-sm text-gray-500">{t('napakaNalaganja')}</p>;
  if (!s) {
    return (
      <div className="flex justify-center py-16">
        <GradientSpinner />
      </div>
    );
  }

  const kmalu = s.jeziki.filter((j) => !s.jezikiNaVoljo.includes(j)).map((j) => IME_JEZIKA[j] ?? j);
  const lahkoUreja = s.urednik && s.paket;

  return (
    <div>
      <p className="mb-6 px-1 text-sm text-gray-500">{t('opis')}</p>

      {!s.paket && (
        <div className="mb-7 rounded-xl border border-[#7C78FA]/25 bg-[#7C78FA]/[0.06] px-4 py-4">
          <p className="text-sm font-medium text-gray-900">{t('samoPro')}</p>
          <p className="mt-0.5 text-sm text-gray-600">{t('samoProOpis')}</p>
          {s.urednik && (
            <Link href="/nastavitve/paketi" className="mt-3 inline-block text-sm font-medium text-[#6D5EF7] hover:underline">
              {t('nadgradi')}
            </Link>
          )}
        </div>
      )}

      <SettingsSection
        title={t('sekcija')}
        footnote={!s.urednik ? t('samoLastnik') : undefined}
      >
        <SettingRow label={t('vklop')} description={s.vklopljeno ? t('vklopOpis') : t('izklopOpis')}>
          <Switch
            checked={s.vklopljeno && s.paket}
            disabled={!lahkoUreja || shranjujem}
            variant="brand"
            onChange={(v) => shrani({ vklopljeno: v }, (x) => ({ ...x, vklopljeno: v }))}
          />
        </SettingRow>
        <SettingRow label={t('jezik')} description={t('jezikOpis')}>
          <Select
            value={s.jezik}
            disabled={!lahkoUreja || shranjujem}
            options={s.jezikiNaVoljo.map((j) => ({ value: j, label: IME_JEZIKA[j] ?? j }))}
            onChange={(v) => shrani({ jezik: v }, (x) => ({ ...x, jezik: v }))}
          />
        </SettingRow>
        {s.vklopljeno && s.paket && (
          <SettingRow label={t('poraba')} description={t('porabaOpis')}>
            <span className="text-sm tabular-nums text-gray-900">
              {t('porabaVrednost', { porabljeno: s.porabljeno, kvota: s.kvota })}
            </span>
          </SettingRow>
        )}
      </SettingsSection>
      {kmalu.length > 0 && <p className="-mt-5 mb-7 px-1 text-xs text-gray-400">{t('jezikiKmalu', { jeziki: kmalu.join(', ') })}</p>}

      {!s.jaz.vklopljen && <p className="mb-7 px-1 text-sm text-gray-500">{t('jazIzklopljen')}</p>}

      {s.urednik && s.paket && s.vklopljeno && clani.length > 0 && (
        <SettingsSection
          title={t('clani')}
          description={t('claniOpis')}
          footnote={!s.pravicaZaposlenih && clani.some((c) => c.role === 'staff') ? t('pravicaZaposlenih') : undefined}
        >
          {clani.map((c) => {
            const vklopljen = !s.izklopljeniClani.includes(c.user_id);
            return (
              <SettingRow key={c.user_id} label={c.ime} description={t(`vloga.${c.role}`)}>
                <Switch
                  checked={vklopljen}
                  disabled={shranjujem}
                  onChange={(v) =>
                    shrani({ clan: { userId: c.user_id, vklopljeno: v } }, (x) => ({
                      ...x,
                      izklopljeniClani: v ? x.izklopljeniClani.filter((id) => id !== c.user_id) : [...x.izklopljeniClani, c.user_id],
                    }))
                  }
                />
              </SettingRow>
            );
          })}
        </SettingsSection>
      )}
    </div>
  );
}
