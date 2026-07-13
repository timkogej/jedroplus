// app/[locale]/rezervacije/loading.tsx
//
// Instant navigation fallback shown while the Rezervacije Server Component
// fetches. A lightweight skeleton mirroring the page's rough layout (header,
// two info banners, two design-card sections) so the route paints immediately
// instead of blank.

export default function RezervacijeLoading() {
  return (
    <div className="min-h-screen bg-white animate-pulse" aria-busy="true" aria-label="Nalaganje">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-56 rounded-lg bg-gray-200" />
            <div className="h-4 w-72 rounded bg-gray-200" />
          </div>
          <div className="h-10 w-10 rounded-lg bg-gray-200" />
        </div>

        {/* Info banners */}
        <div className="mb-6 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="h-16 rounded-lg border border-gray-100 bg-white" />
          <div className="h-16 rounded-lg border border-gray-100 bg-white" />
        </div>

        {/* Design-card sections */}
        {Array.from({ length: 2 }).map((_, section) => (
          <div key={section} className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
            <div className="mb-5 h-6 w-48 rounded bg-gray-200" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, card) => (
                <div key={card} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="aspect-square rounded-lg bg-gray-200" />
                  <div className="mt-4 h-10 rounded-lg bg-gray-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
