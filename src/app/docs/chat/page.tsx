import { PageHeader, H2, P, BulletList, ChatExample, Callout, NextPage } from "../components";

export default function ChatPage() {
  return (
    <>
      <PageHeader title="Web Chat Interface" description="Chat with Codeteel to ask questions, request changes, and review code." />

      <H2>Features</H2>
      <BulletList items={[
        "Full markdown rendering in responses",
        "Conversation sidebar — switch between past chats",
        "Branch status indicator in the header",
        "Real-time execution progress with step-by-step diffs",
        <>Slash command autocomplete (type <code className="text-[#E8A87C]">/</code> to see commands)</>,
        "10,000 character input limit with counter",
        "Stop button to abort running requests",
      ]} />

      <H2>Asking questions</H2>
      <P>Ask about your codebase in natural language. Codeteel searches your indexed files to find relevant context.</P>
      <ChatExample messages={[
        { role: "user", text: "What does the webhook handler do?" },
        { role: "assistant", text: "The webhook handler in `src/webhook.py` implements a FastAPI server that receives Telegram updates via HTTPS POST. It validates the request, parses the update, and routes it to the appropriate handler based on the message type..." },
      ]} />

      <H2>Requesting code changes</H2>
      <P>Describe what you want changed. Codeteel creates a plan for your review before writing any code.</P>
      <ChatExample messages={[
        { role: "user", text: "Add a /health endpoint that returns {status: ok}" },
        { role: "assistant", text: '📋 Plan: Add health endpoint\n\n1. MODIFY src/webhook.py — Add /health route\n2. MODIFY src/webhook.py — Add import\n\n[Approve] [Reject]' },
        { role: "user", text: "yes" },
        { role: "assistant", text: "Executing on branch feature/health...\n✅ Step 1/2 complete\n✅ Step 2/2 complete\n\nChanged 1 file: src/webhook.py" },
      ]} />

      <H2>Creating a PR</H2>
      <P>After making changes, ask for a pull request or use the <code className="text-[#E8A87C]">/pr</code> command.</P>
      <ChatExample messages={[
        { role: "user", text: "Create a PR for these changes" },
        { role: "assistant", text: "PR #42 created!\nhttps://github.com/you/repo/pull/42" },
      ]} />

      <Callout type="tip">
        Conversations persist across page refreshes. You can close the tab and come back to continue where you left off.
      </Callout>

      <NextPage href="/docs/commands" label="Slash Commands" />
    </>
  );
}
