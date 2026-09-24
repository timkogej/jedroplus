import type { ReactNode } from 'react';
import '../../globals.css';
import { isLegalLang } from '@/lib/legal';

// /legal/<lang>/<doc> — public legal documents in five languages, outside
// the app's locale routing (the app UI has fewer languages than the texts).
// Like /register, it needs its own <html>/<body> shell.
export default async function LegalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <html lang={isLegalLang(lang) ? lang : 'en'}>
      <body className="antialiased bg-[#F7F8FA]">{children}</body>
    </html>
  );
}
