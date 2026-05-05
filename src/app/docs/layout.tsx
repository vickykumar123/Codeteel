"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

// ===========================================
// SIDEBAR NAV STRUCTURE
// ===========================================

const NAV_SECTIONS = [
  {
    title: "Getting Started",
    items: [
      { label: "Introduction", href: "/docs" },
      { label: "Settings", href: "/docs/settings" },
    ],
  },
  {
    title: "Core Features",
    items: [
      { label: "Code Indexing", href: "/docs/indexing" },
      { label: "Web Chat", href: "/docs/chat" },
      { label: "Slash Commands", href: "/docs/commands" },
      { label: "Plans & Execution", href: "/docs/plans" },
      { label: "Branch Management", href: "/docs/branches" },
      { label: "Custom Instructions", href: "/docs/instructions" },
    ],
  },
  {
    title: "Code Review",
    items: [
      { label: "Security Scans", href: "/docs/security" },
      { label: "PR & Issue Reviews", href: "/docs/reviews" },
    ],
  },
  {
    title: "Platforms",
    items: [
      { label: "Overview", href: "/docs/platforms" },
      { label: "Slack", href: "/docs/slack" },
      { label: "Telegram", href: "/docs/telegram" },
      { label: "Discord", href: "/docs/discord" },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "LLM Providers", href: "/docs/models" },
      { label: "Security & Encryption", href: "/docs/encryption" },
    ],
  },
];

// ===========================================
// LAYOUT
// ===========================================

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0C0A09] text-[#FAFAF9]">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 bg-[#0C0A09]/80 backdrop-blur-xl border-b border-[#1C1917]">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 -ml-1.5 text-[#A8A29E] hover:text-[#FAFAF9] transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                {sidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                )}
              </svg>
            </button>
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.svg" alt="Codeteel" width={26} height={26} />
              <span className="text-base font-semibold tracking-tight">Codeteel</span>
            </Link>
            <span className="text-xs text-[#44403C] border-l border-[#292524] pl-4 hidden sm:inline">Documentation</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-[#A8A29E] hover:text-[#FAFAF9] transition-colors">Sign in</Link>
            <Link href="/signup" className="text-sm px-4 py-1.5 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] font-semibold rounded-lg hover:opacity-90 transition-opacity">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto flex">
        {/* Sidebar - desktop */}
        <aside className="hidden lg:block w-64 flex-shrink-0 border-r border-[#1C1917] sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
          <div className="py-6 px-4">
            <SidebarContent pathname={pathname} onNavigate={() => {}} />
          </div>
        </aside>

        {/* Sidebar - mobile overlay */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed left-0 top-[57px] bottom-0 w-72 bg-[#0C0A09] border-r border-[#1C1917] z-50 lg:hidden overflow-y-auto">
              <div className="py-6 px-4">
                <SidebarContent pathname={pathname} onNavigate={() => setSidebarOpen(false)} />
              </div>
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 px-5 sm:px-8 lg:px-12 py-10 sm:py-12">
          <div className="max-w-3xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// ===========================================
// SIDEBAR CONTENT
// ===========================================

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav className="space-y-6">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#44403C] mb-2 px-3">
            {section.title}
          </div>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`block px-3 py-1.5 rounded-lg text-sm transition-all ${
                      isActive
                        ? "bg-[#E8A87C]/10 text-[#E8A87C] font-medium"
                        : "text-[#A8A29E] hover:text-[#FAFAF9] hover:bg-[#1C1917]"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
