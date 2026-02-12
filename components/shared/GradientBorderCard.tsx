import type { ReactNode } from 'react';

type GradientBorderCardProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  gradientClassName?: string;
};

export default function GradientBorderCard({
  children,
  className = '',
  innerClassName = '',
  gradientClassName = 'bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500',
}: GradientBorderCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-[16px] p-[2px] ${gradientClassName} ${className}`.trim()}
    >
      <div className={`rounded-[14px] bg-white ${innerClassName}`.trim()}>{children}</div>
    </div>
  );
}
