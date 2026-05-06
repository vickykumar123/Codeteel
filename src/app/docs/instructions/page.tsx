import { PageHeader, H2, P, Code, CodeBlock, Callout, NextPage } from "../components";

export default function InstructionsPage() {
  return (
    <>
      <PageHeader title="Custom Instructions" description="Configure how Codeteel writes code for you and your repos." />

      <H2>Two levels</H2>
      <P>Custom instructions let you guide the agent{"'"}s behavior. There are two levels that get merged together:</P>

      <H2>User instructions</H2>
      <P>Apply to <strong>all your repositories</strong>. Set them in <Code>/settings</Code> under the Custom Instructions section.</P>
      <CodeBlock>{`Example user instructions:

- Always use TypeScript strict mode
- Prefer functional components with hooks over class components
- Use snake_case for Python, camelCase for TypeScript
- Keep functions under 30 lines
- Add JSDoc comments to all public functions
- Never use 'any' type in TypeScript`}</CodeBlock>

      <H2>Repo instructions</H2>
      <P>Apply to a <strong>specific repository</strong> only. Set them on the repo detail page.</P>
      <CodeBlock>{`Example repo instructions:

- This project uses FastAPI with Pydantic v2
- All database queries go through the repository pattern in src/db/
- Error responses must follow RFC 7807 format
- Use pytest for tests, not unittest
- Environment variables are loaded from src/config.py`}</CodeBlock>

      <H2>How they work</H2>
      <P>Both levels are merged and injected into every agent interaction:</P>
      <CodeBlock>{`System prompt:
  [base agent instructions]
  [repo instructions]     ← first
  [user instructions]     ← second`}</CodeBlock>
      <P>The agent follows them when searching code, creating plans, writing code, and reviewing PRs. Custom instructions are also checked during code reviews — the agent verifies that code follows your guidelines.</P>

      <Callout type="tip">
        Be specific. &quot;Write clean code&quot; is too vague. &quot;Use early returns instead of nested if/else. Max 3 levels of nesting.&quot; gives the agent clear rules to follow.
      </Callout>

      <NextPage href="/docs/security" label="Security Scans" />
    </>
  );
}
