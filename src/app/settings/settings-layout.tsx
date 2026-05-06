"use client";

import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { id: "llm", label: "Web LLM" },
  { id: "platform-llm", label: "Platform LLM" },
  { id: "embedding", label: "Embeddings" },
  { id: "instructions", label: "Custom Instructions" },
  { id: "integrations", label: "Integrations" },
];

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState("llm");

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
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
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-[57px] h-[calc(100vh-57px)] py-8 pr-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#44403C] mb-3 px-3">
          Settings
        </div>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                activeSection === item.id
                  ? "bg-[#E8A87C]/10 text-[#E8A87C] font-medium"
                  : "text-[#A8A29E] hover:text-[#FAFAF9] hover:bg-[#1C1917]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Separator */}
        <div className="h-px bg-[#1C1917] my-6 mx-3" />

        {/* Quick links */}
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#44403C] mb-3 px-3">
          Resources
        </div>
        <nav className="space-y-0.5">
          <a href="/docs/settings" className="block px-3 py-2 rounded-lg text-sm text-[#A8A29E] hover:text-[#FAFAF9] hover:bg-[#1C1917] transition-all">
            Documentation
          </a>
          <a href="/docs/models" className="block px-3 py-2 rounded-lg text-sm text-[#A8A29E] hover:text-[#FAFAF9] hover:bg-[#1C1917] transition-all">
            LLM Providers
          </a>
          <a href="/docs/instructions" className="block px-3 py-2 rounded-lg text-sm text-[#A8A29E] hover:text-[#FAFAF9] hover:bg-[#1C1917] transition-all">
            Instructions Guide
          </a>
        </nav>
      </aside>

      {/* Mobile section tabs */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0C0A09]/90 backdrop-blur-xl border-t border-[#1C1917] px-4 py-2 flex justify-around">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeSection === item.id
                ? "text-[#E8A87C]"
                : "text-[#44403C]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 px-5 sm:px-6 lg:px-8 py-8 space-y-12 pb-24 lg:pb-8">
        {children}
      </main>
    </div>
  );
}
