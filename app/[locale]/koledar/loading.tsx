// app/[locale]/koledar/loading.tsx
//
// Instant navigation fallback shown while the Koledar Server Component fetches.
// Reuses the exact spinner the client page already showed while company context
// resolved, so the perceived loading state is unchanged.

import { FullPageSpinner } from '@/components/ui/GradientSpinner';

export default function KoledarLoading() {
  return <FullPageSpinner />;
}
