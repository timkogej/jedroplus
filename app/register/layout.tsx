import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import '../globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// /register/[slug] is the client self-registration link shared via SMS/email —
// always a fresh external page load, never client-side navigation from within
// the app. It sits outside app/[locale] (proxy.ts explicitly excludes it from
// locale routing) and is fully self-contained (own inline <style> block, no
// Tailwind, no auth/company context), so unlike LegacyRouteProviders it only
// needs the <html>/<body> shell — not the auth/NextIntlClientProvider wrappers.
// Without this, app/layout.tsx (the true root layout) renders no <html>/<body>
// at all, since that's normally provided by app/[locale]/layout.tsx.
export default function RegisterLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sl">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
