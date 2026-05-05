import Link from "next/link";

export default function DiscordGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Discord Integration Guide
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
            Codeteel integrates with Discord using slash commands. Ask questions about your codebase,
            request code changes, review PRs, and create pull requests — all from your Discord server.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <div className="text-indigo-700 dark:text-indigo-400 font-medium text-sm">1. Connect</div>
              <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">Click &quot;Connect Discord&quot; on a repo page and open the link in Discord</div>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <div className="text-indigo-700 dark:text-indigo-400 font-medium text-sm">2. Chat</div>
              <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">Use <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">/ask</code> to send messages to the bot</div>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <div className="text-indigo-700 dark:text-indigo-400 font-medium text-sm">3. Ship</div>
              <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">Approve plans with buttons, code gets committed and PRs created</div>
            </div>
          </div>
        </section>

        {/* Important Note */}
        <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-amber-500 text-lg">!</span>
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <strong>Discord uses slash commands only.</strong> Unlike Slack and Telegram, Discord
              does not support regular text messages to bots in servers. Use <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">/ask</code> to
              send messages and questions to Codeteel.
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
              <p>Discord requires a cloud LLM provider (local Ollama won{"'"}t work). Go to{" "}
                <Link href="/settings" className="text-indigo-600 hover:underline">Settings</Link> and add a
                provider under <strong>Platform LLM</strong> (OpenAI, Claude, Gemini, etc.).</p>
            </Step>
            <Step number={2} title="Add the bot to your server">
              <p>Go to the repository page and click <strong>Connect Discord</strong> in the
                Platform Connections section. This generates an invite link — click it to add
                the Codeteel bot to your Discord server.</p>
            </Step>
            <Step number={3} title="Connect a channel">
              <p>In the Discord channel you want to use, run:</p>
              <code className="block mt-2 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded text-sm font-mono text-indigo-700 dark:text-indigo-400">
                /connect token:YOUR_TOKEN
              </code>
              <p className="mt-2">The token is shown on the repo page after clicking Connect Discord. It expires in 5 minutes.</p>
            </Step>
            <Step number={4} title="Start using slash commands">
              <p>Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/ask</code> to
                send messages and <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/help</code> to
                see all available commands.</p>
            </Step>
          </div>
        </section>

        {/* Commands */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Commands
          </h2>
          <div className="space-y-3">
            <CommandGroup title="Messaging">
              <CommandRow cmd="/ask message" desc="Send a message or question to Codeteel" />
            </CommandGroup>
            <CommandGroup title="Connection">
              <CommandRow cmd="/connect token:TOKEN" desc="Connect this channel to a repository" />
              <CommandRow cmd="/disconnect" desc="Unlink this channel from the repo" />
              <CommandRow cmd="/status" desc="Show connection info, current branch, index status" />
            </CommandGroup>
            <CommandGroup title="Branches">
              <CommandRow cmd="/branch" desc="Show current working branch" />
              <CommandRow cmd="/branch name:feature/xyz" desc="Switch to a branch" />
              <CommandRow cmd="/branch name:feature/xyz create:true" desc="Create a new branch and switch to it" />
              <CommandRow cmd="/branches" desc="List all branches in the repo" />
              <CommandRow cmd="/reset" desc="Clear working branch" />
            </CommandGroup>
            <CommandGroup title="Security & Review">
              <CommandRow cmd="/security" desc="Scan codebase for security vulnerabilities" />
              <CommandRow cmd="/security path:src/auth/" desc="Scan specific path" />
              <CommandRow cmd="/security pr:42" desc="Scan a PR diff for vulnerabilities" />
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
                { from: "user", text: "/ask What does the webhook handler do?" },
                { from: "bot", text: "The webhook handler implements a FastAPI server that receives Telegram updates via HTTPS..." },
              ]}
            />
            <Example
              title="Make a code change"
              messages={[
                { from: "user", text: "/ask Add a /health endpoint to the webhook server" },
                { from: "bot", text: "Plan: Add /health endpoint (1 step)\n1. MODIFY src/integrations/telegram/webhook.py\n\n[Approve] [Reject]" },
                { from: "action", text: "User clicks Approve" },
                { from: "bot", text: "Executing plan...\nExecution complete! Changed 1 file" },
              ]}
            />
            <Example
              title="Create a PR"
              messages={[
                { from: "user", text: "/ask Create a PR" },
                { from: "bot", text: "PR #42 created! View Pull Request" },
              ]}
            />
            <Example
              title="Security scan"
              messages={[
                { from: "user", text: "/security path:src/auth/" },
                { from: "bot", text: "Security scan started on src/auth/...\n\nNo critical or high security issues found in the scanned files." },
              ]}
            />
            <Example
              title="Switch branch"
              messages={[
                { from: "user", text: "/branch name:feature/new-api create:true" },
                { from: "bot", text: "Branch feature/new-api created and set as working branch." },
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
              <span className="text-indigo-500 mt-0.5">{"•"}</span>
              <span><strong>Always use /ask.</strong> Discord requires slash commands — you cannot send regular messages to the bot in a server channel.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5">{"•"}</span>
              <span><strong>One channel = one repo.</strong> To switch repos, disconnect and reconnect from the repo page.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5">{"•"}</span>
              <span><strong>Set the branch first.</strong> Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/branch name:feature/xyz</code> before requesting code changes.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5">{"•"}</span>
              <span><strong>Approve with buttons.</strong> Click the buttons below plan messages to approve or reject.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5">{"•"}</span>
              <span><strong>Or type &quot;yes&quot;.</strong> You can also approve by sending <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/ask yes</code> or <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/ask go ahead</code>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5">{"•"}</span>
              <span><strong>Connect token expires.</strong> The token is valid for 5 minutes. Generate a new one from the repo page if it expires.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5">{"•"}</span>
              <span><strong>Conversations sync.</strong> Discord conversations appear in the web interface too.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5">{"•"}</span>
              <span><strong>Use /clear</strong> to start a fresh conversation if the bot gets confused.</span>
            </li>
          </ul>
        </section>

        {/* Discord vs Telegram vs Slack */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Platform comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="py-2 pr-4">Feature</th>
                  <th className="py-2 pr-4">Discord</th>
                  <th className="py-2 pr-4">Telegram</th>
                  <th className="py-2">Slack</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 dark:text-gray-400">
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 pr-4 font-medium">Setup</td>
                  <td className="py-2 pr-4">Invite bot + /connect</td>
                  <td className="py-2 pr-4">Click link from repo page</td>
                  <td className="py-2">OAuth + /codeteel connect</td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 pr-4 font-medium">Messaging</td>
                  <td className="py-2 pr-4">Slash commands only (/ask)</td>
                  <td className="py-2 pr-4">Regular text messages</td>
                  <td className="py-2">Regular text messages</td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 pr-4 font-medium">Buttons</td>
                  <td className="py-2 pr-4">Action row buttons</td>
                  <td className="py-2 pr-4">Inline keyboard</td>
                  <td className="py-2">Block Kit buttons</td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 pr-4 font-medium">Commands</td>
                  <td className="py-2 pr-4">/branch, /status, /help</td>
                  <td className="py-2 pr-4">/branch, /status, /help</td>
                  <td className="py-2">/codeteel branch, status</td>
                </tr>
                <tr className="border-b dark:border-gray-700">
                  <td className="py-2 pr-4 font-medium">Formatting</td>
                  <td className="py-2 pr-4">Discord embeds</td>
                  <td className="py-2 pr-4">Markdown</td>
                  <td className="py-2">Slack mrkdwn</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Works in</td>
                  <td className="py-2 pr-4">Server channels</td>
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
      <div className="flex-shrink-0 w-8 h-8 bg-[#5865F2] text-white rounded-full flex items-center justify-center text-sm font-bold">
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
      <code className="flex-shrink-0 text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono text-indigo-700 dark:text-indigo-400">
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
                <div className="w-6 h-6 bg-[#5865F2] rounded text-white text-xs flex items-center justify-center font-bold flex-shrink-0">C</div>
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
