import { PageHeader, H2, P, Code, CodeBlock, StepList, Callout, ChatExample, NextPage } from "../components";

export default function DiscordPage() {
  return (
    <>
      <PageHeader title="Discord Integration" description="Use Codeteel in your Discord server with slash commands." />

      <Callout type="warning">
        Discord requires slash commands — you cannot send regular text messages to the bot. Use <Code>/ask</Code> for all messages and questions.
      </Callout>

      <H2>Setup</H2>
      <StepList steps={[
        { title: "Add bot to server", description: "On the repo page, click 'Connect Discord'. Click the invite link to add the bot." },
        { title: "Connect a channel", description: "In Discord, run /connect token:YOUR_TOKEN (shown on repo page, valid 5 minutes)." },
        { title: "Use /ask", description: "Send messages with /ask message:your question here." },
      ]} />

      <H2>Commands</H2>
      <CodeBlock>{`/ask message:your question      # Send a message to Codeteel
/connect token:TOKEN            # Connect channel to repo
/disconnect                     # Unlink channel
/status                         # Show connection info
/branch name:feature/xyz        # Switch branch
/branch name:feature/xyz create:true  # Create and switch
/branches                       # List all branches
/reset                          # Clear working branch
/clear                          # Clear conversation history
/security                       # Full security scan
/security path:src/auth/        # Scoped scan
/security pr:42                 # PR diff scan
/help                           # Show all commands`}</CodeBlock>

      <H2>Usage example</H2>
      <ChatExample messages={[
        { role: "user", text: "/ask Add a /health endpoint to the server" },
        { role: "assistant", text: "Plan: Add health endpoint (1 step)\n1. MODIFY src/server.py — Add /health route\n\n[Approve] [Reject]" },
      ]} />
      <P>Click the Approve button or send <Code>/ask yes</Code> to execute.</P>

      <H2>Discord-specific notes</H2>
      <P>Discord uses <strong>embeds</strong> for rich formatting and <strong>action rows</strong> for buttons. Messages are split at 2,000 characters (Discord{"'"}s limit). Commands are registered as guild commands for instant availability (no 1-hour delay).</P>

      <Callout type="tip">
        Approval also works with text: <Code>/ask yes</Code>, <Code>/ask go ahead</Code>, <Code>/ask lgtm</Code>, etc.
      </Callout>

      <NextPage href="/docs/models" label="LLM Providers" />
    </>
  );
}
