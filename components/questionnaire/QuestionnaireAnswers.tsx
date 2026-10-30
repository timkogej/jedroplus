'use client';

import { ClipboardText } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { Answer } from '@/lib/questionnaire';

/**
 * The client's answers to the salon's questionnaire (online booking).
 * `bare` drops the heading, for places that already have their own label.
 */
export function QuestionnaireAnswers({ answers, bare = false }: { answers?: Answer[] | null; bare?: boolean }) {
  const t = useTranslations('common.questionnaire');
  if (!answers || answers.length === 0) return null;

  return (
    <div>
      {!bare && (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          <ClipboardText className="h-3.5 w-3.5" weight="bold" />
          {t('answersTitle')}
        </p>
      )}
      <dl className="space-y-2.5">
        {answers.map((a) => (
          <div key={a.id || a.vprasanje}>
            <dt className="text-[13px] text-gray-500">{a.vprasanje}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm font-medium text-gray-900">{a.odgovor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
