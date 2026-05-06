import { PageHeader, H2, P, CodeBlock, ChatExample, BulletList, NextPage } from "../components";

export default function ReviewsPage() {
  return (
    <>
      <PageHeader title="PR & Issue Reviews" description="Get thorough code reviews and issue analysis from Codeteel." />

      <H2>PR review</H2>
      <P>List open PRs or review a specific one in detail:</P>
      <CodeBlock>{`/review pr            # List all open PRs
/review pr 42         # Review PR #42 in detail`}</CodeBlock>
      <P>Reviews include:</P>
      <BulletList items={[
        <><strong>Summary</strong> — what the PR does in 1-2 sentences</>,
        <><strong>Issues found</strong> — prioritized: security {">"} bugs {">"} performance {">"} style</>,
        <><strong>Suggestions</strong> — specific improvements with file names and line references</>,
        <><strong>Verdict</strong> — APPROVE, REQUEST_CHANGES, or COMMENT with reasoning</>,
      ]} />
      <P>If you have custom instructions configured, the review also checks that code follows your guidelines.</P>

      <H2>Issue review</H2>
      <P>Ask the agent to review GitHub issues directly in chat:</P>
      <ChatExample messages={[
        { role: "user", text: "Review issue #15" },
        { role: "assistant", text: "**Issue #15: Add rate limiting to auth endpoints**\n\n**Impact:** High\n**Suggested approach:** Add express-rate-limit middleware to /login, /signup, and /reset-password routes. Configure: 5 attempts per 15 minutes per IP.\n**Complexity:** Moderate" },
      ]} />
      <P>Issue reviews include impact assessment, suggested implementation approach, and complexity estimate.</P>

      <NextPage href="/docs/platforms" label="Platform Integrations" />
    </>
  );
}
