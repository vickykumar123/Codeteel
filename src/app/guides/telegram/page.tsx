import Link from "next/link";

export default function TelegramGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Telegram Integration Guide
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
            Codeteel lets you interact with your codebase directly from Telegram. Ask questions, request changes,
            review PRs, and create pull requests — all from a Telegram chat.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-blue-700 dark:text-blue-400 font-medium text-sm">1. Connect</div>
              <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">Click "Connect Telegram" on a repo page and open the link</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-blue-700 dark:text-blue-400 font-medium text-sm">2. Chat</div>
              <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">Send messages to the bot — it responds like a team member</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-blue-700 dark:text-blue-400 font-medium text-sm">3. Ship</div>
              <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">Approve plans with inline buttons, code gets committed and PRs created</div>
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
              <p>Telegram requires a cloud LLM provider (local Ollama won{"'"}t work). Go to{" "}
                <Link href="/settings" className="text-blue-600 hover:underline">Settings</Link> and add a
                provider under <strong>Platform LLM</strong> (OpenAI, Claude, Gemini, etc.).</p>
            </Step>
            <Step number={2} title="Go to a repo page">
              <p>Navigate to the repository you want to connect. Make sure it{"'"}s indexed first.</p>
            </Step>
            <Step number={3} title='Click "Connect Telegram"'>
              <p>In the <strong>Platform Connections</strong> section, click the <strong>Connect Telegram</strong> button.
                A link will be generated (valid for 5 minutes).</p>
            </Step>
            <Step number={4} title="Open the link">
              <p>Click the link — it opens Telegram and starts a chat with @CodeteelBot.
                The bot automatically connects your chat to the repo.</p>
            </Step>
            <Step number={5} title="Start chatting">
              <p>Send messages directly in the chat. Use /help to see available commands.</p>
            </Step>
          </div>
        </section>

        {/* Commands */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Commands
          </h2>
          <div className="space-y-3">
            <CommandGroup title="Connection">
              <CommandRow cmd="/connect" desc="List available repos" />
              <CommandRow cmd="/disconnect" desc="Unlink this chat from the repo" />
              <CommandRow cmd="/status" desc="Show connection info, current branch, index status" />
            </CommandGroup>
            <CommandGroup title="Branches">
              <CommandRow cmd="/branch" desc="Show current working branch" />
              <CommandRow cmd="/branch feature/xyz" desc="Switch to a branch" />
              <CommandRow cmd="/branch create feature/xyz" desc="Create a new branch and switch to it" />
              <CommandRow cmd="/branches" desc="List all branches in the repo" />
              <CommandRow cmd="/reset" desc="Clear working branch" />
            </CommandGroup>
            <CommandGroup title="Other">
              <CommandRow cmd="/clear" desc="Clear conversation history, start fresh" />
              <CommandRow cmd="/help" desc="Show all commands" />
            </CommandGroup>
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
                { from: "bot", text: "The webhook handler implements a FastAPI server that receives Telegram updates via HTTPS..." },
              ]}
            />
            <Example
              title="Make a code change"
              messages={[
                { from: "user", text: "Add a /health endpoint to the webhook server" },
                { from: "bot", text: "📋 Plan: Add /health endpoint (1 step)\n1. MODIFY src/integrations/telegram/webhook.py\n\n[✅ Approve] [❌ Reject]" },
                { from: "action", text: "User taps ✅ Approve" },
                { from: "bot", text: "⚙️ Executing plan...\n✅ Execution complete! Changed 1 file" },
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
              title="Switch branch"
              messages={[
                { from: "user", text: "/branch create feature/new-api" },
                { from: "bot", text: "🔀 Branch feature/new-api created and set as working branch." },
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
              <span><strong>One chat = one repo.</strong> To switch repos, disconnect and reconnect from the repo page.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>Set the branch first.</strong> Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/branch feature/xyz</code> before requesting code changes.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>Approve with buttons.</strong> Tap the inline buttons below plan messages to approve or reject.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>Or type "yes".</strong> You can also approve by typing "yes", "go ahead", or "do it".</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>Connect link expires.</strong> The connection link is valid for 5 minutes. Generate a new one if it expires.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>Conversations sync.</strong> Telegram conversations appear in the web interface too.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">{"•"}</span>
              <span><strong>Use /clear</strong> to start a fresh conversation if the bot gets confused.</span>
            </li>
          </ul>
        </section>

        {/* Differences from Slack */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Telegram vs Slack
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="py-2 pr-4">Feature</th>
                  <th className="py-2 pr-4">Telegram</th>
                  <th className="py-2">Slack</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 dark:text-gray-400">
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 pr-4 font-medium">Setup</td>
                  <td className="py-2 pr-4">Click link from repo page</td>
                  <td className="py-2">OAuth + /codeteel connect</td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 pr-4 font-medium">Buttons</td>
                  <td className="py-2 pr-4">Inline keyboard</td>
                  <td className="py-2">Block Kit buttons</td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 pr-4 font-medium">Commands</td>
                  <td className="py-2 pr-4">/branch, /status, /help</td>
                  <td className="py-2">/codeteel branch, /codeteel status</td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 pr-4 font-medium">Formatting</td>
                  <td className="py-2 pr-4">Markdown</td>
                  <td className="py-2">Slack mrkdwn</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Works in</td>
                  <td className="py-2 pr-4">DM or group chat</td>
                  <td className="py-2">Channel or DM</td>
                </tr>
              </tbody>
            </table>
          </div>
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
      <div className="flex-shrink-0 w-8 h-8 bg-[#0088cc] text-white rounded-full flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div>
        <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{children}</div>
      </div>
    </div>
  );
}

function CommandGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CommandRow({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <code className="flex-shrink-0 text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono text-blue-700 dark:text-blue-400">
        {cmd}
      </code>
      <span className="text-sm text-gray-600 dark:text-gray-400">{desc}</span>
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
                <div className="w-6 h-6 bg-[#0088cc] rounded text-white text-xs flex items-center justify-center font-bold flex-shrink-0">C</div>
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
