import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  LEGAL_DOCS,
  LEGAL_FACTS,
  LEGAL_LANGS,
  LEGAL_REVIEWED,
  getLegalContent,
  isLegalDoc,
  isLegalLang,
  legalPath,
  type LegalBlock,
} from '@/lib/legal';

type Params = { lang: string; doc: string };

export function generateStaticParams(): Params[] {
  return LEGAL_LANGS.flatMap((lang) => LEGAL_DOCS.map((doc) => ({ lang, doc })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang, doc } = await params;
  if (!isLegalLang(lang) || !isLegalDoc(doc)) return {};
  const content = getLegalContent(lang).docs[doc];
  return { title: `${content.title} · Jedro+`, description: content.summary };
}

const LANG_NAMES: Record<string, string> = {
  sl: 'Slovenščina',
  en: 'English',
  de: 'Deutsch',
  hr: 'Hrvatski',
  it: 'Italiano',
};

/** Paragraphs, with consecutive "- " items grouped into one list. */
function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length === 0) return;
    out.push(
      <ul key={`ul-${out.length}`} className="my-3 list-disc space-y-1.5 pl-5">
        {list.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
    list = [];
  };
  for (const block of blocks) {
    if (block.startsWith('- ')) {
      list.push(block.slice(2));
    } else {
      flush();
      out.push(
        <p key={`p-${out.length}`} className="my-3">
          {block}
        </p>
      );
    }
  }
  flush();
  return <>{out}</>;
}

export default async function LegalDocPage({ params }: { params: Promise<Params> }) {
  const { lang, doc } = await params;
  if (!isLegalLang(lang) || !isLegalDoc(doc)) notFound();

  const { ui, docs } = getLegalContent(lang);
  const content = docs[doc];
  const effective = new Date(`${LEGAL_FACTS.effectiveDate}T12:00:00`).toLocaleDateString(
    lang === 'sl' ? 'sl-SI' : lang,
    { day: 'numeric', month: 'long', year: 'numeric' }
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-[#1A1F36]">Jedro+</span>
        <nav aria-label={ui.languageLabel} className="flex flex-wrap gap-1">
          {LEGAL_LANGS.map((code) => (
            <Link
              key={code}
              href={legalPath(doc, code)}
              hrefLang={code}
              aria-current={code === lang ? 'true' : undefined}
              className={`rounded-md px-2 py-1 ${
                code === lang ? 'bg-[#1A1F36] text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {LANG_NAMES[code]}
            </Link>
          ))}
        </nav>
      </div>

      <article className="rounded-2xl border border-gray-100 bg-white p-6 text-[15px] leading-7 text-gray-700 shadow-sm sm:p-10">
        {!LEGAL_REVIEWED && (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            {ui.draftBanner}
          </p>
        )}
        <h1 className="text-2xl font-bold text-[#1A1F36] sm:text-3xl">{content.title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {ui.lastUpdated} {effective}
        </p>
        <p className="mt-4 text-gray-600">{content.summary}</p>
        {ui.bindingNote && <p className="mt-2 text-sm italic text-gray-500">{ui.bindingNote}</p>}

        {content.sections.map((section) => (
          <section key={section.heading} className="mt-8">
            <h2 className="text-lg font-semibold text-[#1A1F36]">{section.heading}</h2>
            <Blocks blocks={section.blocks} />
          </section>
        ))}
      </article>

      <nav aria-label={ui.otherDocuments} className="mt-6 text-sm">
        <p className="mb-2 font-medium text-gray-500">{ui.otherDocuments}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {LEGAL_DOCS.filter((key) => key !== doc).map((key) => (
            <li key={key}>
              <Link href={legalPath(key, lang)} className="text-violet-600 hover:text-violet-700">
                {docs[key].title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
