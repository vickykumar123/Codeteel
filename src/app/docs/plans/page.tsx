import { PageHeader, H2, P, CodeBlock, Callout, BulletList, NextPage } from "../components";

export default function PlansPage() {
  return (
    <>
      <PageHeader title="Plans & Execution" description="How Codeteel plans changes and executes them after your approval." />

      <H2>Plan format</H2>
      <P>When you request a code change, Codeteel creates a text-only plan. No code is shown at this stage — code is generated per step during execution.</P>
      <CodeBlock>{`📋 Add health endpoint

1. MODIFY src/webhook.py
   Add /health route that returns {status: ok}

2. MODIFY src/webhook.py
   Add import for json module

[Approve] [Reject]`}</CodeBlock>

      <H2>Approval methods</H2>
      <P>Three layers, from most reliable to least:</P>
      <BulletList items={[
        <><strong>UI buttons</strong> — Click [Approve] or [Reject]. 100% reliable.</>,
        <><strong>Text detection</strong> — Type &quot;yes&quot;, &quot;go ahead&quot;, &quot;proceed&quot;, &quot;lgtm&quot;, &quot;ship it&quot;. Detected before the LLM sees it.</>,
        <><strong>LLM fallback</strong> — Any other message while a plan is pending is interpreted by the LLM.</>,
      ]} />

      <H2>Execution flow</H2>
      <P>After approval, each step executes in order:</P>
      <BulletList items={[
        "Read the current file from GitHub (always fresh, includes prior step changes)",
        "LLM generates the exact code change for this step",
        "Change applied deterministically (exact string match + replace)",
        "Committed to the working branch",
        "Diff shown in the chat",
      ]} />

      <H2>Error handling</H2>
      <P>If a step fails (e.g., the target string is not found in the file), the agent retries up to 3 times with corrected context. Common scenarios:</P>
      <BulletList items={[
        <><strong>String not found</strong> — agent re-reads the file and adjusts the match</>,
        <><strong>Multiple matches</strong> — agent includes more surrounding context to make the match unique</>,
        <><strong>3 failures</strong> — step is marked as failed, error shown, execution continues to next step</>,
      ]} />

      <Callout type="tip">
        Plans can involve <strong>create</strong>, <strong>modify</strong>, and <strong>delete</strong> operations in a single plan. Files are read fresh before each step, so multi-step edits to the same file work correctly.
      </Callout>

      <NextPage href="/docs/branches" label="Branch Management" />
    </>
  );
}
