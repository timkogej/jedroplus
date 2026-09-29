import {
  JEDRO_CYAN,
  JEDRO_INK,
  JEDRO_VIOLET,
  JEDRO_WORDMARK_PATH,
  LOCKUP_HEIGHT,
  LOCKUP_MARK,
  LOCKUP_VIEW_BOX,
  LOCKUP_WIDTH,
  MARK_SIZE,
  MARK_VIEW_BOX,
  markGradientVector,
  markPath,
} from '@/lib/brand/geometry';

type Tone =
  /** Ink lettering + gradient plus — the primary lockup, for light backgrounds. */
  | 'brand'
  /** White lettering + gradient plus, for dark or photographic backgrounds. */
  | 'onDark'
  /** Everything in one solid colour — print, embossing, single-colour partners. */
  | 'mono';

const LOCKUP_ASPECT = LOCKUP_WIDTH / LOCKUP_HEIGHT;

/**
 * Gradient ids are fixed rather than generated, so the components stay Server
 * Components. Two logos on one page emit the same id twice, but the two <defs>
 * are byte-identical, so the first one wins and both render correctly.
 */
const LOCKUP_GRADIENT_ID = 'jedro-gradient-lockup';
const MARK_GRADIENT_ID = 'jedro-gradient-mark';

function Gradient({ id, size, x, y }: { id: string; size: number; x: number; y: number }) {
  const v = markGradientVector(size, x, y);
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" {...v}>
      <stop offset="0" stopColor={JEDRO_VIOLET} />
      <stop offset="1" stopColor={JEDRO_CYAN} />
    </linearGradient>
  );
}

export interface JedroLogoProps {
  /** Rendered height in px. Width follows the lockup's 972:251 ratio. */
  height?: number;
  /** Rendered width in px. Overrides `height` when both are given. */
  width?: number;
  tone?: Tone;
  /** Solid colour for `tone="mono"`. Defaults to the brand ink. */
  color?: string;
  className?: string;
  /** Leave empty to mark the logo decorative when a text label sits beside it. */
  title?: string;
}

/** The full "Jedro+" horizontal lockup. */
export function JedroLogo({
  height,
  width,
  tone = 'brand',
  color = JEDRO_INK,
  className,
  title = 'Jedro+',
}: JedroLogoProps) {
  const h = width ? width / LOCKUP_ASPECT : (height ?? 32);
  const w = width ?? h * LOCKUP_ASPECT;

  const solid = tone === 'mono' ? color : tone === 'onDark' ? '#FFFFFF' : JEDRO_INK;
  const markFill = tone === 'mono' ? color : `url(#${LOCKUP_GRADIENT_ID})`;

  return (
    <svg
      viewBox={LOCKUP_VIEW_BOX}
      width={w}
      height={h}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {tone !== 'mono' && (
        <defs>
          <Gradient id={LOCKUP_GRADIENT_ID} size={LOCKUP_MARK.size} x={LOCKUP_MARK.x} y={LOCKUP_MARK.y} />
        </defs>
      )}
      <path d={JEDRO_WORDMARK_PATH} fill={solid} />
      <path
        d={markPath(LOCKUP_MARK.size, LOCKUP_MARK.x, LOCKUP_MARK.y)}
        fill={markFill}
      />
    </svg>
  );
}

export interface JedroMarkProps {
  /** Rendered edge length in px — the mark is square. */
  size?: number;
  tone?: Tone;
  color?: string;
  className?: string;
  title?: string;
}

/** The plus on its own — favicons, avatars, tight spaces, loading states. */
export function JedroMark({
  size = 32,
  tone = 'brand',
  color = JEDRO_INK,
  className,
  title = 'Jedro+',
}: JedroMarkProps) {
  const fill =
    tone === 'mono' ? color : tone === 'onDark' ? '#FFFFFF' : `url(#${MARK_GRADIENT_ID})`;

  return (
    <svg
      viewBox={MARK_VIEW_BOX}
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {tone === 'brand' && (
        <defs>
          <Gradient id={MARK_GRADIENT_ID} size={MARK_SIZE} x={0} y={0} />
        </defs>
      )}
      <path d={markPath()} fill={fill} />
    </svg>
  );
}

export default JedroLogo;
