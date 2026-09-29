"use client";

import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  /** Drobna pojasnjevalna vrstica pod naslovom. Izpusti jo, če naslov pove vse. */
  subtitle?: string;
  /** Povezava »Vse« desno od naslova — vzorec iz App Storea. */
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Uredniška sekcija dashboarda.
 *
 * Naslov stoji NAD vsebino, ne v glavi kartice. Tako vsaka kartica izgubi svojo
 * glavo z ikono in podnaslovom, stran pa dobi eno samo, berljivo hierarhijo:
 * naslov strani → naslovi sekcij → vsebina. To je razlika med »škatle ena za
 * drugo« in urejeno stranjo.
 */
export function Section({
  title,
  subtitle,
  actionHref,
  actionLabel,
  children,
  className = "",
}: SectionProps) {
  return (
    <section className={`mb-10 ${className}`}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>

        {actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="group flex flex-shrink-0 items-center gap-0.5 text-sm font-medium text-[#6D5EF7] transition-opacity hover:opacity-70"
          >
            {actionLabel}
            <CaretRight
              weight="bold"
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        )}
      </div>

      {children}
    </section>
  );
}
