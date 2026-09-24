import type { ReactNode } from 'react';
import '../../globals.css';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe';
import { loadUnsubscribeTargetCached } from './target';

// /unsubscribe/<token> is opened from a marketing email or SMS, outside the
// app: no auth, no company context, no locale prefix (proxy.ts skips it).
// Like /register, it needs its own <html>/<body> shell; the language is the
// client's.
export default async function UnsubscribeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const clientId = verifyUnsubscribeToken(token);
  const target = clientId ? await loadUnsubscribeTargetCached(clientId) : null;
  return (
    <html lang={target?.language ?? 'en'}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
