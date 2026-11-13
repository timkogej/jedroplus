'use client';

/**
 * Zamegljeno in rahlo zatemnjeno ozadje med pogovorom (aplikacija ostane vidna
 * zadaj). Ob obrazcu gre pod list obrazca (z-59 < z-60), da je list oster v
 * ospredju. Tap na tančico konča pogovor (kot pri Siri); ob obrazcu tapa ne
 * dobi (klik gre ozadju obrazca, ki ga zapre kot doslej).
 */

export function Tancica({ vidna, obrazec, onTap }: { vidna: boolean; obrazec: boolean; onTap?: () => void }) {
  return (
    <div
      aria-hidden
      className="ap-tancica"
      data-vidna={vidna ? '' : undefined}
      data-obrazec={obrazec ? '' : undefined}
      onClick={vidna && !obrazec ? onTap : undefined}
    />
  );
}
