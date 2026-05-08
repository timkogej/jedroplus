import { createClient } from '@supabase/supabase-js'
import RegistrationForm from './RegistrationForm'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface PageProps {
  params: Promise<{ slug: string }>
}

function InvalidLinkPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        padding: '1rem',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '360px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: '#F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: '#111827',
            lineHeight: 1.6,
            marginBottom: '0.75rem',
          }}
        >
          Ta povezava ni veljavna.
          <br />
          This link is not valid.
          <br />
          Ova veza nije ispravna.
        </h1>

        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
          Preverite QR kodo ali kontaktirajte podjetje.
        </p>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default async function RegisterSlugPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = createAdminClient()

  // Step 1: Find company by slug
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('company_id')
    .eq('slug', slug)
    .single()

  console.log('[register] slug:', slug)
  console.log('[register] company:', company, 'error:', companyError)

  if (companyError || !company) {
    return <InvalidLinkPage />
  }

  // Step 2: Get branding from "Podatki podjetij"
  const { data: branding, error: brandingError } = await supabase
    .from('Podatki podjetij')
    .select('*')
    .eq('ID Podjetja', company.company_id)
    .single()

  console.log('[register] branding keys:', branding ? Object.keys(branding) : null)
  console.log('[register] branding:', branding, 'error:', brandingError)

  if (brandingError || !branding) {
    return <InvalidLinkPage />
  }

  const raw = branding as Record<string, string>

  return (
    <RegistrationForm
      companyId={company.company_id}
      slug={slug}
      brandPrimary={raw.brand_primary || '#1A1F36'}
      brandSecond={raw.brand_second || '#6366F1'}
      companyName={raw['Ime podjetja'] || ''}
    />
  )
}
