import { PageHeader, H2, H3, P, Code, Callout, Table, NextPage } from "../components";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings & Configuration" description="Configure LLM providers, embeddings, and platform connections." />

      <H2>Web LLM Provider</H2>
      <P>The AI model used for the web chat interface. Choose from 8 providers:</P>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4">
        {["Ollama (local)", "OpenAI", "Claude", "Gemini", "Grok", "Qwen", "Fireworks", "Together"].map(p => (
          <div key={p} className="px-3 py-2 bg-[#292524] border border-[#3F3F46] rounded-lg text-xs text-[#A8A29E] text-center">{p}</div>
        ))}
      </div>
      <Callout type="info">
        <strong>Ollama</strong> runs locally — zero API cost and full privacy. Your code never leaves your computer. Install from <Code>ollama.com</Code> and run <Code>ollama serve</Code>. Codeteel auto-discovers available models.
      </Callout>
      <P>For cloud providers, enter your API key. Keys are encrypted with AES-256-GCM before storage — never stored in plaintext. The UI shows only the first 7 characters.</P>

      <H2>Platform LLM Provider</H2>
      <P>A separate LLM configuration for Slack, Telegram, and Discord. <strong>Cloud providers only</strong> — Ollama cannot work for platforms because the server cannot reach your local machine.</P>
      <P>One active platform provider at a time. Required if you want to use platform integrations.</P>

      <H2>Embedding Provider</H2>
      <P>Required for code indexing and semantic search. All providers output 1536-dimension vectors.</P>
      <Table
        headers={["Provider", "Model", "Price"]}
        rows={[
          ["OpenAI", "text-embedding-3-small", "$0.02/1M tokens"],
          ["Gemini", "text-embedding-004", "$0.015/1M tokens"],
          ["Mistral", "mistral-embed", "$0.10/1M tokens"],
          ["Voyage", "voyage-code-2", "$0.12/1M tokens"],
          ["Cohere", "embed-english-v3.0", "$0.10/1M tokens"],
        ]}
      />

      <NextPage href="/docs/indexing" label="Code Indexing" />
    </>
  );
}
