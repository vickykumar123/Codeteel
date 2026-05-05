import Link from "next/link";

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-10">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">{title}</h1>
      <p className="text-[#A8A29E] text-base">{description}</p>
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg sm:text-xl font-semibold mt-10 mb-4 text-[#FAFAF9]">{children}</h2>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold mt-6 mb-3 text-[#FAFAF9]">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#A8A29E] leading-relaxed mb-4">{children}</p>;
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 bg-[#292524] border border-[#3F3F46] rounded text-xs text-[#E8A87C] font-mono">{children}</code>;
}

export function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-[#1C1917] border border-[#292524] rounded-xl p-4 my-4 overflow-x-auto text-xs text-[#A8A29E] font-mono leading-relaxed">
      {children}
    </pre>
  );
}

export function Callout({ type, children }: { type: "info" | "tip" | "warning"; children: React.ReactNode }) {
  const styles = {
    info: { bg: "bg-[#E8A87C]/5", border: "border-[#E8A87C]/20", icon: "i", color: "text-[#E8A87C]" },
    tip: { bg: "bg-green-500/5", border: "border-green-500/20", icon: "✓", color: "text-green-400" },
    warning: { bg: "bg-amber-500/5", border: "border-amber-500/20", icon: "!", color: "text-amber-400" },
  };
  const s = styles[type];
  return (
    <div className={`${s.bg} border ${s.border} rounded-xl p-4 my-4`}>
      <div className="flex items-start gap-3">
        <span className={`${s.color} font-bold text-sm mt-0.5`}>{s.icon}</span>
        <div className="text-sm text-[#A8A29E] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function StepList({ steps }: { steps: { title: string; description: string }[] }) {
  return (
    <div className="space-y-3 my-4">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-[#E8A87C] to-[#C9A96E] rounded-md flex items-center justify-center text-[10px] font-bold text-[#0C0A09] mt-0.5">
            {i + 1}
          </div>
          <div>
            <div className="text-sm font-medium text-[#FAFAF9]">{step.title}</div>
            <div className="text-sm text-[#A8A29E] mt-0.5">{step.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BulletList({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul className="list-disc list-inside text-sm text-[#A8A29E] space-y-1 ml-4 my-3">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

export function ChatExample({ messages }: { messages: { role: "user" | "assistant"; text: string }[] }) {
  return (
    <div className="bg-[#1C1917] border border-[#292524] rounded-xl p-4 my-4 space-y-3">
      {messages.map((msg, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
            msg.role === "user" ? "bg-green-600 text-white" : "bg-[#E8A87C] text-[#0C0A09]"
          }`}>
            {msg.role === "user" ? "U" : "C"}
          </div>
          <div className="text-xs text-[#A8A29E] whitespace-pre-line leading-relaxed">{msg.text}</div>
        </div>
      ))}
    </div>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[#A8A29E] border-b border-[#292524]">
            {headers.map((h, i) => <th key={i} className="py-2 pr-4">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#1C1917] text-[#A8A29E]">
              {row.map((cell, j) => (
                <td key={j} className={`py-2 pr-4 text-xs ${j === 0 ? "text-[#FAFAF9]" : ""}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NextPage({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-12 pt-6 border-t border-[#292524]">
      <Link href={href} className="inline-flex items-center gap-2 text-sm font-medium text-[#E8A87C] hover:text-[#F5D5C3] transition-colors">
        Next: {label}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
