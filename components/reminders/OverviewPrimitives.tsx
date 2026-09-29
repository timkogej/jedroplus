'use client';

import type { ReactNode } from 'react';

/**
 * Gradniki pregleda opomnikov.
 *
 * Ločeni od strani zato, da jih lahko predogled v `app/[locale]/design`
 * uporabi iste, kot jih vidi uporabnik — brez podvojene kopije, ki bi se
 * sčasoma razšla z izvirnikom.
 */

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export function StatusPill({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      )}
    >
      <span
        className={cx(
          'h-1.5 w-1.5 rounded-full',
          enabled ? 'bg-emerald-500' : 'bg-rose-500'
        )}
      />
      {label}
    </span>
  );
}

export function ValuePill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'blue' | 'green' | 'amber';
}) {
  const variants = {
    neutral: 'bg-gray-100 text-gray-700',
    blue: 'bg-sky-50 text-sky-800',
    green: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
  };

  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-left text-xs font-medium leading-5',
        variants[tone]
      )}
    >
      {children}
    </span>
  );
}

export function SettingRow({
  icon,
  label,
  description,
  value,
}: {
  icon: ReactNode;
  label: string;
  description?: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex-shrink-0 text-gray-400">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {description ? (
            <div className="mt-0.5 text-[13px] leading-snug text-gray-500">{description}</div>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 flex-shrink-0 text-left text-sm text-gray-900 sm:text-right">{value}</div>
    </div>
  );
}

export function SectionPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('min-w-0', className)}>
      {/* Naslov stoji nad kartico, kot v Applovih Nastavitvah. */}
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">{children}</div>
    </section>
  );
}

export function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <div className="mt-1.5 text-sm leading-relaxed text-gray-900">{children}</div>
    </div>
  );
}

export function PlainMeta({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <p className="text-sm leading-6 text-gray-900">
      <span className="text-gray-500">{label}:</span> {children}
    </p>
  );
}

export function FlowStep({
  icon,
  eyebrow,
  title,
  enabled,
  statusLabel,
  editLabel,
  onEdit,
  children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  enabled: boolean;
  statusLabel: string;
  editLabel?: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <article className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 border-b border-gray-100 p-4 last:border-b-0 sm:grid-cols-[28px_minmax(0,1fr)] sm:gap-4">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {eyebrow}
            </p>
            <h3 className="mt-0.5 text-[15px] font-semibold text-gray-900">{title}</h3>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <StatusPill enabled={enabled} label={statusLabel} />
            {onEdit && editLabel ? (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                {editLabel}
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 space-y-3">{children}</div>
      </div>
    </article>
  );
}

export function ColorSwatches({ colors, emptyLabel }: { colors: string[]; emptyLabel: string }) {
  const normalizedColors = colors
    .map((color) => color.trim())
    .filter(Boolean)
    .map((color) => (color.startsWith('#') ? color : `#${color}`));

  if (normalizedColors.length === 0) {
    return <span className="text-gray-400">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
      {normalizedColors.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
        >
          <span
            className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: color }}
          />
          {color.toUpperCase()}
        </span>
      ))}
    </div>
  );
}
