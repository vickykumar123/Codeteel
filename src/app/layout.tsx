import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Codeteel — Open Source AI Coding Agent | Local LLM, Slack, Telegram, Discord",
  description: "Self-hosted AI coding agent that connects to your local Ollama models. Code from Web, Slack, Telegram, or Discord. ReAct architecture, human-in-the-loop plan approval, deterministic edits, PR creation. Supports DeepSeek, Llama, Qwen, Mistral, OpenAI, Claude, Gemini. Free, open source, privacy-first.",
  keywords: [
    "AI coding agent",
    "open source AI code assistant",
    "self-hosted coding tool",
    "local LLM coding",
    "Ollama coding agent",
    "AI code review",
    "Slack coding bot",
    "Telegram coding bot",
    "Discord coding bot",
    "ReAct agent",
    "AI pair programming",
    "private AI coding",
    "local-first AI",
    "code generation tool",
    "AI pull request",
    "DeepSeek coding",
    "Llama coding",
    "Qwen coding",
    "Cursor alternative",
    "Cline alternative",
    "Devin alternative",
    "Copilot alternative",
    "CodeRabbit alternative",
    "Sweep AI alternative",
    "free AI coding tool",
    "self-hosted code assistant",
    "multi-platform AI agent",
    "AI code assistant open source",
    "best open source coding agent",
    "local AI coding assistant",
    "AI agent for developers",
    "autonomous coding agent",
    "AI code generation tool",
  ],
  authors: [{ name: "Codeteel" }],
  creator: "Codeteel",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://codeteel.com",
    siteName: "Codeteel",
    title: "Codeteel — Open Source AI Coding Agent",
    description: "The first AI coding agent that runs on your own models. Code from Web, Slack, Telegram, or Discord. Free, open source, privacy-first.",
    images: [{ url: "/logo.svg", width: 512, height: 512, alt: "Codeteel Logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Codeteel — Open Source AI Coding Agent",
    description: "Self-hosted AI coding agent with local Ollama support. Web, Slack, Telegram, Discord. Free and open source.",
    images: ["/logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
