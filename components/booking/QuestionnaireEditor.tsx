'use client';

// Editor for "Vprašalnik pred terminom": the questions clients answer when
// they book online. Lives in Nastavitve rezervacij; the modal saves the list
// with the rest of the settings (PATCH /api/company/questionnaire).

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  ListChecks,
  Plus,
  TextAa,
  ToggleRight,
  Trash,
  X,
} from '@phosphor-icons/react';
import { SegmentedControl, Switch } from '@/components/settings';
import { MAX_OPTIONS, MAX_QUESTIONS, newQuestionId, type Question, type QuestionType } from '@/lib/questionnaire';

interface ServiceOption {
  id: string;
  naziv: string;
}

interface QuestionnaireEditorProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  services: ServiceOption[];
}

const TYPE_ICON: Record<QuestionType, typeof TextAa> = {
  besedilo: TextAa,
  da_ne: ToggleRight,
  izbira: ListChecks,
};

const inputClass =
  'w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2.5 text-[15px] text-gray-900 placeholder-gray-400 transition-colors focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25';

export function QuestionnaireEditor({ questions, onChange, services }: QuestionnaireEditorProps) {
  const t = useTranslations('reservations.modal.questionnaire');
  const [openId, setOpenId] = useState<string | null>(null);

  // A question that was just removed must not stay "open".
  useEffect(() => {
    if (openId && !questions.some((q) => q.id === openId)) setOpenId(null);
  }, [questions, openId]);

  const update = (id: string, patch: Partial<Question>) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const add = (preset?: Partial<Question>) => {
    if (questions.length >= MAX_QUESTIONS) return;
    const q: Question = { id: newQuestionId(), vprasanje: '', tip: 'besedilo', obvezno: false, storitve: [], ...preset };
    onChange([...questions, q]);
    setOpenId(q.id);
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...questions];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const presets: Partial<Question>[] = [
    { vprasanje: t('presets.allergies'), tip: 'da_ne', obvezno: true },
    { vprasanje: t('presets.firstVisit'), tip: 'da_ne' },
    { vprasanje: t('presets.wishes'), tip: 'besedilo' },
  ];

  return (
    <div className="space-y-3 py-2">
      {questions.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center">
          <p className="text-sm text-gray-600">{t('empty')}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {presets.map((p) => (
              <button
                key={p.vprasanje}
                type="button"
                onClick={() => add(p)}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-gray-800 transition-colors hover:border-[#7C78FA]/50 hover:bg-[#7C78FA]/5"
              >
                <Plus className="h-3.5 w-3.5 text-[#7C78FA]" weight="bold" />
                {p.vprasanje}
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {questions.map((q, index) => (
          <motion.div
            key={q.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <QuestionRow
              q={q}
              index={index}
              count={questions.length}
              open={openId === q.id}
              onToggle={() => setOpenId(openId === q.id ? null : q.id)}
              onMove={(dir) => move(index, dir)}
              onRemove={() => onChange(questions.filter((x) => x.id !== q.id))}
              onChange={(patch) => update(q.id, patch)}
              services={services}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {questions.length > 0 && questions.length < MAX_QUESTIONS && (
        <button
          type="button"
          onClick={() => add()}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" weight="bold" />
          {t('add')}
        </button>
      )}
      {questions.length === 0 && (
        <button
          type="button"
          onClick={() => add()}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] px-1 text-sm font-medium text-[#5B57E8] hover:underline"
        >
          <Plus className="h-4 w-4" weight="bold" />
          {t('addOwn')}
        </button>
      )}
      {questions.length >= MAX_QUESTIONS && <p className="text-xs text-gray-500">{t('max', { max: MAX_QUESTIONS })}</p>}
    </div>
  );
}

function QuestionRow({
  q,
  index,
  count,
  open,
  onToggle,
  onMove,
  onRemove,
  onChange,
  services,
}: {
  q: Question;
  index: number;
  count: number;
  open: boolean;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onChange: (patch: Partial<Question>) => void;
  services: ServiceOption[];
}) {
  const t = useTranslations('reservations.modal.questionnaire');
  const [showEn, setShowEn] = useState(Boolean(q.vprasanje_en));
  const Icon = TYPE_ICON[q.tip];
  const options = q.moznosti ?? [];
  const optionsEn = q.moznosti_en ?? [];
  const forAll = q.storitve.length === 0;
  const invalid = !q.vprasanje.trim() || (q.tip === 'izbira' && options.filter((o) => o.trim()).length < 2);

  const setType = (tip: QuestionType) =>
    onChange(tip === 'izbira' && options.length === 0 ? { tip, moznosti: ['', ''] } : { tip });

  const scope = forAll
    ? t('scopeAll')
    : t('scopeSome', { count: q.storitve.filter((id) => services.some((s) => s.id === id)).length });

  return (
    <div>
      {/* Summary row */}
      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#7C78FA]/10 text-[#5B57E8]">
          <Icon className="h-4 w-4" weight="bold" />
        </span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <p className={`truncate text-[15px] font-medium ${q.vprasanje.trim() ? 'text-gray-900' : 'text-gray-400'}`}>
            {q.vprasanje.trim() || t('untitled')}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {t(`types.${q.tip}`)} · {q.obvezno ? t('required') : t('optional')} · {scope}
            {invalid && <span className="text-amber-600"> · {t('incomplete')}</span>}
          </p>
        </button>
        <div className="flex flex-shrink-0 items-center">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={t('moveUp')}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label={t('moveDown')}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={t('edit')}
            aria-expanded={open}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <CaretDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Editor */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-gray-100 px-3 pb-4 pt-4 sm:px-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {t('questionLabel')}
                </label>
                <input
                  value={q.vprasanje}
                  onChange={(e) => onChange({ vprasanje: e.target.value })}
                  maxLength={200}
                  placeholder={t('questionPlaceholder')}
                  className={inputClass}
                  autoFocus={!q.vprasanje}
                />
                {showEn ? (
                  <div className="mt-2">
                    <input
                      value={q.vprasanje_en ?? ''}
                      onChange={(e) => onChange({ vprasanje_en: e.target.value })}
                      maxLength={200}
                      placeholder={t('questionEnPlaceholder')}
                      className={inputClass}
                    />
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowEn(true)} className="mt-1.5 text-xs font-medium text-[#5B57E8] hover:underline">
                    {t('addEnglish')}
                  </button>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('typeLabel')}</label>
                <SegmentedControl
                  value={q.tip}
                  onChange={(v) => setType(v as QuestionType)}
                  options={[
                    { value: 'besedilo', label: t('types.besedilo') },
                    { value: 'da_ne', label: t('types.da_ne') },
                    { value: 'izbira', label: t('types.izbira') },
                  ]}
                />
                <p className="mt-1.5 text-xs text-gray-500">{t(`typeHints.${q.tip}`)}</p>
              </div>

              {q.tip === 'izbira' && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {t('optionsLabel')}
                  </label>
                  <div className="space-y-2">
                    {options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                          <input
                            value={opt}
                            onChange={(e) => {
                              const next = [...options];
                              next[i] = e.target.value;
                              onChange({ moznosti: next });
                            }}
                            maxLength={80}
                            placeholder={t('optionPlaceholder', { n: i + 1 })}
                            className={inputClass}
                          />
                          {showEn && (
                            <input
                              value={optionsEn[i] ?? ''}
                              onChange={(e) => {
                                const next = options.map((_, j) => optionsEn[j] ?? '');
                                next[i] = e.target.value;
                                onChange({ moznosti_en: next });
                              }}
                              maxLength={80}
                              placeholder={t('optionEnPlaceholder')}
                              className={inputClass}
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              moznosti: options.filter((_, j) => j !== i),
                              moznosti_en: optionsEn.filter((_, j) => j !== i),
                            })
                          }
                          disabled={options.length <= 2}
                          aria-label={t('removeOption')}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {options.length < MAX_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => onChange({ moznosti: [...options, ''] })}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#5B57E8] hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" weight="bold" />
                      {t('addOption')}
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[15px] text-gray-900">{t('requiredLabel')}</p>
                  <p className="text-xs text-gray-500">{t('requiredDesc')}</p>
                </div>
                <Switch checked={q.obvezno} onChange={(v) => onChange({ obvezno: v })} />
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[15px] text-gray-900">{t('allServicesLabel')}</p>
                    <p className="text-xs text-gray-500">{t('allServicesDesc')}</p>
                  </div>
                  <Switch
                    checked={forAll}
                    onChange={(v) => onChange({ storitve: v ? [] : services.slice(0, 1).map((s) => s.id) })}
                    disabled={services.length === 0}
                  />
                </div>
                {!forAll && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {services.map((s) => {
                      const on = q.storitve.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            const next = on ? q.storitve.filter((x) => x !== s.id) : [...q.storitve, s.id];
                            // No service picked would hide the question everywhere: back to "all".
                            onChange({ storitve: next });
                          }}
                          className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                            on
                              ? 'border-[#7C78FA] bg-[#7C78FA]/10 font-medium text-[#4B47D6]'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {s.naziv}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={onRemove}
                  className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash className="h-4 w-4" />
                  {t('remove')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
