'use client';

// Receptionist+ je zdaj na strani AI (/ai?ai=receptionist). Ta naslov ostane zaradi
// povezav v obvestilih, zaznamkov in vrnitve iz Stripa (?tab=krediti&checkout=…):
// preusmeri z istimi parametri.

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';

export default function ReceptionistPlusPage() {
  const router = useRouter();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('ai', 'receptionist');
    router.replace(`/ai?${params.toString()}`);
  }, [router]);
  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-white" />
    </ProtectedLayout>
  );
}
