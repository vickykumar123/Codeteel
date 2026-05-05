import { PageHeader, H2, H3, P, Code, BulletList } from "../components";

export default function EncryptionPage() {
  return (
    <>
      <PageHeader title="Security & Encryption" description="How Codeteel protects your data, tokens, and API keys." />

      <H2>Data encryption</H2>
      <P>All sensitive data is encrypted at rest using AES-256-GCM:</P>
      <BulletList items={[
        <><strong>API keys</strong> — LLM provider keys (OpenAI, Claude, etc.)</>,
        <><strong>OAuth tokens</strong> — Slack workspace bot tokens</>,
        <><strong>Platform tokens</strong> — Telegram and Discord bot tokens</>,
      ]} />
      <P>Encryption format: <Code>aes256gcm:iv_hex:ciphertext_hex:tag_hex</Code></P>
      <P>The encryption key is a 32-byte hex string stored as an environment variable (<Code>ENCRYPTION_KEY</Code>). It never touches the database.</P>

      <H2>Request authentication</H2>

      <H3>Slack</H3>
      <BulletList items={[
        "HMAC-SHA256 request signature verification on every webhook",
        "Timing check — rejects requests older than 5 minutes",
        "OAuth state parameter signed with HMAC to prevent CSRF",
      ]} />

      <H3>Discord</H3>
      <BulletList items={[
        "Ed25519 signature verification on all interactions (using tweetnacl)",
        "Public key verified against DISCORD_PUBLIC_KEY environment variable",
      ]} />

      <H3>Platform connections</H3>
      <BulletList items={[
        "One-time connect tokens with 5-minute expiry",
        "Tokens are single-use — consumed on first connection",
        "Bot tokens never included in SQS messages — Lambda looks them up from the database",
      ]} />

      <H2>Branch protection</H2>
      <P>Main and master branches are protected at the code level. The agent cannot write to them directly — all changes go to feature branches, and pull requests are created for review.</P>

      <H2>Processing locks</H2>
      <P>Each conversation has an <Code>is_processing</Code> lock to prevent concurrent execution. If a Lambda function crashes mid-execution, stale locks are automatically released after 5 minutes.</P>

      <H2>Web security</H2>
      <BulletList items={[
        "Cookie-based session authentication (Supabase Auth)",
        "Row Level Security (RLS) on all database tables",
        "Server-side API key proxy — cloud LLM keys never reach the browser",
        "CORS restricted to the application origin",
        <>Ollama calls go directly from browser to <Code>localhost</Code> — no server middleman</>,
      ]} />
    </>
  );
}
