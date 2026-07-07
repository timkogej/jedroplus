// app/[locale]/clients/loading.tsx
//
// Instant navigation fallback shown while the Stranke Server Component fetches.
// A lightweight skeleton mirroring the page's rough layout (header, stat cards,
// search bar, client table) so the route paints immediately instead of blank.

export default function ClientsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 animate-pulse" aria-busy="true" aria-label="Nalaganje">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 rounded-lg bg-gray-200" />
            <div className="h-4 w-64 rounded bg-gray-200" />
          </div>
          <div className="h-10 w-36 rounded-xl bg-gray-200" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-gray-100" />
          ))}
        </div>

        {/* Search bar */}
        <div className="h-14 rounded-2xl bg-white border border-gray-100" />

        {/* Table */}
        <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
          <div className="h-12 bg-gray-100" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-t border-gray-50">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="h-4 w-48 rounded bg-gray-200" />
              <div className="h-4 w-28 rounded bg-gray-200" />
              <div className="h-4 w-16 rounded bg-gray-200 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
