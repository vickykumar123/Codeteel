export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0C0A09]">
      {/* Nav skeleton */}
      <div className="sticky top-0 z-50 bg-[#0C0A09]/80 border-b border-[#1C1917]">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="h-7 w-28 bg-[#1C1917] rounded-lg animate-pulse" />
            <div className="hidden sm:flex gap-2">
              <div className="h-8 w-20 bg-[#1C1917] rounded-lg animate-pulse" />
              <div className="h-8 w-20 bg-[#1C1917] rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="h-5 w-16 bg-[#1C1917] rounded animate-pulse" />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
        {/* Welcome skeleton */}
        <div className="mb-8">
          <div className="h-8 w-60 bg-[#1C1917] rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-80 bg-[#1C1917] rounded animate-pulse" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#1C1917] border border-[#292524] rounded-2xl p-5">
              <div className="h-8 w-12 bg-[#292524] rounded animate-pulse mb-2" />
              <div className="h-3 w-16 bg-[#292524] rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Repos skeleton */}
        <div className="bg-[#1C1917] border border-[#292524] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#292524] flex justify-between">
            <div className="h-5 w-28 bg-[#292524] rounded animate-pulse" />
            <div className="h-8 w-20 bg-[#292524] rounded-lg animate-pulse" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-6 py-4 border-b border-[#292524] flex justify-between items-center">
              <div>
                <div className="h-4 w-48 bg-[#292524] rounded animate-pulse mb-2" />
                <div className="h-3 w-24 bg-[#292524] rounded animate-pulse" />
              </div>
              <div className="h-4 w-4 bg-[#292524] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
