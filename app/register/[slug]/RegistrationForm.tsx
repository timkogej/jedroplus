'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Language = 'sl' | 'en' | 'sr' | 'hr'

interface Translations {
  firstName: string
  lastName: string
  email: string
  phone: string
  gender: string
  notes: string
  genderPlaceholder: string
  genderMale: string
  genderFemale: string
  genderPrefer: string
  gdprText: string
  marketingText: string
  submit: string
  submitting: string
  required: string
  invalidEmail: string
  invalidPhone: string
  gdprRequired: string
  genderRequired: string
  successHeading: string
  successSubtext: string
  networkError: string
  packageInvalidTitle: string
  packageInvalidSubtext: string
  loadingText1: string
  loadingText2: string
  notesPlaceholder: string
  optional: string
  formSubtitle: string
}

interface FormData {
  ime: string
  priimek: string
  email: string
  telefon: string
  spol: string
  opombe: string
  gdpr: boolean
  marketing_consent: boolean
}

type Phase = 'loading' | 'form' | 'success' | 'package_invalid'

interface Props {
  companyId: string
  slug: string
  brandPrimary: string
  brandSecond: string
  companyName: string
}

// ─── Translations ─────────────────────────────────────────────────────────────

const translations: Record<Language, Translations> = {
  sl: {
    firstName: 'Ime',
    lastName: 'Priimek',
    email: 'Email',
    phone: 'Telefon',
    gender: 'Spol',
    notes: 'Opombe',
    genderPlaceholder: 'Izberite spol',
    genderMale: 'Moški',
    genderFemale: 'Ženski',
    genderPrefer: 'Raje ne povem',
    gdprText: 'Strinjam se z obdelavo mojih osebnih podatkov v skladu z GDPR.',
    marketingText: 'Strinjam se s prejemanjem promocijskih sporočil (SMS, email).',
    submit: 'Registriraj se',
    submitting: 'Pošiljam...',
    required: 'To polje je obvezno',
    invalidEmail: 'Vnesite veljaven email naslov',
    invalidPhone: 'Vnesite veljavno telefonsko številko',
    gdprRequired: 'Strinjanje z GDPR je obvezno',
    genderRequired: 'Izberite spol',
    successHeading: 'Hvala, ker ste del naše zgodbe',
    successSubtext: 'Na vaš email naslov smo poslali potrditev. Veselimo se, da vas bomo kmalu spoznali.',
    networkError: 'Prišlo je do napake. Poskusite znova ali kontaktirajte podjetje.',
    packageInvalidTitle: 'Ta funkcija trenutno ni na voljo.',
    packageInvalidSubtext: 'Prosimo kontaktirajte podjetje za več informacij.',
    loadingText1: 'Pridružite se naši zgodbi',
    loadingText2: 'Dobrodošleni',
    notesPlaceholder: 'Morebitne opombe ali posebne zahteve...',
    optional: 'neobvezno',
    formSubtitle: 'Postanite del naše zgodbe — vnesite svoje podatke spodaj.',
  },
  en: {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    gender: 'Gender',
    notes: 'Notes',
    genderPlaceholder: 'Select gender',
    genderMale: 'Male',
    genderFemale: 'Female',
    genderPrefer: 'Prefer not to say',
    gdprText: 'I agree to the processing of my personal data in accordance with GDPR.',
    marketingText: 'I agree to receive promotional messages (SMS, email).',
    submit: 'Register',
    submitting: 'Sending...',
    required: 'This field is required',
    invalidEmail: 'Please enter a valid email address',
    invalidPhone: 'Please enter a valid phone number',
    gdprRequired: 'GDPR consent is required',
    genderRequired: 'Please select a gender',
    successHeading: 'Thank you for being part of our story',
    successSubtext: 'We have sent a confirmation to your email. We look forward to meeting you soon.',
    networkError: 'Something went wrong. Please try again or contact the business.',
    packageInvalidTitle: 'This feature is currently unavailable.',
    packageInvalidSubtext: 'Please contact the company for more information.',
    loadingText1: 'Join our story',
    loadingText2: 'Welcome',
    notesPlaceholder: 'Any notes or special requests...',
    optional: 'optional',
    formSubtitle: 'Become part of our story — enter your details below.',
  },
  sr: {
    firstName: 'Ime',
    lastName: 'Prezime',
    email: 'Email',
    phone: 'Telefon',
    gender: 'Pol',
    notes: 'Napomene',
    genderPlaceholder: 'Izaberite pol',
    genderMale: 'Muški',
    genderFemale: 'Ženski',
    genderPrefer: 'Radije ne kažem',
    gdprText: 'Slažem se sa obradom mojih ličnih podataka u skladu sa GDPR.',
    marketingText: 'Slažem se sa primanjem promotivnih poruka (SMS, email).',
    submit: 'Registruj se',
    submitting: 'Šaljem...',
    required: 'Ovo polje je obavezno',
    invalidEmail: 'Unesite važeću email adresu',
    invalidPhone: 'Unesite valjan broj telefona',
    gdprRequired: 'Pristanak na GDPR je obavezan',
    genderRequired: 'Izaberite pol',
    successHeading: 'Hvala što ste deo naše priče',
    successSubtext: 'Poslali smo potvrdu na vašu email adresu. Radujemo se susretu sa vama.',
    networkError: 'Došlo je do greške. Pokušajte ponovo ili kontaktirajte preduzeće.',
    packageInvalidTitle: 'Ova funkcija trenutno nije dostupna.',
    packageInvalidSubtext: 'Molimo kontaktirajte kompaniju za više informacija.',
    loadingText1: 'Pridružite se našoj priči',
    loadingText2: 'Dobrodošli',
    notesPlaceholder: 'Eventualne napomene ili posebni zahtevi...',
    optional: 'opciono',
    formSubtitle: 'Postanite deo naše priče — unesite svoje podatke ispod.',
  },
  hr: {
    firstName: 'Ime',
    lastName: 'Prezime',
    email: 'Email',
    phone: 'Telefon',
    gender: 'Spol',
    notes: 'Napomene',
    genderPlaceholder: 'Odaberite spol',
    genderMale: 'Muški',
    genderFemale: 'Ženski',
    genderPrefer: 'Radije ne kažem',
    gdprText: 'Slažem se s obradom mojih osobnih podataka u skladu s GDPR-om.',
    marketingText: 'Slažem se s primanjem promotivnih poruka (SMS, email).',
    submit: 'Registriraj se',
    submitting: 'Šaljem...',
    required: 'Ovo polje je obavezno',
    invalidEmail: 'Unesite valjanu email adresu',
    invalidPhone: 'Unesite valjani broj telefona',
    gdprRequired: 'Pristanak na GDPR je obavezan',
    genderRequired: 'Odaberite spol',
    successHeading: 'Hvala što ste dio naše priče',
    successSubtext: 'Poslali smo potvrdu na vašu email adresu. Veselimo se susretu s vama.',
    networkError: 'Došlo je do pogreške. Pokušajte ponovo ili kontaktirajte tvrtku.',
    packageInvalidTitle: 'Ova funkcija trenutno nije dostupna.',
    packageInvalidSubtext: 'Molimo kontaktirajte tvrtku za više informacija.',
    loadingText1: 'Pridružite se našoj priči',
    loadingText2: 'Dobrodošli',
    notesPlaceholder: 'Eventualne napomene ili posebni zahtevi...',
    optional: 'nije obavezno',
    formSubtitle: 'Postanite dio naše priče — unesite svoje podatke ispod.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en'
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('sl')) return 'sl'
  if (lang.startsWith('sr')) return 'sr'
  if (lang.startsWith('hr')) return 'hr'
  return 'en'
}

const LOADING_DURATION = 2500
const N8N_WEBHOOK = '/api/register'

// ─── Language options ─────────────────────────────────────────────────────────

const languageOptions: { code: Language; flag: string; name: string }[] = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'sl', flag: '🇸🇮', name: 'Slovenščina' },
  { code: 'sr', flag: '🇷🇸', name: 'Srpski' },
  { code: 'hr', flag: '🇭🇷', name: 'Hrvatski' },
]

// ─── LanguageDropdown ─────────────────────────────────────────────────────────

function LanguageDropdown({
  lang,
  setLang,
}: {
  lang: Language
  setLang: (l: Language) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = languageOptions.find(o => o.code === lang)!

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.5rem 0.875rem',
          borderRadius: '9999px',
          border: '1px solid rgba(0,0,0,0.08)',
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: '#374151',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: '1rem', lineHeight: 1 }}>{current.flag}</span>
        <span>{lang.toUpperCase()}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', alignItems: 'center', opacity: 0.4, lineHeight: 1 }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              background: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              minWidth: '160px',
              zIndex: 100,
            }}
          >
            {languageOptions.map(opt => (
              <button
                key={opt.code}
                type="button"
                onClick={() => { setLang(opt.code); setOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  background: opt.code === lang ? 'rgba(0,0,0,0.04)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: '#374151',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  fontWeight: opt.code === lang ? 500 : 400,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  if (opt.code !== lang) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.03)'
                }}
                onMouseLeave={e => {
                  if (opt.code !== lang) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: '1.125rem' }}>{opt.flag}</span>
                <span>{opt.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── FloatingField ────────────────────────────────────────────────────────────

function FloatingField({
  label,
  required = false,
  error,
  value,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  value: string
  children: (
    handlers: { onFocus: () => void; onBlur: () => void },
    focused: boolean,
  ) => React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  const float = focused || value.length > 0

  return (
    <div style={{ position: 'relative', paddingTop: '1.375rem' }}>
      <span
        style={{
          position: 'absolute',
          top: float ? '0px' : '1.5rem',
          left: 0,
          fontSize: float ? '0.6875rem' : '0.9375rem',
          color: focused ? 'var(--color-primary)' : float ? '#888888' : '#AAAAAA',
          fontWeight: float ? 500 : 300,
          transition: 'top 0.2s ease, font-size 0.2s ease, color 0.2s ease',
          pointerEvents: 'none',
          lineHeight: 1.25,
          userSelect: 'none',
        }}
      >
        {label}
        {required && <span style={{ color: '#EF4444' }}> *</span>}
      </span>

      {children(
        { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
        focused,
      )}

      <div style={{ position: 'relative', height: '1px' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: error ? '#EF4444' : '#E8E8E8',
          }}
        />
        <motion.div
          animate={{ scaleX: focused ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            height: '2px',
            top: '-0.5px',
            background:
              'linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
            transformOrigin: 'left center',
          }}
        />
      </div>

      {error && (
        <p
          style={{
            fontSize: '0.6875rem',
            color: '#EF4444',
            marginTop: '0.375rem',
            lineHeight: 1.4,
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}

// ─── CustomCheckbox ───────────────────────────────────────────────────────────

function CustomCheckbox({ checked }: { checked: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: '20px',
        height: '20px',
        minWidth: '20px',
        borderRadius: '6px',
        border: checked ? 'none' : '1.5px solid rgba(0,0,0,0.18)',
        background: checked
          ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))'
          : '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        marginTop: '0.125rem',
        flexShrink: 0,
        pointerEvents: 'none',
      }}
    >
      <motion.div
        initial={false}
        animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path
            d="M2 5.5L4.5 8L9 3"
            stroke="white"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegistrationForm({
  companyId,
  slug,
  brandPrimary,
  brandSecond,
  companyName,
}: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [lang, setLang] = useState<Language>('en')
  const [displayedChars, setDisplayedChars] = useState(0)
  const [typewriterDone, setTypewriterDone] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    ime: '',
    priimek: '',
    email: '',
    telefon: '',
    spol: '',
    opombe: '',
    gdpr: false,
    marketing_consent: false,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const t = translations[lang]
  const primaryGradient = `linear-gradient(135deg, ${brandPrimary} 0%, ${brandSecond} 100%)`
  const textGradient = `linear-gradient(90deg, ${brandPrimary} 0%, #4F8DF7 50%, ${brandSecond} 100%)`

  // Detect browser language on mount
  useEffect(() => {
    setLang(detectLanguage())
  }, [])

  // Minimum 2.5s loading screen
  useEffect(() => {
    const timer = setTimeout(() => setPhase('form'), LOADING_DURATION)
    return () => clearTimeout(timer)
  }, [])

  // Typewriter — restarts if language changes during loading
  useEffect(() => {
    if (phase !== 'loading') return
    const target = translations[lang].loadingText1
    setDisplayedChars(0)
    setTypewriterDone(false)
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayedChars(i)
      if (i >= target.length) {
        setTypewriterDone(true)
        clearInterval(interval)
      }
    }, 70)
    return () => clearInterval(interval)
  }, [phase, lang])

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const next: Partial<Record<keyof FormData, string>> = {}

    if (!formData.ime.trim()) next.ime = t.required
    if (!formData.priimek.trim()) next.priimek = t.required

    if (!formData.email.trim()) {
      next.email = t.required
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      next.email = t.invalidEmail
    }

    if (!formData.telefon.trim()) {
      next.telefon = t.required
    } else if (!/^[\d\s+\-().]{6,20}$/.test(formData.telefon.trim())) {
      next.telefon = t.invalidPhone
    }

    if (!formData.spol) next.spol = t.genderRequired
    if (!formData.gdpr) next.gdpr = t.gdprRequired

    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, slug, ...formData }),
      })

      const body = await res.json().catch(() => ({})) as { success?: boolean; error?: string }

      if (res.status === 200 && body.success === true) {
        setPhase('success')
        return
      }

      if (res.status === 403 && body.error === 'no_package') {
        setPhase('package_invalid')
        return
      }

      throw new Error('Unexpected response')
    } catch {
      setSubmitError(t.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Field helpers ────────────────────────────────────────────────────────────

  function handleChange(field: keyof FormData, value: string | boolean) {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={
        {
          '--color-primary': brandPrimary,
          '--color-secondary': brandSecond,
        } as React.CSSProperties
      }
    >
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes blobDrift1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%  { transform: translate(24px, -18px) scale(1.04); }
          66%  { transform: translate(-12px, 22px) scale(0.96); }
        }
        @keyframes blobDrift2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%  { transform: translate(-20px, 14px) scale(1.06); }
          66%  { transform: translate(18px, -20px) scale(0.97); }
        }
        @keyframes blobDrift3 {
          0%, 100% { transform: translate(-50%, 0) scale(1); }
          50%  { transform: translate(-50%, -16px) scale(1.03); }
        }
        .blob1 { animation: blobDrift1 14s ease-in-out infinite; }
        .blob2 { animation: blobDrift2 18s ease-in-out infinite; }
        .blob3 { animation: blobDrift3 22s ease-in-out infinite; }
        .cursor-blink { animation: blink 0.8s ease-in-out infinite; }
        .reg-submit-btn {
          background: ${primaryGradient};
          transition: box-shadow 0.2s ease, transform 0.15s ease;
        }
        .reg-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px) scale(1.005);
          box-shadow: 0 8px 28px ${brandPrimary}50, 0 0 0 4px ${brandPrimary}20;
        }
        .reg-submit-btn:active:not(:disabled) {
          transform: translateY(0) scale(1);
        }
        .reg-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .reg-accent-top {
          height: 2px;
          background: ${primaryGradient};
        }
        .reg-gender-chip {
          transition: all 0.2s ease;
        }
        .reg-gender-chip:hover {
          background: rgba(0,0,0,0.04) !important;
        }
        .reg-checkbox-row {
          transition: background 0.15s ease;
        }
        .reg-checkbox-row:focus-visible {
          outline: 2px solid ${brandPrimary};
          outline-offset: 2px;
        }
      `}</style>

      {/* ── Loading Screen ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'loading' && (
          <motion.div
            style={{
              position: 'fixed',
              inset: 0,
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <div
              style={{
                textAlign: 'center',
                padding: '0 2rem',
                userSelect: 'none',
                maxWidth: '600px',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-serif, "Playfair Display", Georgia, serif)',
                  fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                  fontWeight: 400,
                  fontStyle: 'italic',
                  lineHeight: 1.25,
                  background: textGradient,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                  letterSpacing: '-0.01em',
                  minHeight: '1.4em',
                  margin: 0,
                }}
              >
                {t.loadingText1.slice(0, displayedChars)}
                {typewriterDone && (
                  <span
                    className="cursor-blink"
                    style={{
                      WebkitTextFillColor: brandPrimary,
                      color: brandPrimary,
                      fontStyle: 'normal',
                      fontWeight: 300,
                      marginLeft: '2px',
                    }}
                  >
                    |
                  </span>
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Success Screen ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'success' && (
          <motion.div
            style={{
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ffffff',
              padding: '1.5rem',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div style={{ textAlign: 'center', maxWidth: '380px' }}>
              {/* Gradient checkmark */}
              <motion.div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: primaryGradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 2rem',
                  boxShadow: `0 8px 32px ${brandPrimary}40`,
                }}
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.path
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.55, delay: 0.3, ease: 'easeOut' }}
                  />
                </svg>
              </motion.div>

              <motion.h1
                style={{
                  fontFamily: 'var(--font-serif, "Playfair Display", Georgia, serif)',
                  fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                  fontWeight: 500,
                  lineHeight: 1.3,
                  marginBottom: '0.875rem',
                  background: textGradient,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                }}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.45 }}
              >
                {t.successHeading}
              </motion.h1>

              <motion.p
                style={{
                  color: '#6B7280',
                  fontSize: '0.9375rem',
                  lineHeight: 1.65,
                  marginBottom: '1.5rem',
                  fontWeight: 300,
                }}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.45 }}
              >
                {t.successSubtext}
              </motion.p>

              <motion.p
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: brandPrimary,
                  fontFamily: 'var(--font-serif, "Playfair Display", Georgia, serif)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
              >
                {companyName}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Package Invalid Screen ────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'package_invalid' && (
          <motion.div
            style={{
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ffffff',
              padding: '1.5rem',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div style={{ textAlign: 'center', maxWidth: '360px' }}>
              <div
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: '#FFFBEB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  border: '1px solid #FEF3C7',
                }}
              >
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-serif, "Playfair Display", Georgia, serif)',
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  color: '#111827',
                  marginBottom: '0.625rem',
                }}
              >
                {t.packageInvalidTitle}
              </h2>
              <p
                style={{
                  color: '#6B7280',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  fontWeight: 300,
                }}
              >
                {t.packageInvalidSubtext}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Form Page ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'form' && (
          <motion.div
            style={{
              minHeight: '100vh',
              background: '#ffffff',
              position: 'relative',
              overflow: 'hidden',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45 }}
          >
            {/* Aurora blobs */}
            <div
              className="blob1"
              style={{
                position: 'fixed',
                top: '-15%',
                left: '-10%',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                background: brandPrimary,
                opacity: 0.12,
                filter: 'blur(120px)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            <div
              className="blob2"
              style={{
                position: 'fixed',
                bottom: '-15%',
                right: '-10%',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                background: brandSecond,
                opacity: 0.12,
                filter: 'blur(120px)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            <div
              className="blob3"
              style={{
                position: 'fixed',
                top: '45%',
                left: '50%',
                width: '300px',
                height: '300px',
                borderRadius: '50%',
                background: brandPrimary,
                opacity: 0.06,
                filter: 'blur(80px)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />

            {/* Header */}
            <header
              style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}
            >
              <div className="reg-accent-top" />
              <div
                style={{
                  maxWidth: '560px',
                  margin: '0 auto',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h1
                    style={{
                      fontFamily:
                        'var(--font-serif, "Playfair Display", Georgia, serif)',
                      fontSize: 'clamp(1.125rem, 3vw, 1.5rem)',
                      fontWeight: 500,
                      color: '#111827',
                      margin: 0,
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {companyName}
                  </h1>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: '#9CA3AF',
                      fontWeight: 300,
                      marginTop: '0.2rem',
                      lineHeight: 1.4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {t.formSubtitle}
                  </p>
                </div>

                <LanguageDropdown lang={lang} setLang={setLang} />
              </div>
            </header>

            {/* Form card */}
            <main
              style={{
                maxWidth: '560px',
                margin: '0 auto',
                padding: '2rem 1.25rem 3rem',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <motion.form
                onSubmit={handleSubmit}
                style={{
                  background: 'rgba(255,255,255,0.72)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  borderRadius: '24px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  boxShadow: `
                    0 1px 2px rgba(0,0,0,0.04),
                    0 8px 24px rgba(0,0,0,0.06),
                    0 32px 64px ${brandPrimary}12
                  `,
                  padding: 'clamp(1.5rem, 5vw, 2.5rem)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                }}
                initial={{ opacity: 0, y: 28, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                noValidate
              >
                {/* ── Ime ──────────────────────────────────────────────── */}
                <FloatingField
                  label={t.firstName}
                  required
                  value={formData.ime}
                  error={errors.ime}
                >
                  {handlers => (
                    <input
                      type="text"
                      autoComplete="given-name"
                      value={formData.ime}
                      onChange={e => handleChange('ime', e.target.value)}
                      style={inputStyle}
                      {...handlers}
                    />
                  )}
                </FloatingField>

                {/* ── Priimek ──────────────────────────────────────────── */}
                <FloatingField
                  label={t.lastName}
                  required
                  value={formData.priimek}
                  error={errors.priimek}
                >
                  {handlers => (
                    <input
                      type="text"
                      autoComplete="family-name"
                      value={formData.priimek}
                      onChange={e => handleChange('priimek', e.target.value)}
                      style={inputStyle}
                      {...handlers}
                    />
                  )}
                </FloatingField>

                {/* ── Email ─────────────────────────────────────────────── */}
                <FloatingField
                  label={t.email}
                  required
                  value={formData.email}
                  error={errors.email}
                >
                  {handlers => (
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={formData.email}
                      onChange={e => handleChange('email', e.target.value)}
                      style={inputStyle}
                      {...handlers}
                    />
                  )}
                </FloatingField>

                {/* ── Telefon ──────────────────────────────────────────── */}
                <FloatingField
                  label={t.phone}
                  required
                  value={formData.telefon}
                  error={errors.telefon}
                >
                  {handlers => (
                    <input
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      value={formData.telefon}
                      onChange={e => handleChange('telefon', e.target.value)}
                      style={inputStyle}
                      {...handlers}
                    />
                  )}
                </FloatingField>

                {/* ── Spol — pill chips ─────────────────────────────────── */}
                <div>
                  <p
                    style={{
                      fontSize: '0.6875rem',
                      color: '#888888',
                      fontWeight: 500,
                      marginBottom: '0.625rem',
                      lineHeight: 1.25,
                    }}
                  >
                    {t.gender} <span style={{ color: '#EF4444' }}>*</span>
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[
                      { value: 'moski', label: t.genderMale },
                      { value: 'zenski', label: t.genderFemale },
                      { value: 'prefer_not', label: t.genderPrefer },
                    ].map(({ value, label }) => {
                      const selected = formData.spol === value
                      return (
                        <button
                          key={value}
                          type="button"
                          className="reg-gender-chip"
                          onClick={() => handleChange('spol', value)}
                          style={{
                            flex: 1,
                            padding: '0.5625rem 0.25rem',
                            borderRadius: '9999px',
                            border: selected ? 'none' : '1px solid rgba(0,0,0,0.1)',
                            background: selected
                              ? `linear-gradient(135deg, ${brandPrimary}, ${brandSecond})`
                              : 'rgba(0,0,0,0.01)',
                            color: selected ? '#ffffff' : '#888888',
                            fontSize: '0.8125rem',
                            fontWeight: selected ? 500 : 400,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {errors.spol && (
                    <p
                      style={{
                        fontSize: '0.6875rem',
                        color: '#EF4444',
                        marginTop: '0.375rem',
                      }}
                    >
                      {errors.spol}
                    </p>
                  )}
                </div>

                {/* ── Opombe ───────────────────────────────────────────── */}
                <FloatingField
                  label={`${t.notes} (${t.optional})`}
                  value={formData.opombe}
                >
                  {handlers => (
                    <textarea
                      value={formData.opombe}
                      onChange={e => handleChange('opombe', e.target.value)}
                      rows={3}
                      style={{
                        ...inputStyle,
                        resize: 'vertical',
                        minHeight: '72px',
                      }}
                      {...handlers}
                    />
                  )}
                </FloatingField>

                {/* ── GDPR ─────────────────────────────────────────────── */}
                <div>
                  <div
                    role="checkbox"
                    aria-checked={formData.gdpr}
                    tabIndex={0}
                    className="reg-checkbox-row"
                    onClick={() => handleChange('gdpr', !formData.gdpr)}
                    onKeyDown={e => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault()
                        handleChange('gdpr', !formData.gdpr)
                      }
                    }}
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      cursor: 'pointer',
                      padding: '0.75rem',
                      borderRadius: '0.75rem',
                      background: errors.gdpr ? '#FEF2F2' : 'transparent',
                      alignItems: 'flex-start',
                      outline: 'none',
                    }}
                  >
                    <CustomCheckbox checked={formData.gdpr} />
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        color: '#555555',
                        lineHeight: 1.55,
                        fontWeight: 300,
                      }}
                    >
                      {t.gdprText}
                    </span>
                  </div>
                  {errors.gdpr && (
                    <p
                      style={{
                        fontSize: '0.6875rem',
                        color: '#EF4444',
                        marginTop: '0.25rem',
                        marginLeft: '0.75rem',
                      }}
                    >
                      {errors.gdpr}
                    </p>
                  )}
                </div>

                {/* ── Marketing ────────────────────────────────────────── */}
                <div
                  role="checkbox"
                  aria-checked={formData.marketing_consent}
                  tabIndex={0}
                  className="reg-checkbox-row"
                  onClick={() =>
                    handleChange('marketing_consent', !formData.marketing_consent)
                  }
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      handleChange('marketing_consent', !formData.marketing_consent)
                    }
                  }}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    alignItems: 'flex-start',
                    outline: 'none',
                  }}
                >
                  <CustomCheckbox checked={formData.marketing_consent} />
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: '#555555',
                      lineHeight: 1.55,
                      fontWeight: 300,
                    }}
                  >
                    {t.marketingText}
                  </span>
                </div>

                {/* ── Submit error ─────────────────────────────────────── */}
                {submitError && (
                  <div
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '0.75rem',
                      padding: '0.875rem 1rem',
                      fontSize: '0.875rem',
                      color: '#DC2626',
                    }}
                  >
                    {submitError}
                  </div>
                )}

                {/* ── Submit button ────────────────────────────────────── */}
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  className="reg-submit-btn"
                  style={{
                    width: '100%',
                    padding: '1rem 1.5rem',
                    color: 'white',
                    fontWeight: 500,
                    fontSize: '1rem',
                    letterSpacing: '0.02em',
                    borderRadius: '14px',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    marginTop: '0.5rem',
                    fontFamily: 'inherit',
                  }}
                  whileTap={isSubmitting ? {} : { scale: 0.985 }}
                >
                  {isSubmitting && (
                    <motion.svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </motion.svg>
                  )}
                  {isSubmitting ? t.submitting : t.submit}
                </motion.button>
              </motion.form>
            </main>

            <footer
              style={{
                textAlign: 'center',
                padding: '1.25rem 1rem 2rem',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 300 }}>
                Powered by{' '}
                <a
                  href="https://jedroplus.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontWeight: 500,
                    background: 'linear-gradient(90deg, #7C3AED, #3B82F6, #06B6D4)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                    textDecoration: 'none',
                  }}
                >
                  Jedro+
                </a>
              </span>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Style constants ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  padding: '0.5rem 0 0.375rem',
  fontSize: '0.9375rem',
  color: '#111827',
  fontFamily: 'inherit',
  lineHeight: 1.5,
}
