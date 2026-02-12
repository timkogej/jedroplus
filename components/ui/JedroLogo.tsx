interface JedroLogoProps {
  size?: number;
  className?: string;
}

export function JedroLogo({ size = 40, className = '' }: JedroLogoProps) {
  const gradientId = `jedro-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7B4BEA" />
          <stop offset="50%" stopColor="#4C74E0" />
          <stop offset="100%" stopColor="#35D2D2" />
        </linearGradient>
      </defs>

      {/* Horizontal bar - THIN (50px height) */}
      <rect
        x="96"
        y="231"
        width="320"
        height="50"
        rx="25"
        fill={`url(#${gradientId})`}
      />

      {/* Vertical bar - THIN (50px width) */}
      <rect
        x="231"
        y="96"
        width="50"
        height="320"
        rx="25"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
