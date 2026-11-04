import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { JedroLogo } from '@/components/brand/JedroLogo';

export default async function NotFoundPage() {
  const t = await getTranslations('common.notFound');
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        <JedroLogo height={28} className="mx-auto mb-10" title="Jedro+" />
        <p className="text-sm font-medium text-gray-400">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="mt-2 text-[15px] text-gray-500">{t('body')}</p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(to right, #8B5CF6, #06B6D4)' }}
        >
          {t('home')}
        </Link>
      </div>
    </main>
  );
}
