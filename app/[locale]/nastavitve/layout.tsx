'use client';

import ProtectedLayout from '@/components/ProtectedLayout';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout>
      {/* Bela podlaga brez okrasnega sija — vsebina v ozkem stolpcu,
          kot vsebinski stolpec v macOS Nastavitvah. */}
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-2xl px-4 py-7 sm:px-6 sm:py-9">
          {children}
        </div>
      </div>
    </ProtectedLayout>
  );
}
