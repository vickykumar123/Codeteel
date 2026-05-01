import Link from "next/link";

export default function SlackGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Slack Integration Guide
          </h1>
          <Link
            href="/settings"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900"
          >
            ← Back to Settings
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Overview */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            How it works
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            Codeteel lets you interact with your codebase directly from Slack. Ask questions about your code,
            request changes, review PRs, and create pull requests — all without leaving your Slack workspace.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-blue-700 dark:text-blue-400 font-medium text-sm">1. Connect</div>
              <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">Add Codeteel to your Slack workspace and link a channel to a repo</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-blue-700 dark:text-blue-400 font-medium text-sm">2. Chat</div>
              <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">Send messages in the channel — Codeteel responds like a team member</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-blue-700 dark:text-blue-400 font-medium text-sm">3. Ship</div>
              <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">Approve plans, Codeteel writes the code and creates PRs</div>
            </div>
          </div>
        </section>

        {/* Setup Steps */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Setup
          </h2>
          <div className="space-y-4">
            <Step number={1} title="Configure Platform LLM">
              <p>Slack requires a cloud LLM provider (local Ollama won{"'"}t work from Slack). Go to{" "}
                <Link href="/settings" className="text-blue-600 hover:underline">Settings</Link> and add a
                provider under <strong>Platform LLM</strong> (OpenAI, Claude, Gemini, etc.).</p>
            </Step>
            <Step number={2} title="Add Codeteel to Slack">
              <p>Click the <strong>Add to Slack</strong> button in{" "}
                <Link href="/settings" className="text-blue-600 hover:underline">Settings → Integrations</Link>.
                Authorize the app for your workspace.</p>
            </Step>
            <Step number={3} title="Link a channel to a repo">
              <p>In any Slack channel, type:</p>
              <Code>/codeteel connect owner/repo</Code>
              <p className="mt-2">Codeteel will auto-join the channel and start listening. One channel = one repo.</p>
            </Step>
            <Step number={4} title="Start chatting">
              <p>Just type your questions or requests directly in the channel. No @mention needed.</p>
            </Step>
          </div>
        </section>

        {/* Commands */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Commands
          </h2>
          <div className="space-y-3">
            <CommandRow cmd="/codeteel help" desc="Show all commands" />
            <CommandRow cmd="/codeteel connect" desc="List available repos" />
            <CommandRow cmd="/codeteel connect owner/repo" desc="Link this channel to a repository" />
            <CommandRow cmd="/codeteel disconnect" desc="Unlink this channel from the repo" />
            <CommandRow cmd="/codeteel status" desc="Show connection info, current branch, index status" />
            <CommandRow cmd="/codeteel branch" desc="Show current working branch" />
            <CommandRow cmd="/codeteel branch feature/xyz" desc="Switch to a branch" />
            <CommandRow cmd="/codeteel branch create feature/xyz" desc="Create a new branch and switch to it" />
            <CommandRow cmd="/codeteel branches" desc="List all branches in the repo" />
            <CommandRow cmd="/codeteel reset" desc="Clear working branch" />
            <CommandRow cmd="/codeteel clear" desc="Clear conversation history, start fresh" />
          </div>
        </section>

        {/* Usage Examples */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Usage examples
          </h2>
          <div className="space-y-6">
            <Example
              title="Ask a question"
              messages={[
                { from: "user", text: "What does the webhook handler do?" },
                { from: "bot", text: "The webhook handler in src/integrations/telegram/webhook.py implements a FastAPI server that receives Telegram updates via HTTPS..." },
              ]}
            />
            <Example
              title="Make a code change"
              messages={[
                { from: "user", text: "Add a /health endpoint to the webhook server" },
                { from: "bot", text: "📋 Plan: Add /health endpoint (1 step)\n1. MODIFY src/integrations/telegram/webhook.py — Add GET /health route\n\n[✅ Approve] [❌ Reject]" },
                { from: "action", text: "User clicks ✅ Approve" },
                { from: "bot", text: "✅ Execution complete! Changed 1 file: src/integrations/telegram/webhook.py" },
              ]}
            />
            <Example
              title="Create a PR"
              messages={[
                { from: "user", text: "Create a PR" },
                { from: "bot", text: "🎉 PR #42 created! View Pull Request" },
              ]}
            />
            <Example
              title="Review PRs"
              messages={[
                { from: "user", text: "Review the open PRs" },
                { from: "bot", text: "Open Pull Requests (3):\n• #41 Add auth middleware\n• #40 Fix login bug\n• #39 Update README" },
              ]}
            />
          </div>
        </section>

        {/* Tips */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tips
          </h2>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>One channel = one repo.</strong> Use separate channels for different repos (e.g. #bot-frontend, #bot-backend).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>Set the branch first.</strong> Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/codeteel branch feature/xyz</code> before requesting code changes.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>Wait for the bot to finish.</strong> If you send multiple messages, the bot will ask you to wait while it processes the previous one.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>Private channels work too.</strong> Invite Codeteel to a private channel for sensitive repos.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>Conversations sync.</strong> Slack conversations appear in the web interface too, so you can continue from either platform.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>Use /codeteel clear</strong> to start a fresh conversation if the bot gets confused.</span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

// ===========================================
// COMPONENTS
// ===========================================

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div>
        <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{children}</div>
      </div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono text-gray-800 dark:text-gray-200 overflow-x-auto">
      {children}
    </pre>
  );
}

function CommandRow({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <code className="flex-shrink-0 text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-blue-700 dark:text-blue-400">
        {cmd}
      </code>
      <span className="text-sm text-gray-600 dark:text-gray-400 pt-0.5">{desc}</span>
    </div>
  );
}

function Example({ title, messages }: { title: string; messages: { from: string; text: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</h3>
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-2 ${msg.from === "action" ? "justify-center" : ""}`}>
            {msg.from === "user" && (
              <>
                <div className="w-6 h-6 bg-green-500 rounded text-white text-xs flex items-center justify-center font-bold flex-shrink-0">U</div>
                <div className="text-sm text-gray-800 dark:text-gray-200">{msg.text}</div>
              </>
            )}
            {msg.from === "bot" && (
              <>
                <div className="w-6 h-6 bg-purple-600 rounded text-white text-xs flex items-center justify-center font-bold flex-shrink-0">C</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{msg.text}</div>
              </>
            )}
            {msg.from === "action" && (
              <div className="text-xs text-gray-400 dark:text-gray-500 italic">{msg.text}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
