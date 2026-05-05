import { PageHeader, H2, P, CodeBlock, StepList, Callout, ChatExample, NextPage } from "../components";

export default function SlackPage() {
  return (
    <>
      <PageHeader title="Slack Integration" description="Connect Codeteel to your Slack workspace." />

      <H2>Setup</H2>
      <StepList steps={[
        { title: "Install Slack app", description: "Go to Settings and click 'Install to Slack'. Authorize the app for your workspace." },
        { title: "Connect a channel", description: "In Slack, type /codeteel connect owner/repo in the channel you want to use." },
        { title: "Start chatting", description: "Send messages in the channel. Codeteel responds with plans, diffs, and Block Kit buttons." },
      ]} />
      <Callout type="info">
        The bot automatically joins the channel when you run <code className="text-[#E8A87C]">/codeteel connect</code>. Team members in the channel can all use the agent.
      </Callout>

      <H2>Commands</H2>
      <CodeBlock>{`/codeteel connect owner/repo    # Connect channel to repo
/codeteel disconnect            # Unlink channel
/codeteel status                # Show connection info + branch
/codeteel branch feature/xyz    # Switch branch
/codeteel branch create feature/xyz  # Create and switch
/codeteel branches              # List all branches
/codeteel reset                 # Clear working branch
/codeteel clear                 # Clear conversation history
/codeteel security              # Full security scan
/codeteel security src/auth/    # Scoped scan
/codeteel security pr 5         # PR diff scan
/codeteel help                  # Show all commands`}</CodeBlock>

      <H2>Usage example</H2>
      <ChatExample messages={[
        { role: "user", text: "Add error handling to the payment webhook" },
        { role: "assistant", text: "📋 Plan: Add error handling (2 steps)\n1. MODIFY src/webhooks/payment.ts — Wrap handler in try/catch\n2. MODIFY src/webhooks/payment.ts — Add error logging\n\n[✅ Approve] [❌ Reject]" },
      ]} />
      <P>Click the Approve button or type &quot;yes&quot; to execute the plan.</P>

      <H2>How approval works</H2>
      <P>Slack shows Block Kit buttons below plan messages. You can approve/reject with buttons or by typing &quot;yes&quot;, &quot;go ahead&quot;, &quot;no&quot;, &quot;reject&quot;, etc.</P>

      <Callout type="tip">
        <strong>Branch selection:</strong> If no branch is set when you approve, Codeteel sends branch selection buttons. Pick an existing branch or create a new one.
      </Callout>

      <NextPage href="/docs/telegram" label="Telegram Guide" />
    </>
  );
}
