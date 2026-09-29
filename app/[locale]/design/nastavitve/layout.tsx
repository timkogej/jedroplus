// Ista lupina kot prave nastavitve, samo brez prijave — da je predogled
// mogoče odpreti neposredno.
export default function SettingsDesignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-4 py-7 sm:px-6 sm:py-9">{children}</div>
    </div>
  );
}
