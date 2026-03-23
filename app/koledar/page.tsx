'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import Calendar from '@/components/Calendar';
import { useUserPersonId } from '@/hooks/useUserPersonId';

export default function KoledarPage() {
  const router = useRouter();
  const { companyId, loading } = useCompany();
  const { user } = useAuth();
  const userPersonId = useUserPersonId(user?.id);

  // Redirect to company selection if no company is selected
  useEffect(() => {
    if (loading) return;
    if (!companyId) {
      router.replace('/onboarding');
    }
  }, [companyId, loading, router]);

  // Show nothing while loading or redirecting - white background with simple black spinner
  if (loading || !companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
      </div>
    );
  }

  return (
    <ProtectedLayout>
      {/* Fixed height layout - calendar content scrolls within the available space */}
      {/* 4rem = 64px for the app bar */}
      <div className="h-[calc(100vh-4rem)] overflow-hidden">
        <Calendar companyId={companyId} initialEmployeeId={userPersonId} />
      </div>
    </ProtectedLayout>
  );
}
