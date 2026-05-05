import { PageHeader, H2, H3, P, CodeBlock, BulletList, Callout, NextPage } from "../components";

export default function SecurityPage() {
  return (
    <>
      <PageHeader title="Security Scans" description="On-demand security scanning for your codebase, paths, and PR diffs." />

      <H2>What it scans for</H2>
      <P>Codeteel focuses on CRITICAL and HIGH severity vulnerabilities only:</P>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
        <div className="bg-[#292524] rounded-lg p-4">
          <div className="text-xs font-semibold text-red-400 uppercase mb-2">Critical</div>
          <BulletList items={[
            "Hardcoded secrets, API keys, passwords",
            "SQL injection",
            "Command injection",
            "Authentication bypass",
            "Path traversal",
            "Insecure deserialization",
          ]} />
        </div>
        <div className="bg-[#292524] rounded-lg p-4">
          <div className="text-xs font-semibold text-orange-400 uppercase mb-2">High</div>
          <BulletList items={[
            "XSS (unescaped user input)",
            "SSRF (user-provided URLs)",
            "Insecure cryptography",
            "Missing CSRF protection",
            "Overly permissive CORS",
            "Missing rate limiting on auth",
          ]} />
        </div>
      </div>

      <H2>Three scan modes</H2>
      <CodeBlock>{`/security                  # Full codebase scan
/security src/auth/        # Scan specific path
/security pr 42            # Scan PR #42 diff only`}</CodeBlock>

      <H2>How it works</H2>
      <P>For full codebase scans, Codeteel uses a smart two-pass approach:</P>
      <BulletList items={[
        <><strong>Pass 1:</strong> Read file summaries from the index and regex-match for security keywords (inject, auth, bypass, etc.)</>,
        <><strong>Pass 2:</strong> Only read full code for flagged files + files with sensitive names (auth, login, token, password, config, etc.)</>,
      ]} />
      <P>This keeps scans fast (reads ~30 files max) without missing critical issues.</P>

      <P>For PR scans, only the changed files in the PR diff are analyzed.</P>

      <Callout type="info">
        Security scans are also available on all platforms: <code className="text-[#E8A87C]">/codeteel security</code> (Slack), <code className="text-[#E8A87C]">/security</code> (Telegram/Discord).
      </Callout>

      <NextPage href="/docs/reviews" label="PR & Issue Reviews" />
    </>
  );
}
