'use client';

/**
 * Živ gradientni sij okoli roba celotnega zaslona (vijolična, modra, turkizna),
 * dokler pogovor teče. Štirje trakovi z masko (mehak prehod navznoter); barve
 * tečejo v smeri urinega kazalca samo s transform, debelina utripa z glasom
 * (--ap-nivo). Brez backdrop-filter in blur čez cel zaslon.
 */

export function ObrobaZaslona({ vidna }: { vidna: boolean }) {
  return (
    <div className="ap-rob" data-vidna={vidna ? '' : undefined} aria-hidden>
      {(['zgoraj', 'desno', 'spodaj', 'levo'] as const).map((s) => (
        <div key={s} className={`ap-rob__stran ap-rob__stran--${s}`}>
          <div className="ap-rob__trak" />
        </div>
      ))}
    </div>
  );
}
