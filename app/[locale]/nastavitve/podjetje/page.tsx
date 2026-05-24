'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { CaretLeft, SpinnerGap, Plus, X } from '@phosphor-icons/react';
import {
  SettingsSection,
  SettingRow,
  Switch,
  Input,
  TimePicker,
  SaveIndicator,
} from '@/components/settings';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { callN8nAction } from '@/src/lib/n8nClient';
import type { WorkingHoursDay, TimeInterval } from '@/types/settings';
import { defaultWorkingHoursDay } from '@/types/settings';

const DAYS_OF_WEEK = [
  'Ponedeljek',
  'Torek',
  'Sreda',
  'Četrtek',
  'Petek',
  'Sobota',
  'Nedelja',
];

export default function CompanySettingsPage() {
  const { companyId } = useCompany();
  const { user } = useAuth();

  // Company data from "Podatki podjetij" table
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState(''); // Panoga
  const [taxNumber, setTaxNumber] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [workingHours, setWorkingHours] = useState<Record<string, WorkingHoursDay>>(defaultWorkingHoursDay);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const actor = user?.email ?? 'unknown';

  // Helper to convert legacy format to new interval format
  const convertToIntervalFormat = (urnikData: unknown): Record<string, WorkingHoursDay> => {
    // Parse JSON string if needed
    let parsed = urnikData;
    if (typeof urnikData === 'string') {
      try {
        parsed = JSON.parse(urnikData);
      } catch {
        return defaultWorkingHoursDay;
      }
    }
    if (!parsed || typeof parsed !== 'object') {
      return defaultWorkingHoursDay;
    }

    const result: Record<string, WorkingHoursDay> = {};
    const data = parsed as Record<string, unknown>;

    for (const day of DAYS_OF_WEEK) {
      const dayData = data[day];
      if (dayData && typeof dayData === 'object') {
        const d = dayData as Record<string, unknown>;
        // Check if it's already in interval format
        if (Array.isArray(d.intervals)) {
          result[day] = {
            enabled: Boolean(d.enabled),
            intervals: d.intervals as TimeInterval[],
          };
        } else {
          // Legacy format - convert single start/end to interval
          result[day] = {
            enabled: Boolean(d.enabled),
            intervals: [{
              start: String(d.start || '08:00'),
              end: String(d.end || '17:00'),
            }],
          };
        }
      } else {
        result[day] = defaultWorkingHoursDay[day];
      }
    }

    return result;
  };

  // Load settings from "Podatki podjetij" table
  useEffect(() => {
    async function loadSettings() {
      if (!companyId) return;
      setIsLoading(true);

      try {
        const { data } = await loadCompanyRow(companyId);

        if (data) {
          // Map from "Podatki podjetij" table columns
          setCompanyName(String(data['Naziv podjetja'] ?? data['naziv_podjetja'] ?? data['Naziv Podjetja'] ?? ''));
          setIndustry(String(data['Panoga'] ?? data['panoga'] ?? ''));
          setTaxNumber(String(data['Davčna številka'] ?? data['davcna_stevilka'] ?? ''));
          setAddress(String(data['Naslov podjetja'] ?? data['naslov_podjetja'] ?? ''));
          setPhone(String(data['Kontaktni telefon'] ?? data['kontaktni_telefon'] ?? ''));
          setEmail(String(data['Kontaktni_email'] ?? data['kontaktni_email'] ?? ''));
          setWebsite(String(data['Spletna stran'] ?? data['spletna_stran'] ?? ''));

          // Parse working hours - support both legacy and new interval format
          const urnikData = data['Urnik'] ?? data['urnik'];
          if (urnikData) {
            setWorkingHours(convertToIntervalFormat(urnikData));
          }
        }
      } catch (error) {
        console.error('Error loading company data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);

    try {
      const webhookPayload = {
        event: 'COMPANY_PROFILE_UPDATED',
        entity: 'company',
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        data: {
          company_profile: {
            'Naziv podjetja': companyName,
            'Panoga': industry,
            'Davčna številka': taxNumber,
            'Naslov podjetja': address,
            'Kontaktni telefon': phone,
            'Kontaktni_email': email,
            'Spletna stran': website,
            'Urnik': workingHours,
          },
          // Normalized format for webhook compatibility
          naziv_podjetja: companyName,
          panoga: industry,
          davcna_stevilka: taxNumber,
          naslov_podjetja: address,
          kontaktni_telefon: phone,
          kontaktni_email: email,
          spletna_stran: website,
          urnik: workingHours,
        },
      };

      const result = await callN8nAction(webhookPayload);

      if (!result.ok) {
        throw new Error('Prišlo je do napake pri shranjevanju');
      }

      // Wait 1 second for system to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      setLastSaved(new Date());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (error) {
      console.error('Error saving company data:', error);
    } finally {
      setSaving(false);
    }
  };

  // Update working hours for a specific day
  const updateWorkingHours = (day: string, updates: Partial<WorkingHoursDay>) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], ...updates },
    }));
  };

  // Update a specific interval
  const updateInterval = (day: string, index: number, field: 'start' | 'end', value: string) => {
    setWorkingHours(prev => {
      const newIntervals = [...(prev[day]?.intervals || [])];
      newIntervals[index] = { ...newIntervals[index], [field]: value };
      return {
        ...prev,
        [day]: { ...prev[day], intervals: newIntervals },
      };
    });
  };

  // Add a new interval to a day
  const addInterval = (day: string) => {
    setWorkingHours(prev => {
      const currentIntervals = prev[day]?.intervals || [];
      const lastInterval = currentIntervals[currentIntervals.length - 1];

      // New interval starts at the end time of the last interval
      const newInterval: TimeInterval = {
        start: lastInterval?.end || '12:00',
        end: '17:00',
      };

      return {
        ...prev,
        [day]: {
          ...prev[day],
          intervals: [...currentIntervals, newInterval],
        },
      };
    });
  };

  // Remove an interval from a day
  const removeInterval = (day: string, index: number) => {
    setWorkingHours(prev => {
      const newIntervals = prev[day]?.intervals.filter((_, i) => i !== index) || [];
      return {
        ...prev,
        [day]: {
          ...prev[day],
          intervals: newIntervals.length > 0 ? newIntervals : [{ start: '08:00', end: '17:00' }],
        },
      };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#6D5EF7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/nastavitve"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4"
      >
        <CaretLeft className="w-3.5 h-3.5" weight="regular" />
        Nastavitve
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Podjetje</h1>
          <p className="text-sm text-gray-500 mt-1">Osnovni podatki in nastavitve vašega podjetja</p>
        </div>
        <SaveIndicator saving={saving} lastSaved={lastSaved} />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Basic Info */}
        <SettingsSection title="Osnovni podatki" description="Pravni in identifikacijski podatki">
          <SettingRow
            label="Ime podjetja"
            description="Polno ime vašega podjetja"
          >
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Vnesi ime podjetja"
            />
          </SettingRow>

          <SettingRow
            label="Panoga"
            description="Dejavnost vašega podjetja"
          >
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="npr. Frizerstvo, Kozmetika, Fitness..."
            />
          </SettingRow>

          <SettingRow
            label="Davčna številka"
            description="Davčna številka podjetja"
          >
            <Input
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              placeholder="SI12345678"
            />
          </SettingRow>
        </SettingsSection>

        {/* Contact Info */}
        <SettingsSection title="Kontaktni podatki" description="Naslov in kontaktne informacije">
          <SettingRow
            label="Naslov"
            description="Ulica in hišna številka"
          >
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Slovenska cesta 1, 1000 Ljubljana"
            />
          </SettingRow>

          <SettingRow
            label="Telefon"
            description="Glavna kontaktna številka"
          >
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+386 1 234 5678"
            />
          </SettingRow>

          <SettingRow
            label="Email"
            description="Kontaktni email"
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@podjetje.si"
            />
          </SettingRow>

          <SettingRow
            label="Spletna stran"
            description="URL vaše spletne strani"
          >
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.podjetje.si"
            />
          </SettingRow>
        </SettingsSection>

        {/* Working Hours - Interval Based */}
        <SettingsSection title="Delovni čas" description="Kdaj je vaše podjetje odprto (podpora za več intervalov na dan)">
          <div className="space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const dayHours = workingHours[day] || { enabled: false, intervals: [{ start: '08:00', end: '17:00' }] };

              return (
                <div key={day} className="border border-gray-100 rounded-2xl p-5 space-y-3">
                  {/* Day header with enable toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{day}</span>
                    <Switch
                      checked={dayHours.enabled}
                      onChange={(enabled) => updateWorkingHours(day, { enabled })}
                    />
                  </div>

                  {/* Intervals */}
                  {dayHours.enabled && (
                    <div className="space-y-3 pt-2">
                      {dayHours.intervals?.map((interval, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <TimePicker
                              value={interval.start}
                              onChange={(time) => updateInterval(day, idx, 'start', time)}
                            />
                            <span className="text-gray-500">-</span>
                            <TimePicker
                              value={interval.end}
                              onChange={(time) => updateInterval(day, idx, 'end', time)}
                            />
                          </div>

                          {/* Remove interval button (only if more than 1) */}
                          {dayHours.intervals.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeInterval(day, idx)}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Add interval button */}
                      <button
                        type="button"
                        onClick={() => addInterval(day)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Interval
                      </button>
                    </div>
                  )}

                  {!dayHours.enabled && (
                    <span className="text-sm text-gray-400">Zaprto</span>
                  )}
                </div>
              );
            })}
          </div>
        </SettingsSection>

        {/* Action row */}
        <div className="flex items-center gap-3 mt-6">
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={saving}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] active:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? (
              <>
                <SpinnerGap className="h-4 w-4 animate-spin" />
                Shranjujem...
              </>
            ) : saveSuccess ? (
              'Shranjeno ✓'
            ) : (
              'Shrani spremembe'
            )}
          </motion.button>
          <Link
            href="/nastavitve"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Prekliči
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
