'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { createCompany, type UrnikDay } from '@/lib/api/billingClient';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

const STORAGE_KEY = "jedroplus_company_id";
const STORAGE_KEY_UUID = "jedroplus_company_uuid";

const COUNTRIES = [
  'Slovenia', 'Croatia', 'Serbia', 'Bosnia and Herzegovina', 'Montenegro',
  'North Macedonia', 'Austria', 'Germany', 'Italy', 'Hungary',
  'Czech Republic', 'Slovakia', 'Poland', 'Romania', 'Bulgaria',
  'France', 'Spain', 'Portugal', 'Netherlands', 'Belgium',
  'Switzerland', 'United Kingdom', 'United States', 'Canada', 'Australia',
  'Other',
];

const LANGUAGES = [
  { label: 'Slovenščina', value: 'slo' },
  { label: 'English', value: 'eng' },
];

const DAYS = ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja'];

const PANOGE = [
  'Frizerstvo',
  'Kozmetika in nega',
  'Masaže in wellness',
  'Zobozdravstvo',
  'Medicina in zdravstvo',
  'Fizioterapija',
  'Psihologija in coaching',
  'Veterina',
  'Osebno treniranje / fitnes',
  'Yoga in pilates',
  'Lepotni salon',
  'Manikura in pedikura',
  'Tetovaže in piercings',
  'Arhitektura in oblikovanje',
  'Fotografija',
  'Pravo in svetovanje',
  'Računovodstvo',
  'IT storitve',
  'Izobraževanje in poučevanje',
  'Avtoservis',
  'Čiščenje in vzdrževanje',
  'Drugo',
];

const DEFAULT_URNIK: Record<string, UrnikDay> = {
  Ponedeljek: { enabled: true,  intervals: [{ start: '08:00', end: '16:00' }] },
  Torek:      { enabled: true,  intervals: [{ start: '08:00', end: '16:00' }] },
  Sreda:      { enabled: true,  intervals: [{ start: '08:00', end: '16:00' }] },
  Četrtek:    { enabled: true,  intervals: [{ start: '08:00', end: '16:00' }] },
  Petek:      { enabled: true,  intervals: [{ start: '08:00', end: '16:00' }] },
  Sobota:     { enabled: false, intervals: [] },
  Nedelja:    { enabled: false, intervals: [] },
};

// Simple confetti
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#8B5CF6', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
    const pieces: { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; rotation: number; rotationSpeed: number; opacity: number }[] = [];

    for (let i = 0; i < 150; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        w: Math.random() * 8 + 4,
        h: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let allDone = true;
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rotation += p.rotationSpeed;
        if (p.y > canvas.height) p.opacity -= 0.02;
        if (p.opacity > 0) {
          allDone = false;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }
      if (!allDone) animationId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
}

// Step indicator
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300"
            style={
              i < current
                ? { background: 'linear-gradient(to right, #8B5CF6, #06B6D4)', color: '#fff' }
                : i === current
                ? { background: 'linear-gradient(to right, #8B5CF6, #06B6D4)', color: '#fff', boxShadow: '0 0 0 3px rgba(139,92,246,0.2)' }
                : { background: '#F3F4F6', color: '#9CA3AF' }
            }
          >
            {i < current ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          {i < total - 1 && (
            <div
              className="h-0.5 w-8 transition-all duration-300"
              style={{ background: i < current ? 'linear-gradient(to right, #8B5CF6, #06B6D4)' : '#E5E7EB' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CreateCompanyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 0: locale
  const [country, setCountry] = useState('Slovenia');
  const [language, setLanguage] = useState('slo');

  // Step 1: name
  const [companyName, setCompanyName] = useState('');

  // Step 2: industry
  const [selectedPanoga, setSelectedPanoga] = useState('');
  const [customPanoga, setCustomPanoga] = useState('');
  const panoga = selectedPanoga === 'Drugo' ? customPanoga.trim() : selectedPanoga;

  // Step 3: schedule
  const [urnik, setUrnik] = useState<Record<string, UrnikDay>>(
    JSON.parse(JSON.stringify(DEFAULT_URNIK))
  );

  const [loading, setLoading] = useState(false);
  const [createdCompanyPublicId, setCreatedCompanyPublicId] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  const TOTAL_STEPS = 4;

  // --- Validation per step ---
  const canAdvance = () => {
    if (step === 0) return Boolean(country && language);
    if (step === 1) return Boolean(companyName.trim());
    if (step === 2) return Boolean(panoga.trim());
    return true; // step 3 (schedule) always valid
  };

  const handleNext = () => {
    if (!canAdvance()) return;
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else handleCreate();
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else router.push('/onboarding');
  };

  // --- Schedule helpers ---
  const toggleDay = (day: string) => {
    setUrnik(prev => {
      const current = prev[day];
      return {
        ...prev,
        [day]: {
          enabled: !current.enabled,
          intervals: !current.enabled ? [{ start: '08:00', end: '16:00' }] : [],
        },
      };
    });
  };

  const updateInterval = (day: string, field: 'start' | 'end', value: string) => {
    setUrnik(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        intervals: [{ ...prev[day].intervals[0], [field]: value }],
      },
    }));
  };

  // --- Submit ---
  const handleCreate = async () => {
    try {
      setLoading(true);

      const result = await createCompany({
        company_name: companyName,
        panoga,
        country,
        language,
        urnik,
      });

      if (result.ok && result.company_id) {
        const companyUUID = result.company_id;
        let publicId = (result as unknown as Record<string, unknown>).company_slug as string | undefined;

        if (!publicId) {
          for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 1000));
            try {
              const { data: company } = await supabase
                .from('companies')
                .select('id, company_id, name')
                .eq('id', companyUUID)
                .single();
              if (company?.company_id) { publicId = company.company_id; break; }
            } catch {
              console.warn(`[CreateCompany] Attempt ${attempt + 1} failed, retrying...`);
            }
          }
        }

        if (publicId) {
          localStorage.setItem(STORAGE_KEY, publicId);
          localStorage.setItem(STORAGE_KEY_UUID, companyUUID);
          document.cookie = `company_id=${publicId}; path=/; max-age=31536000`;

          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
              supabase.from('profiles').update({ default_company_id: companyUUID }).eq('id', user.id)
                .then(({ error }) => {
                  if (error) console.warn('[CreateCompany] Profile update failed:', error.message);
                });
            }
          });

          setCreatedCompanyPublicId(publicId);
          setShowConfetti(true);
          toast.success('Podjetje uspešno ustvarjeno!');
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1500);
        } else {
          toast.error('Prišlo je do napake pri nalaganju podjetja. Prosimo, poskusite znova.');
          setLoading(false);
        }
      } else {
        toast.error('Prišlo je do napake pri ustvarjanju podjetja');
        setLoading(false);
      }
    } catch (error) {
      console.error('Create company error:', error);
      toast.error('Prišlo je do napake pri ustvarjanju podjetja');
      setLoading(false);
    }
  };

  // --- Success screen ---
  if (createdCompanyPublicId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        {showConfetti && <Confetti />}
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-xl border-2 border-gray-100 p-10 text-center">
            <div
              className="w-24 h-24 mx-auto mb-8 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #34D399 50%, #6EE7B7 100%)', boxShadow: '0 8px 32px rgba(16,185,129,0.25)' }}
            >
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Podjetje je ustvarjeno</h2>
            <p className="text-gray-500 mb-10">Vaše podjetje je pripravljeno za uporabo</p>
            <button
              onClick={() => (window.location.href = '/dashboard')}
              className="w-full h-12 text-white font-semibold rounded-xl transition-all duration-300 hover:opacity-90 hover:shadow-lg"
              style={{ background: 'linear-gradient(to right, #8B5CF6, #06B6D4)' }}
            >
              Pojdi na Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stepTitles = [
    'Lokalizacija',
    'Ime podjetja',
    'Panoga',
    'Delovni urnik',
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2 text-center text-gray-900">Ustvari podjetje</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">{stepTitles[step]}</p>

        <div className="flex justify-center">
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </div>

        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 space-y-6">

          {/* STEP 0 — Country & Language */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Država</label>
                <div className="relative">
                  <select
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none"
                  >
                    {COUNTRIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Jezik</label>
                <div className="flex gap-3">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={() => setLanguage(lang.value)}
                      className="flex-1 h-11 rounded-xl border-2 text-sm font-semibold transition-all duration-200"
                      style={
                        language === lang.value
                          ? { borderColor: '#8B5CF6', background: 'rgba(139,92,246,0.06)', color: '#7C3AED' }
                          : { borderColor: '#E5E7EB', background: '#fff', color: '#6B7280' }
                      }
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 1 — Company Name */}
          {step === 1 && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Ime podjetja</label>
              <Input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Jedro Plus d.o.o."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && canAdvance() && handleNext()}
              />
            </div>
          )}

          {/* STEP 2 — Industry */}
          {step === 2 && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900">Panoga / dejavnost</label>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {PANOGE.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setSelectedPanoga(p); if (p !== 'Drugo') setCustomPanoga(''); }}
                    className="text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all duration-150"
                    style={
                      selectedPanoga === p
                        ? { borderColor: '#8B5CF6', background: 'rgba(139,92,246,0.06)', color: '#7C3AED' }
                        : { borderColor: '#E5E7EB', background: '#FAFAFA', color: '#374151' }
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
              {selectedPanoga === 'Drugo' && (
                <div className="mt-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Opišite svojo dejavnost</label>
                  <Input
                    value={customPanoga}
                    onChange={e => setCustomPanoga(e.target.value)}
                    placeholder="npr. Moja specifična dejavnost…"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && canAdvance() && handleNext()}
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Schedule */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                Delovni urnik lahko kadarkoli spremenite v nastavitvah podjetja.
              </p>
              {DAYS.map(day => {
                const d = urnik[day];
                return (
                  <div
                    key={day}
                    className="flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all duration-200"
                    style={{ borderColor: d.enabled ? '#E9D5FF' : '#F3F4F6', background: d.enabled ? 'rgba(139,92,246,0.03)' : '#FAFAFA' }}
                  >
                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleDay(day)}
                      className="relative flex-shrink-0 w-10 h-6 rounded-full transition-all duration-200"
                      style={{ background: d.enabled ? 'linear-gradient(to right, #8B5CF6, #06B6D4)' : '#D1D5DB' }}
                    >
                      <span
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
                        style={{ left: d.enabled ? '22px' : '2px' }}
                      />
                    </button>

                    {/* Day name */}
                    <span className="w-24 text-sm font-semibold text-gray-800 flex-shrink-0">{day}</span>

                    {/* Time inputs */}
                    {d.enabled ? (
                      <div className="flex items-center gap-2 ml-auto">
                        <input
                          type="time"
                          value={d.intervals[0]?.start ?? '08:00'}
                          onChange={e => updateInterval(day, 'start', e.target.value)}
                          className="h-8 rounded-lg border border-gray-200 px-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                        <span className="text-gray-400 text-xs">–</span>
                        <input
                          type="time"
                          value={d.intervals[0]?.end ?? '16:00'}
                          onChange={e => updateInterval(day, 'end', e.target.value)}
                          className="h-8 rounded-lg border border-gray-200 px-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                    ) : (
                      <span className="ml-auto text-xs text-gray-400 font-medium">Zaprto</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleBack}
              disabled={loading}
              className="flex-1 h-12 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Nazaj
            </button>
            <button
              onClick={handleNext}
              disabled={loading || !canAdvance()}
              className="flex-1 h-12 text-white font-semibold rounded-xl transition-all duration-300 hover:opacity-90 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(to right, #8B5CF6, #06B6D4)' }}
            >
              {loading
                ? 'Ustvarjam...'
                : step === TOTAL_STEPS - 1
                ? 'Ustvari'
                : 'Naprej'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
