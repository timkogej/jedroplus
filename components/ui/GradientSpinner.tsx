'use client';

interface GradientSpinnerProps {
  size?: number;
  strokeWidth?: number;
}

/**
 * A spinning circle with a violet→blue→teal gradient stroke.
 * Used as the app-wide loading indicator.
 */
export function GradientSpinner({ size = 32, strokeWidth = 3 }: GradientSpinnerProps) {
  const id = `gs-${size}-${strokeWidth}`;
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="animate-spin"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
      />
    </svg>
  );
}
