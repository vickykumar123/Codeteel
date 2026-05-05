import { PageHeader, H2, P, Code, Callout, Table, NextPage } from "../components";

export default function ModelsPage() {
  return (
    <>
      <PageHeader title="LLM Providers" description="All supported AI model providers and how to configure them." />

      <H2>Supported providers</H2>
      <Table
        headers={["Provider", "Type", "Notes"]}
        rows={[
          ["Ollama", "Local", "Free, private. Any model you pull — Llama, DeepSeek, Qwen, Mistral, CodeGemma, Phi, etc."],
          ["OpenAI", "Cloud", "Any OpenAI model — GPT-4o, GPT-4.1, o3-mini, etc."],
          ["Claude", "Cloud", "Any Anthropic model — Claude Sonnet, Opus, Haiku"],
          ["Gemini", "Cloud", "Any Google model — Gemini Pro, Flash, etc."],
          ["Grok", "Cloud", "Any xAI model — Grok 2, Grok 3, etc."],
          ["Qwen", "Cloud", "Any Alibaba model — Qwen 2.5, Qwen-Max, etc."],
          ["Fireworks", "Cloud", "Any model on Fireworks — Llama, Mixtral, DeepSeek, etc."],
          ["Together", "Cloud", "Any model on Together — Llama, Code Llama, etc."],
        ]}
      />
      <Callout type="tip">
        You type the model name yourself in Settings — Codeteel doesn{"'"}t restrict which models you can use. Any model available from the provider will work, as long as it supports the OpenAI-compatible chat completions API.
      </Callout>

      <H2>Web vs Platform</H2>
      <P>Codeteel has two separate LLM configurations:</P>
      <Table
        headers={["", "Web LLM", "Platform LLM"]}
        rows={[
          ["Used by", "Browser chat interface", "Slack, Telegram, Discord"],
          ["Ollama", "Yes (direct browser → localhost)", "No (server can't reach localhost)"],
          ["Cloud providers", "Yes (via SSE proxy)", "Yes (via Lambda)"],
          ["API key storage", "Encrypted (AES-256-GCM)", "Encrypted (AES-256-GCM)"],
        ]}
      />

      <Callout type="info">
        <strong>Ollama for web:</strong> When using Ollama, LLM calls go directly from your browser to <Code>localhost:11434</Code>. No proxy, no API key, no server involved. Your code and prompts never leave your machine.
      </Callout>

      <H2>Setting up Ollama</H2>
      <P>Install Ollama from <Code>ollama.com</Code>, then:</P>
      <pre className="bg-[#1C1917] border border-[#292524] rounded-xl p-4 my-4 text-xs text-[#A8A29E] font-mono">
{`# Start the server
ollama serve

# Pull a model (example)
ollama pull deepseek-coder-v2:16b

# Codeteel auto-discovers available models in Settings`}
      </pre>

      <H2>Setting up cloud providers</H2>
      <P>For any cloud provider:</P>
      <ol className="list-decimal list-inside text-sm text-[#A8A29E] space-y-1 ml-4 my-3">
        <li>Go to Settings</li>
        <li>Click &quot;Add Provider&quot;</li>
        <li>Select the provider</li>
        <li>Paste your API key</li>
        <li>Enter the model name (e.g., <Code>gpt-4o</Code>)</li>
        <li>Set as active</li>
      </ol>

      <Callout type="tip">
        API keys are encrypted with AES-256-GCM before storage. The UI only shows the first 7 characters.
      </Callout>

      <NextPage href="/docs/encryption" label="Security & Encryption" />
    </>
  );
}
