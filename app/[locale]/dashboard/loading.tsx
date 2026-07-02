// app/[locale]/dashboard/loading.tsx
//
// Instant navigation fallback (Suspense boundary) shown while the dashboard
// Server Component fetches its data. A lightweight skeleton that mirrors the
// dashboard's rough layout so the route paints immediately instead of blank.

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 animate-pulse" aria-busy="true" aria-label="Nalaganje">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-gray-200" />
          <div className="h-4 w-72 rounded bg-gray-200" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-gray-100 p-5">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="mt-4 h-8 w-16 rounded bg-gray-200" />
            </div>
          ))}
        </div>

        {/* Main content: list + side column */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 rounded-2xl bg-white border border-gray-100 p-5 space-y-3">
            <div className="h-5 w-40 rounded bg-gray-200" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-100" />
            ))}
          </div>
          <div className="space-y-6">
            <div className="h-44 rounded-2xl bg-white border border-gray-100 p-5">
              <div className="h-5 w-32 rounded bg-gray-200" />
              <div className="mt-4 h-24 rounded-xl bg-gray-100" />
            </div>
            <div className="h-44 rounded-2xl bg-white border border-gray-100 p-5">
              <div className="h-5 w-32 rounded bg-gray-200" />
              <div className="mt-4 h-24 rounded-xl bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
