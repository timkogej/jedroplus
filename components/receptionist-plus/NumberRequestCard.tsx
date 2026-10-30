'use client';

// The phone number Receptionist+ answers on: request it here, then follow
// its status (number-request API). Hidden once a number is assigned, and
// while the table doesn't exist yet (migration 1792800001).

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCircle, Clock, PhoneCall, Warning } from '@phosphor-icons/react';
import { Input, Select, SettingRow, SettingsSection, Switch, Textarea } from '@/components/settings';
import { phonePlaceholder } from '@/lib/phone';

type Status = 'submitted' | 'ordered' | 'active' | 'rejected';

interface NumberRequest {
  id: string;
  country: string;
  area: string | null;
  mode: 'forward' | 'new';
  status: Status;
  status_note: string | null;
  phone_number: string | null;
  created_at: string;
}

interface Prefill {
  company_name: string;
  company_address: string;
  vat_number: string;
  current_phone: string;
  country: string;
}

const COUNTRIES = ['SI', 'HR', 'AT', 'DE', 'IT'] as const;

export function NumberRequestCard() {
  const t = useTranslations('receptionist.numberRequest');
  const [state, setState] = useState<{ has_number: boolean; request: NumberRequest | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [form, setForm] = useState({
    country: 'SI',
    area: '',
    mode: 'forward' as 'forward' | 'new',
    current_phone: '',
    private_phone: false,
    company_name: '',
    company_address: '',
    vat_number: '',
    note: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/receptionistplus/number-request');
      const data = await res.json();
      if (!data.ok) return;
      setState({ has_number: Boolean(data.has_number), request: data.request });
      const p: Prefill | undefined = data.prefill;
      if (p) {
        setForm((f) => ({
          ...f,
          country: (COUNTRIES as readonly string[]).includes(p.country) ? p.country : 'SI',
          current_phone: p.current_phone || '',
          company_name: p.company_name || '',
          company_address: p.company_address || '',
          vat_number: p.vat_number || '',
        }));
      }
    } catch {
      // No table yet or offline: the card stays hidden.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!state || state.has_number) return null;

  const submit = async () => {
    setSending(true);
    setPhoneError(false);
    try {
      const res = await fetch('/api/receptionistplus/number-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setState({ has_number: false, request: data.request });
        setOpen(false);
        toast.success(t('sent'));
      } else if (data.error === 'invalid_phone') {
        setPhoneError(true);
      } else {
        toast.error(t(data.error === 'already_requested' ? 'alreadyRequested' : 'error'));
      }
    } catch {
      toast.error(t('error'));
    } finally {
      setSending(false);
    }
  };

  const request = state.request;
  const pending = request && (request.status === 'submitted' || request.status === 'ordered');

  if (pending || (request?.status === 'active')) {
    const active = request!.status === 'active';
    return (
      <div className="mb-7 flex items-start gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3.5">
        {active ? (
          <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" weight="regular" />
        ) : (
          <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#6D5EF7]" weight="regular" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{t(`status.${request!.status}`)}</p>
          <p className="mt-0.5 text-[13px] text-gray-500">
            {active && request!.phone_number
              ? t('activeBody', { number: request!.phone_number })
              : t('pendingBody', { date: new Date(request!.created_at).toLocaleDateString() })}
          </p>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mb-7 rounded-xl border border-gray-100 bg-white px-4 py-4">
        <div className="flex items-start gap-3">
          <PhoneCall className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#6D5EF7]" weight="regular" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">{t('title')}</p>
            <p className="mt-0.5 text-[13px] text-gray-500">{t('intro')}</p>
            {request?.status === 'rejected' && (
              <p className="mt-2 flex items-start gap-1.5 text-[13px] text-amber-700">
                <Warning className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                {t('rejected', { reason: request.status_note || '—' })}
              </p>
            )}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            >
              {t('start')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <SettingsSection title={t('title')} description={t('formDesc')}>
      <SettingRow label={t('country')}>
        <Select
          value={form.country}
          onChange={(value) => set('country', value)}
          options={COUNTRIES.map((c) => ({ value: c, label: t(`countries.${c}`) }))}
        />
      </SettingRow>
      <SettingRow label={t('area')} description={t('areaDesc')}>
        <Input
          maxLength={80}
          placeholder={t('areaPlaceholder')}
          value={form.area}
          onChange={(e) => set('area', e.target.value)}
        />
      </SettingRow>
      <SettingRow label={t('mode')} description={t(form.mode === 'forward' ? 'modeForwardDesc' : 'modeNewDesc')}>
        <Select
          value={form.mode}
          onChange={(value) => set('mode', value as 'forward' | 'new')}
          options={[
            { value: 'forward', label: t('modeForward') },
            { value: 'new', label: t('modeNew') },
          ]}
        />
      </SettingRow>
      {form.mode === 'forward' && (
        <>
          <SettingRow label={t('currentPhone')} error={phoneError ? t('phoneInvalid') : undefined}>
            <Input
              type="tel"
              inputMode="tel"
              placeholder={phonePlaceholder(form.country)}
              error={phoneError}
              value={form.current_phone}
              onChange={(e) => {
                setPhoneError(false);
                set('current_phone', e.target.value);
              }}
            />
          </SettingRow>
          <SettingRow label={t('privatePhone')} description={t('privatePhoneDesc')}>
            <div className="flex justify-end sm:justify-start">
              <Switch checked={form.private_phone} onChange={(v) => set('private_phone', v)} variant="brand" />
            </div>
          </SettingRow>
        </>
      )}
      <SettingRow label={t('companyName')}>
        <Input maxLength={200} value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
      </SettingRow>
      <SettingRow label={t('companyAddress')} description={t('companyAddressDesc')}>
        <Input maxLength={300} value={form.company_address} onChange={(e) => set('company_address', e.target.value)} />
      </SettingRow>
      <SettingRow label={t('vat')}>
        <Input maxLength={40} value={form.vat_number} onChange={(e) => set('vat_number', e.target.value)} />
      </SettingRow>
      <SettingRow label={t('note')} fullWidth>
        <Textarea rows={2} maxLength={1000} value={form.note} onChange={(e) => set('note', e.target.value)} />
      </SettingRow>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={sending || form.company_name.trim().length < 2 || form.company_address.trim().length < 5}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {sending ? t('sending') : t('send')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
        >
          {t('cancel')}
        </button>
      </div>
    </SettingsSection>
  );
}
