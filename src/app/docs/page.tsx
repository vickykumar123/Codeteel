import type { Metadata } from "next";
import { PageHeader, P, StepList, Callout, NextPage } from "./components";

export const metadata: Metadata = {
  title: "Documentation — Codeteel | Setup, Configuration, Platform Guides",
  description: "Learn how to set up Codeteel, configure Ollama and cloud LLM providers, index your codebase, connect Slack, Telegram, Discord, and use AI-powered code chat, PR review, and security scanning.",
};

export default function DocsIntroPage() {
  return (
    <>
      <PageHeader title="Introduction" description="Get started with Codeteel — your AI coding agent." />

      <P>Codeteel is an AI coding agent that connects to your GitHub repositories. It indexes your codebase, understands your code, and helps you make changes through natural conversation — from the web, Slack, Telegram, or Discord.</P>

      <StepList steps={[
        { title: "Create an account", description: "Sign up with email and password." },
        { title: "Connect GitHub", description: "Authorize Codeteel to access your repositories." },
        { title: "Add a repository", description: "Select a repo from the list. Codeteel stores the connection." },
        { title: "Configure LLM", description: "Go to Settings and add an LLM provider. Use Ollama for free local models, or paste an API key for cloud providers." },
        { title: "Configure Embeddings", description: "Add an embedding provider in Settings (required for semantic code search). OpenAI text-embedding-3-small is recommended." },
        { title: "Index your code", description: "On the repo page, click 'Index'. Codeteel reads every file, generates AI summaries, and creates searchable embeddings." },
        { title: "Start chatting", description: "Open the chat interface and ask questions or request code changes." },
      ]} />

      <Callout type="tip">
        <strong>Local models are free.</strong> Install Ollama, run <code className="text-[#E8A87C]">ollama serve</code>, and select it in Settings. Your code never leaves your machine.
      </Callout>

      <NextPage href="/docs/settings" label="Settings & Configuration" />
    </>
  );
}
