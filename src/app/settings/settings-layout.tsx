"use client";

import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { id: "llm", label: "Web LLM", icon: "bolt", description: "AI model for chat" },
  { id: "platform-llm", label: "Platform LLM", icon: "cloud", description: "Slack, Telegram, Discord" },
  { id: "embedding", label: "Embeddings", icon: "search", description: "Code search & indexing" },
  { id: "instructions", label: "Instructions", icon: "pen", description: "Coding style & rules" },
  { id: "integrations", label: "Integrations", icon: "link", description: "Platform connections" },
];

const ICONS: Record<string, React.ReactNode> = {
  bolt: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
  cloud: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" /></svg>,
  search: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>,
  pen: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>,
  link: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>,
};

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState("llm");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-100px 0px -60% 0px" }
    );
    for (const item of NAV_ITEMS) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="max-w-[1200px] mx-auto flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto border-r border-[#1C1917]">
        <div className="py-6 px-4">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-[#FAFAF9]">Settings</h2>
            <p className="text-[10px] text-[#71717A] mt-0.5">Manage your AI configuration</p>
          </div>

          {/* Nav items */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all group cursor-pointer ${
                  activeSection === item.id
                    ? "bg-[#E8A87C]/10 border border-[#E8A87C]/20"
                    : "hover:bg-[#1C1917] border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`${activeSection === item.id ? "text-[#E8A87C]" : "text-[#71717A] group-hover:text-[#A8A29E]"} transition-colors`}>
                    {ICONS[item.icon]}
                  </span>
                  <div>
                    <div className={`text-xs font-medium ${activeSection === item.id ? "text-[#E8A87C]" : "text-[#A8A29E] group-hover:text-[#FAFAF9]"} transition-colors`}>
                      {item.label}
                    </div>
                    <div className="text-[10px] text-[#71717A]">{item.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </nav>

          {/* Separator */}
          <div className="h-px bg-gradient-to-r from-transparent via-[#292524] to-transparent my-6" />

          {/* Quick links */}
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#71717A] mb-3 px-1">
            Resources
          </div>
          <nav className="space-y-0.5">
            {[
              { href: "/docs/settings", label: "Documentation" },
              { href: "/docs/models", label: "LLM Providers" },
              { href: "/docs/instructions", label: "Instructions Guide" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#71717A] hover:text-[#A8A29E] hover:bg-[#1C1917] transition-all"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile bottom tabs */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0C0A09]/90 backdrop-blur-xl border-t border-[#1C1917] px-2 py-1.5 flex justify-around safe-area-pb">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all ${
              activeSection === item.id
                ? "text-[#E8A87C]"
                : "text-[#71717A]"
            }`}
          >
            {ICONS[item.icon]}
            <span className="text-[9px] font-medium">{item.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 px-5 sm:px-6 lg:px-10 py-8 space-y-10 pb-24 lg:pb-8">
        {children}
      </main>
    </div>
  );
}
