import { PageHeader, H2, P, Code, CodeBlock, Callout, Table, NextPage } from "../components";

export default function CommandsPage() {
  return (
    <>
      <PageHeader title="Slash Commands" description="Quick actions in the web chat — type / to see all commands." />

      <P>Type <Code>/</Code> in the chat input to see available commands. Use arrow keys to navigate, Tab or Enter to select.</P>

      <H2>All commands</H2>
      <Table
        headers={["Command", "Args", "Description"]}
        rows={[
          [<code key="1" className="text-xs font-mono text-[#E8A87C]">/help</code>, "—", "Show all available commands"],
          [<code key="2" className="text-xs font-mono text-[#E8A87C]">/branch</code>, "[name]", "Switch to a branch or open the branch selector"],
          [<code key="3" className="text-xs font-mono text-[#E8A87C]">/branches</code>, "—", "List all branches with current/protected status"],
          [<code key="4" className="text-xs font-mono text-[#E8A87C]">/reset</code>, "—", "Clear execution state (plan, files, PR)"],
          [<code key="5" className="text-xs font-mono text-[#E8A87C]">/clear</code>, "—", "Start a new conversation"],
          [<code key="6" className="text-xs font-mono text-[#E8A87C]">/security</code>, "[path | pr N]", "Run a security scan"],
          [<code key="7" className="text-xs font-mono text-[#E8A87C]">/review</code>, "pr [N]", "List open PRs or review a specific PR"],
          [<code key="8" className="text-xs font-mono text-[#E8A87C]">/compact</code>, "—", "Force-compress conversation to save tokens"],
          [<code key="9" className="text-xs font-mono text-[#E8A87C]">/pr</code>, "—", "Create a pull request for current changes"],
          [<code key="10" className="text-xs font-mono text-[#E8A87C]">/diff</code>, "—", "Show all files changed in this conversation"],
          [<code key="11" className="text-xs font-mono text-[#E8A87C]">/undo</code>, "—", "Revert the last file change"],
        ]}
      />

      <Callout type="info">
        Commands like <Code>/security</Code>, <Code>/review</Code>, <Code>/compact</Code>, <Code>/diff</Code>, and <Code>/reset</Code> save their output to the conversation. You can use them as your first message — a conversation is created automatically.
      </Callout>

      <H2>Examples</H2>
      <CodeBlock>{`/security                  # Scan entire codebase
/security src/auth/        # Scan specific directory
/security pr 42            # Scan PR #42 diff
/review pr                 # List all open PRs
/review pr 15              # Review PR #15 in detail
/branch feature/new-api    # Switch to branch
/compact                   # Compress conversation history`}</CodeBlock>

      <NextPage href="/docs/plans" label="Plans & Execution" />
    </>
  );
}
