export const PlusSignLogo = ({
  size = 40,
  className = '',
}: {
  size?: number;
  className?: string;
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient
          id="plusGradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>

      {/* Vertical bar - with generous rounded corners */}
      <rect
        x="32"
        y="10"
        width="36"
        height="80"
        rx="12"
        ry="12"
        fill="url(#plusGradient)"
      />

      {/* Horizontal bar - with generous rounded corners */}
      <rect
        x="10"
        y="32"
        width="80"
        height="36"
        rx="12"
        ry="12"
        fill="url(#plusGradient)"
      />
    </svg>
  );
};
