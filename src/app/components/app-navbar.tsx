import Link from "next/link";
import Image from "next/image";

interface AppNavbarProps {
  email?: string;
  activePage?: "dashboard" | "settings" | "repo";
}

export function AppNavbar({ email, activePage }: AppNavbarProps) {
  return (
    <nav className="sticky top-0 z-50 bg-[#0C0A09]/80 backdrop-blur-xl border-b border-[#1C1917]">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="Codeteel" width={28} height={28} />
            <span className="text-base font-semibold text-[#FAFAF9] tracking-tight">Codeteel</span>
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            <NavLink href="/dashboard" active={activePage === "dashboard"}>Dashboard</NavLink>
            <NavLink href="/settings" active={activePage === "settings"}>Settings</NavLink>
            <NavLink href="/docs" active={false}>Docs</NavLink>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Mobile nav links */}
          <div className="flex sm:hidden items-center gap-3">
            <Link href="/dashboard" className={`text-xs ${activePage === "dashboard" ? "text-[#E8A87C]" : "text-[#A8A29E]"}`}>
              Home
            </Link>
            <Link href="/settings" className={`text-xs ${activePage === "settings" ? "text-[#E8A87C]" : "text-[#A8A29E]"}`}>
              Settings
            </Link>
          </div>
          {email && (
            <span className="hidden md:inline text-xs text-[#44403C] truncate max-w-[180px]">{email}</span>
          )}
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs text-[#A8A29E] hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
        active
          ? "text-[#E8A87C] bg-[#E8A87C]/10 font-medium"
          : "text-[#A8A29E] hover:text-[#FAFAF9] hover:bg-[#1C1917]"
      }`}
    >
      {children}
    </Link>
  );
}
