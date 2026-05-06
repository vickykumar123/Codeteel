export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-[#0C0A09]">
      <div className="sticky top-0 z-50 bg-[#0C0A09]/80 border-b border-[#1C1917]">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3 flex items-center justify-between">
          <div className="h-7 w-28 bg-[#1C1917] rounded-lg animate-pulse" />
          <div className="h-5 w-16 bg-[#1C1917] rounded animate-pulse" />
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-5 sm:px-6 lg:px-8 py-8 space-y-12">
        {[...Array(3)].map((_, i) => (
          <div key={i}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 bg-[#292524] rounded-xl animate-pulse" />
              <div>
                <div className="h-5 w-32 bg-[#1C1917] rounded animate-pulse mb-1" />
                <div className="h-3 w-64 bg-[#1C1917] rounded animate-pulse" />
              </div>
            </div>
            <div className="bg-[#1C1917] border border-[#292524] rounded-2xl p-6 h-40 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
