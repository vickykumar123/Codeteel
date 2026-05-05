import { PageHeader, H2, P, Code, Callout, Table, NextPage } from "../components";

export default function PlatformsPage() {
  return (
    <>
      <PageHeader title="Platform Integrations" description="Use Codeteel from Slack, Telegram, and Discord." />

      <P>All platforms share the same agent pipeline — you get the same capabilities everywhere. The difference is how messages are sent and how buttons look.</P>

      <H2>Architecture</H2>
      <P>Platform messages flow through:</P>
      <div className="bg-[#1C1917] border border-[#292524] rounded-xl p-4 my-4 text-xs text-[#A8A29E] font-mono text-center">
        Webhook → SQS Queue → Lambda → Orchestrator → Platform API
      </div>
      <P>This architecture handles long-running agent tasks (up to 15 minutes) without hitting webhook timeout limits.</P>

      <H2>Requirements</H2>
      <Callout type="warning">
        Platforms require a <strong>cloud LLM provider</strong> configured in Settings under Platform LLM. Ollama does not work because the server cannot reach your local machine.
      </Callout>

      <H2>Platform comparison</H2>
      <Table
        headers={["Feature", "Web", "Slack", "Telegram", "Discord"]}
        rows={[
          ["Messaging", "Text input", "Channel messages", "Direct messages", "/ask command"],
          ["Approval", "UI buttons", "Block Kit buttons", "Inline keyboard", "Action rows"],
          ["Setup", "Built-in", "OAuth install", "Connect link", "Bot invite + /connect"],
          ["LLM", "Local or cloud", "Cloud only", "Cloud only", "Cloud only"],
          ["Commands", "/ commands", "/codeteel ...", "/command", "/command"],
          ["Formatting", "Markdown", "Slack mrkdwn", "Markdown", "Discord embeds"],
          ["Msg limit", "10,000 chars", "4,000 chars", "4,096 chars", "2,000 chars"],
        ]}
      />

      <H2>One channel = one repo</H2>
      <P>Each platform channel can be connected to exactly one repository. To switch repos, disconnect the current one and connect the new one. Team members with access to the channel can all interact with the agent.</P>

      <NextPage href="/docs/slack" label="Slack Guide" />
    </>
  );
}
