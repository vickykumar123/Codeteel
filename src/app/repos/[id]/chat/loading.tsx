export default function ChatLoading() {
  return (
    <div className="flex h-screen bg-[#0C0A09]">
      {/* Sidebar skeleton */}
      <aside className="hidden lg:flex w-72 bg-[#0C0A09] border-r border-[#1C1917] flex-col">
        <div className="p-4 border-b border-[#1C1917]">
          <div className="h-5 w-32 bg-[#1C1917] rounded animate-pulse mb-2" />
          <div className="h-3 w-20 bg-[#1C1917] rounded animate-pulse" />
        </div>
        <div className="p-3">
          <div className="h-10 w-full bg-[#1C1917] rounded-xl animate-pulse" />
        </div>
        <div className="flex-1 px-4 py-2 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-[#1C1917] rounded-xl animate-pulse" />
          ))}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-[#0C0A09]/80 border-b border-[#1C1917] px-6 py-3">
          <div className="h-4 w-32 bg-[#1C1917] rounded animate-pulse mb-2" />
          <div className="h-3 w-48 bg-[#1C1917] rounded animate-pulse" />
        </div>

        {/* Messages area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-[#1C1917] rounded-xl animate-pulse mx-auto mb-4" />
            <div className="h-4 w-40 bg-[#1C1917] rounded animate-pulse mx-auto mb-2" />
            <div className="h-3 w-56 bg-[#1C1917] rounded animate-pulse mx-auto" />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-[#1C1917] p-4">
          <div className="max-w-3xl mx-auto flex gap-3">
            <div className="flex-1 h-12 bg-[#1C1917] rounded-xl animate-pulse" />
            <div className="w-12 h-12 bg-[#1C1917] rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
