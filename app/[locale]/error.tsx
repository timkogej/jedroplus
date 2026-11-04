'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

// Shown when a page fails while rendering. Before this, the whole app was
// replaced by Next's bare English error text.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common.errorPage');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70dvh] items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="mt-2 text-[15px] text-gray-500">{t('body')}</p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(to right, #8B5CF6, #06B6D4)' }}
          >
            {t('retry')}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-6 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            {t('home')}
          </Link>
        </div>
      </div>
    </main>
  );
}
