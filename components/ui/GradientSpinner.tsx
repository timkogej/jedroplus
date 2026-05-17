'use client';

/** Full-screen centered loading state (outside ProtectedLayout) */
export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <GradientSpinner size={40} />
    </div>
  );
}

/** Content-area centered loading state (inside ProtectedLayout, below the app bar) */
export function PageSpinner() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <GradientSpinner size={40} />
    </div>
  );
}

interface GradientSpinnerProps {
  size?: number;
  strokeWidth?: number;
}

export function GradientSpinner({ size = 32 }: GradientSpinnerProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin"
    />
  );
}
