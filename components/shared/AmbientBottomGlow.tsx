import type { CSSProperties } from 'react';

type AmbientBottomGlowTone = 'turquoise' | 'purple' | 'brand' | 'gray';

interface AmbientBottomGlowProps {
  tone?: AmbientBottomGlowTone;
  className?: string;
}

const PRESETS: Record<
  AmbientBottomGlowTone,
  {
    aura: string;
    edge: string;
    auraOpacity: number;
    edgeOpacity: number;
    auraBottom: string;
    auraHeight: string;
    edgeBottom: string;
    edgeHeight: string;
    edgeWidth: string;
  }
> = {
  turquoise: {
    aura:
      'radial-gradient(ellipse 68% 46% at 50% 104%, rgba(20,184,166,0.3) 0%, rgba(34,211,238,0.19) 28%, rgba(103,232,249,0.08) 48%, rgba(255,255,255,0) 72%)',
    edge:
      'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(45,212,191,0.18) 20%, rgba(34,211,238,0.34) 50%, rgba(45,212,191,0.18) 80%, rgba(255,255,255,0) 100%)',
    auraOpacity: 1,
    edgeOpacity: 0.62,
    auraBottom: '-28vh',
    auraHeight: '68vh',
    edgeBottom: '-3.25rem',
    edgeHeight: '7rem',
    edgeWidth: 'min(980px, 82vw)',
  },
  purple: {
    aura:
      'radial-gradient(ellipse 68% 46% at 50% 104%, rgba(124,58,237,0.28) 0%, rgba(139,92,246,0.18) 28%, rgba(196,181,253,0.08) 48%, rgba(255,255,255,0) 72%)',
    edge:
      'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(124,58,237,0.16) 20%, rgba(139,92,246,0.3) 50%, rgba(167,139,250,0.16) 80%, rgba(255,255,255,0) 100%)',
    auraOpacity: 1,
    edgeOpacity: 0.58,
    auraBottom: '-28vh',
    auraHeight: '68vh',
    edgeBottom: '-3.25rem',
    edgeHeight: '7rem',
    edgeWidth: 'min(980px, 82vw)',
  },
  brand: {
    aura:
      'radial-gradient(ellipse 62% 42% at 30% 105%, rgba(109,94,247,0.22) 0%, rgba(109,94,247,0.1) 38%, rgba(255,255,255,0) 70%), radial-gradient(ellipse 66% 44% at 52% 106%, rgba(47,128,237,0.2) 0%, rgba(47,128,237,0.1) 40%, rgba(255,255,255,0) 72%), radial-gradient(ellipse 50% 34% at 73% 108%, rgba(42,212,197,0.2) 0%, rgba(42,212,197,0.08) 42%, rgba(255,255,255,0) 74%)',
    edge:
      'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(109,94,247,0.22) 16%, rgba(47,128,237,0.24) 48%, rgba(42,212,197,0.22) 78%, rgba(255,255,255,0) 100%)',
    auraOpacity: 1,
    edgeOpacity: 0.66,
    auraBottom: '-28vh',
    auraHeight: '68vh',
    edgeBottom: '-3.25rem',
    edgeHeight: '7rem',
    edgeWidth: 'min(980px, 82vw)',
  },
  gray: {
    aura:
      'radial-gradient(ellipse 70% 44% at 50% 104%, rgba(148,163,184,0.24) 0%, rgba(203,213,225,0.14) 38%, rgba(255,255,255,0) 72%)',
    edge:
      'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(148,163,184,0.16) 18%, rgba(203,213,225,0.24) 50%, rgba(148,163,184,0.16) 82%, rgba(255,255,255,0) 100%)',
    auraOpacity: 0.86,
    edgeOpacity: 0.5,
    auraBottom: '-28vh',
    auraHeight: '68vh',
    edgeBottom: '-3.25rem',
    edgeHeight: '7rem',
    edgeWidth: 'min(980px, 82vw)',
  },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function AmbientBottomGlow({
  tone = 'turquoise',
  className,
}: AmbientBottomGlowProps) {
  const preset = PRESETS[tone];

  const auraStyle: CSSProperties = {
    background: preset.aura,
    filter: 'blur(92px)',
    opacity: preset.auraOpacity,
    transform: 'translate3d(0, 0, 0)',
    WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.92) 44%, transparent 100%)',
    maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.92) 44%, transparent 100%)',
    bottom: preset.auraBottom,
    height: preset.auraHeight,
  };

  const edgeStyle: CSSProperties = {
    background: preset.edge,
    filter: 'blur(34px)',
    opacity: preset.edgeOpacity,
    transform: 'translate3d(-50%, 0, 0)',
    bottom: preset.edgeBottom,
    height: preset.edgeHeight,
    width: preset.edgeWidth,
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-0 h-[46vh] overflow-hidden',
        className
      )}
    >
      <div className="absolute inset-x-[-18vw]" style={auraStyle} />
      <div
        className="absolute left-1/2 rounded-full"
        style={edgeStyle}
      />
    </div>
  );
}
