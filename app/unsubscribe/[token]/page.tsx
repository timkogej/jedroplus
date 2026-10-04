import type { Metadata } from 'next';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe';
import type { IsoLanguageCode } from '@/lib/communicationLanguage';
import { loadUnsubscribeTargetCached } from './target';

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Copy = {
  title: string;
  body: (company: string) => string;
  button: string;
  doneTitle: string;
  doneBody: (company: string) => string;
  invalid: string;
  error: string;
  note: string;
};

// The client's language, not the company's — this page belongs to them.
const COPY: Record<IsoLanguageCode, Copy> = {
  sl: {
    title: 'Odjava od obvestil',
    body: (c) => `Ne želite več prejemati novic in ponudb${c ? ` podjetja ${c}` : ''}?`,
    button: 'Odjavi me',
    doneTitle: 'Odjavljeni ste',
    doneBody: (c) => `Novic in ponudb${c ? ` podjetja ${c}` : ''} ne boste več prejemali.`,
    invalid: 'Ta povezava za odjavo ni veljavna.',
    error: 'Odjava ni uspela. Poskusite znova čez nekaj trenutkov.',
    note: 'Opomnike za vaše termine boste še vedno prejemali.',
  },
  en: {
    title: 'Unsubscribe',
    body: (c) => `Stop receiving news and offers${c ? ` from ${c}` : ''}?`,
    button: 'Unsubscribe',
    doneTitle: "You're unsubscribed",
    doneBody: (c) => `You won't receive news and offers${c ? ` from ${c}` : ''} any more.`,
    invalid: 'This unsubscribe link is not valid.',
    error: "Couldn't unsubscribe you. Please try again in a moment.",
    note: "You'll still get reminders about your appointments.",
  },
  de: {
    title: 'Abmelden',
    body: (c) => `Keine Neuigkeiten und Angebote${c ? ` von ${c}` : ''} mehr erhalten?`,
    button: 'Abmelden',
    doneTitle: 'Sie sind abgemeldet',
    doneBody: (c) => `Sie erhalten keine Neuigkeiten und Angebote${c ? ` von ${c}` : ''} mehr.`,
    invalid: 'Dieser Abmeldelink ist ungültig.',
    error: 'Die Abmeldung ist fehlgeschlagen. Bitte versuchen Sie es gleich noch einmal.',
    note: 'Erinnerungen an Ihre Termine erhalten Sie weiterhin.',
  },
  hr: {
    title: 'Odjava od obavijesti',
    body: (c) => `Ne želite više primati novosti i ponude${c ? ` tvrtke ${c}` : ''}?`,
    button: 'Odjavi me',
    doneTitle: 'Odjavljeni ste',
    doneBody: (c) => `Više nećete primati novosti i ponude${c ? ` tvrtke ${c}` : ''}.`,
    invalid: 'Ova poveznica za odjavu nije valjana.',
    error: 'Odjava nije uspjela. Pokušajte ponovno za nekoliko trenutaka.',
    note: 'Podsjetnike za svoje termine i dalje ćete primati.',
  },
  it: {
    title: 'Annulla iscrizione',
    body: (c) => `Non vuoi più ricevere novità e offerte${c ? ` da ${c}` : ''}?`,
    button: 'Annulla iscrizione',
    doneTitle: 'Iscrizione annullata',
    doneBody: (c) => `Non riceverai più novità e offerte${c ? ` da ${c}` : ''}.`,
    invalid: 'Questo link di disiscrizione non è valido.',
    error: "Non è stato possibile annullare l'iscrizione. Riprova tra poco.",
    note: 'Continuerai a ricevere i promemoria dei tuoi appuntamenti.',
  },
};

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { token } = await params;
  const { done, error } = await searchParams;

  const clientId = verifyUnsubscribeToken(token);
  const target = clientId ? await loadUnsubscribeTargetCached(clientId) : null;
  const copy = COPY[target?.language ?? 'en'];
  const company = target?.companyName ?? '';
  const isDone = Boolean(target && (done || target.alreadyOut));

  return (
    <main className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-sm text-center">
        {!target ? (
          <p className="text-sm text-gray-600">{copy.invalid}</p>
        ) : isDone ? (
          <>
            <h1 className="text-xl font-semibold text-[#1A1F36]">{copy.doneTitle}</h1>
            <p className="mt-3 text-sm text-gray-600">{copy.doneBody(company)}</p>
            <p className="mt-4 text-xs text-gray-400">{copy.note}</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-[#1A1F36]">{copy.title}</h1>
            <p className="mt-3 text-sm text-gray-600">{copy.body(company)}</p>
            {error && <p className="mt-3 text-sm text-red-600">{copy.error}</p>}
            <form method="post" action={`/api/unsubscribe/${token}?from=page`} className="mt-6">
              <button
                type="submit"
                className="w-full rounded-xl bg-[#1A1F36] px-4 py-3 text-sm font-medium text-white hover:bg-black transition-colors"
              >
                {copy.button}
              </button>
            </form>
            <p className="mt-4 text-xs text-gray-400">{copy.note}</p>
          </>
        )}
      </div>
    </main>
  );
}
