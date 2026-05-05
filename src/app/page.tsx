import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#0C0A09] text-[#FAFAF9] overflow-hidden">
      {/* Nav */}
      <nav className="relative z-10 max-w-6xl mx-auto px-5 sm:px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="Codeteel" width={32} height={32} />
          <span className="text-lg font-semibold tracking-tight">Codeteel</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/docs"
            className="text-sm text-[#A8A29E] hover:text-[#FAFAF9] transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/login"
            className="text-sm text-[#A8A29E] hover:text-[#FAFAF9] transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm px-4 sm:px-5 py-2 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-16 sm:pt-24 pb-24 sm:pb-36">
        {/* Glow effects */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] sm:w-[700px] h-[350px] sm:h-[500px] bg-[#E8A87C] opacity-[0.06] blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[200px] h-[200px] bg-[#C9A96E] opacity-[0.04] blur-[100px] rounded-full pointer-events-none" />

        <div className="relative text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#1C1917] border border-[#292524] rounded-full text-xs text-[#A8A29E] mb-8">
            <span className="w-1.5 h-1.5 bg-[#E8A87C] rounded-full animate-pulse" />
            Open Source AI Coding Agent
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
            Code from anywhere,
            <br />
            <span className="bg-gradient-to-r from-[#F5D5C3] via-[#E8A87C] to-[#C9A96E] bg-clip-text text-transparent">
              ship from everywhere
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-[#A8A29E] leading-relaxed max-w-2xl mx-auto mb-10">
            Connect your GitHub repo, index your codebase, and start building.
            Chat from Web, Slack, Telegram, or Discord.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-14">
            <Link
              href="/signup"
              className="px-8 py-3.5 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] font-semibold rounded-xl text-base hover:opacity-90 transition-opacity shadow-lg shadow-[#E8A87C]/20"
            >
              Start Building — Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 bg-[#1C1917] border border-[#292524] text-[#FAFAF9] font-medium rounded-xl text-base hover:bg-[#292524] transition-colors"
            >
              Sign In
            </Link>
          </div>

          {/* Platform icons row */}
          <div className="flex items-center justify-center gap-6 sm:gap-8">
            <div className="flex items-center gap-2 text-[#71717A]">
              <SlackIcon className="w-5 h-5" />
              <span className="text-xs hidden sm:inline">Slack</span>
            </div>
            <div className="flex items-center gap-2 text-[#71717A]">
              <TelegramIcon className="w-5 h-5" />
              <span className="text-xs hidden sm:inline">Telegram</span>
            </div>
            <div className="flex items-center gap-2 text-[#71717A]">
              <DiscordIcon className="w-5 h-5" />
              <span className="text-xs hidden sm:inline">Discord</span>
            </div>
            <div className="flex items-center gap-2 text-[#71717A]">
              <GlobeIcon className="w-5 h-5" />
              <span className="text-xs hidden sm:inline">Web</span>
            </div>
            <div className="flex items-center gap-2 text-[#71717A]">
              <GitHubIcon className="w-5 h-5" />
              <span className="text-xs hidden sm:inline">GitHub</span>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#292524] to-transparent" />
      </div>

      {/* How it works */}
      <section className="relative max-w-6xl mx-auto px-5 sm:px-6 py-24 sm:py-32">
        <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#E8A87C] mb-3">
          How it works
        </h2>
        <p className="text-center text-2xl sm:text-3xl font-bold mb-14 sm:mb-16">
          Three steps to AI-powered coding
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="group relative bg-[#1C1917] border border-[#292524] rounded-2xl p-7 sm:p-8 hover:border-[#E8A87C]/30 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-[#E8A87C]/0 via-[#E8A87C]/0 to-[#E8A87C]/0 group-hover:via-[#E8A87C]/40 transition-all duration-500" />
            <span className="text-3xl font-bold bg-gradient-to-br from-[#E8A87C] to-[#C9A96E] bg-clip-text text-transparent">01</span>
            <h3 className="text-lg font-semibold mt-4 mb-2">Connect & Index</h3>
            <p className="text-sm text-[#A8A29E] leading-relaxed">Link your GitHub repos. Codeteel reads every file, generates AI summaries, and builds a searchable index.</p>
          </div>

          <div className="group relative bg-[#1C1917] border border-[#292524] rounded-2xl p-7 sm:p-8 hover:border-[#E8A87C]/30 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-[#E8A87C]/0 via-[#E8A87C]/0 to-[#E8A87C]/0 group-hover:via-[#E8A87C]/40 transition-all duration-500" />
            <span className="text-3xl font-bold bg-gradient-to-br from-[#E8A87C] to-[#C9A96E] bg-clip-text text-transparent">02</span>
            <h3 className="text-lg font-semibold mt-4 mb-2">Chat & Plan</h3>
            <p className="text-sm text-[#A8A29E] leading-relaxed">Ask questions or request changes from Web, Slack, Telegram, or Discord. Review the implementation plan.</p>
          </div>

          <div className="group relative bg-[#1C1917] border border-[#292524] rounded-2xl p-7 sm:p-8 hover:border-[#E8A87C]/30 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-[#E8A87C]/0 via-[#E8A87C]/0 to-[#E8A87C]/0 group-hover:via-[#E8A87C]/40 transition-all duration-500" />
            <span className="text-3xl font-bold bg-gradient-to-br from-[#E8A87C] to-[#C9A96E] bg-clip-text text-transparent">03</span>
            <h3 className="text-lg font-semibold mt-4 mb-2">Approve & Ship</h3>
            <p className="text-sm text-[#A8A29E] leading-relaxed">Approve with a button click. Codeteel writes the code, commits to a branch, and opens a pull request.</p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#292524] to-transparent" />
      </div>

      {/* Features */}
      <section className="relative max-w-6xl mx-auto px-5 sm:px-6 py-24 sm:py-32">
        <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#E8A87C] mb-3">
          Features
        </h2>
        <p className="text-center text-2xl sm:text-3xl font-bold mb-14 sm:mb-16">
          Everything you need to code with AI
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={<CodeIcon />}
            title="Understands Your Code"
            description="AI summaries + vector embeddings for every file. Semantic search across your entire codebase."
          />
          <FeatureCard
            icon={<BoltIcon />}
            title="Use Your Own Models"
            description="Run local Ollama models — zero API cost, full privacy. Or use OpenAI, Claude, Gemini, and 5 more."
          />
          <FeatureCard
            icon={<ShieldIcon />}
            title="Security Scans"
            description="On-demand security audits. Scan your codebase, paths, or PR diffs for critical vulnerabilities."
          />
          <FeatureCard
            icon={<GitIcon />}
            title="Plan → Approve → PR"
            description="Review before code is written. Approve with buttons or text. Changes committed, PR created."
          />
          <FeatureCard
            icon={<ReviewIcon />}
            title="PR & Issue Reviews"
            description="Get thorough code reviews on pull requests. Analyze issues with suggested approaches."
          />
          <FeatureCard
            icon={<LockIcon />}
            title="Encrypted & Secure"
            description="AES-256-GCM encryption. OAuth tokens secured. Branch protection enforced. Your code stays yours."
          />
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#292524] to-transparent" />
      </div>

      {/* Platforms */}
      <section className="relative max-w-6xl mx-auto px-5 sm:px-6 py-24 sm:py-32">
        <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#E8A87C] mb-3">
          Platforms
        </h2>
        <p className="text-center text-2xl sm:text-3xl font-bold mb-14 sm:mb-16">
          Works where your team works
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <PlatformCard
            icon={<GlobeIcon className="w-8 h-8" />}
            name="Web"
            features={["Slash commands with autocomplete", "Rich plan approval UI", "Execution progress & diffs", "Conversation compression"]}
            color="#E8A87C"
          />
          <PlatformCard
            icon={<SlackIcon className="w-8 h-8" />}
            name="Slack"
            features={["Block Kit buttons", "/codeteel commands", "OAuth workspace install", "Channel-to-repo mapping"]}
            color="#E8A87C"
          />
          <PlatformCard
            icon={<TelegramIcon className="w-8 h-8" />}
            name="Telegram"
            features={["Inline keyboard buttons", "Direct text messaging", "One-click connect link", "Markdown formatting"]}
            color="#E8A87C"
          />
          <PlatformCard
            icon={<DiscordIcon className="w-8 h-8" />}
            name="Discord"
            features={["/ask slash commands", "Action row buttons", "Server-wide access", "Embed responses"]}
            color="#E8A87C"
          />
        </div>
      </section>

      {/* Use your own models */}
      <section className="relative max-w-6xl mx-auto px-5 sm:px-6 pb-24 sm:pb-32">
        <div className="relative bg-gradient-to-br from-[#1C1917] to-[#0C0A09] border border-[#292524] rounded-2xl p-8 sm:p-12 overflow-hidden">
          <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-[#C9A96E] opacity-[0.04] blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-[#E8A87C] opacity-[0.04] blur-[80px] rounded-full pointer-events-none" />

          <div className="relative flex flex-col lg:flex-row items-start gap-8 lg:gap-16">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#292524] rounded-full text-xs text-[#E8A87C] font-medium mb-4">
                <BoltIcon />
                Zero API Cost
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4">Your models, your data</h3>
              <p className="text-[#A8A29E] leading-relaxed mb-6">
                Connect local Ollama models and keep everything on your machine. No API keys, no cloud,
                no per-request charges. Or choose from 8 cloud providers when you need scale.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#E8A87C] hover:text-[#F5D5C3] transition-colors"
              >
                Get started
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>

            <div className="w-full lg:w-auto grid grid-cols-2 gap-3">
              {["Ollama", "OpenAI", "Claude", "Gemini", "Grok", "Qwen", "Fireworks", "Together"].map((p) => (
                <div key={p} className="px-4 py-2.5 bg-[#292524] border border-[#3F3F46] rounded-lg text-sm text-[#A8A29E] text-center hover:border-[#E8A87C]/30 hover:text-[#FAFAF9] transition-all cursor-default">
                  {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative max-w-6xl mx-auto px-5 sm:px-6 pb-24 sm:pb-32">
        <div className="relative bg-[#1C1917] border border-[#292524] rounded-2xl p-10 sm:p-16 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E8A87C]/[0.03] to-transparent pointer-events-none" />
          <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-[#E8A87C] opacity-[0.04] blur-[120px] rounded-full pointer-events-none" />

          <h2 className="relative text-3xl sm:text-4xl font-bold mb-4">
            Ready to ship faster?
          </h2>
          <p className="relative text-[#A8A29E] mb-8 max-w-lg mx-auto">
            Connect your repo, index your code, and start building with AI in under 5 minutes.
          </p>
          <div className="relative flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3.5 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] font-semibold rounded-xl text-base hover:opacity-90 transition-opacity shadow-lg shadow-[#E8A87C]/20"
            >
              Get Started — Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 bg-[#292524] border border-[#3F3F46] text-[#FAFAF9] font-medium rounded-xl text-base hover:bg-[#3F3F46] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1C1917]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="Codeteel" width={22} height={22} />
            <span className="text-sm text-[#A8A29E]">Codeteel</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#44403C]">
            <Link href="/docs/slack" className="hover:text-[#A8A29E] transition-colors">Slack</Link>
            <Link href="/docs/telegram" className="hover:text-[#A8A29E] transition-colors">Telegram</Link>
            <Link href="/docs/discord" className="hover:text-[#A8A29E] transition-colors">Discord</Link>
          </div>
          <p className="text-xs text-[#44403C]">Ship code faster with AI</p>
        </div>
      </footer>
    </div>
  );
}

// ===========================================
// FEATURE CARD
// ===========================================

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group relative bg-[#1C1917] border border-[#292524] rounded-2xl p-6 hover:border-[#E8A87C]/30 transition-all duration-300">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-[#E8A87C]/0 via-[#E8A87C]/0 to-[#E8A87C]/0 group-hover:via-[#E8A87C]/40 transition-all duration-500" />
      <div className="w-10 h-10 bg-[#292524] rounded-xl flex items-center justify-center mb-4 text-[#E8A87C]">
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[#A8A29E] leading-relaxed">{description}</p>
    </div>
  );
}

// ===========================================
// PLATFORM CARD
// ===========================================

function PlatformCard({ icon, name, features, color }: { icon: React.ReactNode; name: string; features: string[]; color: string }) {
  return (
    <div className="group relative bg-[#1C1917] border border-[#292524] rounded-2xl p-6 hover:border-[#E8A87C]/30 transition-all duration-300">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-[#E8A87C]/0 via-[#E8A87C]/0 to-[#E8A87C]/0 group-hover:via-[#E8A87C]/40 transition-all duration-500" />
      <div className="mb-4" style={{ color }}>
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-3">{name}</h3>
      <ul className="space-y-1.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[#A8A29E]">
            <span className="text-[#E8A87C] mt-1 text-[10px]">&#9670;</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===========================================
// PLATFORM ICONS (Simple Icons)
// ===========================================

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );
}

// ===========================================
// FEATURE ICONS
// ===========================================

function CodeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function GitIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}
