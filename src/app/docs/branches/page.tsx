import { PageHeader, H2, P, Code, CodeBlock, BulletList, Callout, NextPage } from "../components";

export default function BranchesPage() {
  return (
    <>
      <PageHeader title="Branch Management" description="How branches work in Codeteel — selection, creation, and protection." />

      <H2>Rules</H2>
      <BulletList items={[
        <><strong>Main/master are protected</strong> — cannot be selected as a working branch</>,
        <><strong>Not required for planning</strong> — you can search, ask questions, and get plans without a branch</>,
        <><strong>Required before execution</strong> — clicking [Approve] without a branch opens the branch selector</>,
        <><strong>Stored per conversation</strong> — the branch persists across page refreshes</>,
      ]} />

      <H2>Branch selector modal</H2>
      <P>The modal appears automatically when you approve a plan without a working branch. You can:</P>
      <BulletList items={[
        "Select an existing branch (protected branches shown as disabled with a lock icon)",
        <>Create a new branch from a base (auto-prefixed with <Code>feature/</Code>)</>,
      ]} />

      <H2>Commands</H2>
      <CodeBlock>{`/branch                     # Open branch selector modal
/branch feature/my-work     # Switch to existing branch
/branches                   # List all branches with status`}</CodeBlock>

      <H2>Platform branch commands</H2>
      <P>On Slack, Telegram, and Discord, branch management works via text commands:</P>
      <CodeBlock>{`# Slack
/codeteel branch feature/xyz
/codeteel branch create feature/xyz

# Telegram & Discord
/branch feature/xyz
/branch create feature/xyz`}</CodeBlock>

      <Callout type="info">
        Branch names must contain only alphanumeric characters, dots, underscores, dashes, and slashes.
      </Callout>

      <NextPage href="/docs/instructions" label="Custom Instructions" />
    </>
  );
}
