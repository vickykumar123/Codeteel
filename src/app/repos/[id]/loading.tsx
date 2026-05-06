export default function RepoLoading() {
  return (
    <div className="min-h-screen bg-[#0C0A09]">
      <div className="sticky top-0 z-50 bg-[#0C0A09]/80 border-b border-[#1C1917]">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3 flex items-center justify-between">
          <div className="h-7 w-28 bg-[#1C1917] rounded-lg animate-pulse" />
          <div className="h-5 w-16 bg-[#1C1917] rounded animate-pulse" />
        </div>
      </div>

      <div className="border-b border-[#1C1917]">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-4">
          <div className="h-3 w-20 bg-[#1C1917] rounded animate-pulse mb-2" />
          <div className="h-6 w-48 bg-[#1C1917] rounded-lg animate-pulse" />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-5 sm:px-6 py-8 space-y-6">
        {/* Status card */}
        <div className="bg-[#1C1917] border border-[#292524] rounded-2xl p-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="h-6 w-20 bg-[#292524] rounded-lg animate-pulse mb-2" />
              <div className="h-3 w-32 bg-[#292524] rounded animate-pulse" />
            </div>
            <div className="h-10 w-28 bg-[#292524] rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#1C1917] border border-[#292524] rounded-2xl p-5 h-20 animate-pulse" />
          ))}
        </div>

        {/* Files */}
        <div className="bg-[#1C1917] border border-[#292524] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#292524]">
            <div className="h-5 w-28 bg-[#292524] rounded animate-pulse" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-6 py-3 border-b border-[#292524]">
              <div className="h-4 w-64 bg-[#292524] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
