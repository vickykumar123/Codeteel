<p align="center">
  <img src="public/logo.svg" width="80" height="80" alt="Codeteel" />
</p>

<h1 align="center">Codeteel</h1>

<p align="center">
  <strong>Code from anywhere, ship from everywhere.</strong><br/>
  The first AI coding agent that runs on your own models and works from Slack, Telegram, Discord, and Web.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-AGPL--3.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/Tests-95%25+-green" alt="Tests" />
  <img src="https://img.shields.io/badge/Platforms-4-orange" alt="Platforms" />
  <img src="https://img.shields.io/badge/Languages-30+-purple" alt="Languages" />
  <img src="https://img.shields.io/badge/LLM_Providers-8-red" alt="LLM Providers" />
</p>

---

## What is Codeteel?

Codeteel is an open-source AI coding agent that connects to your GitHub repositories and lets you interact with your codebase through natural conversation. It indexes your code, understands its structure, creates implementation plans for your approval, writes code, and opens pull requests.

**Key differentiators:**
- **Local models** -- Run Ollama locally. Zero API cost. Your code never leaves your machine.
- **4 platforms** -- Web UI, Slack, Telegram, Discord. Same agent everywhere.
- **Human-in-the-loop** -- Plan approval before any code is written. You stay in control.
- **30+ languages** -- JavaScript, TypeScript, Python, Go, Rust, Java, and more.
- **8 LLM providers** -- Ollama, OpenAI, Claude, Gemini, Grok, Qwen, Fireworks, Together.

## Architecture

```
                         +----------------------------------------------+
                         |              Web Browser                     |
                         |                                              |
                         |   useOrchestrator() -- React hook            |
                         |     |-- Orchestrator (ReAct loop)            |
                         |     |-- Search Agent (semantic + grep)       |
                         |     |-- Planner Agent (text plans)           |
                         |     |-- Executor Agent (deterministic edits) |
                         |     +-- LLM calls -> Ollama (localhost)      |
                         |              or -> /api/llm/chat proxy       |
                         |                                              |
                         |   fetch() -> /api/* (thin proxy routes)      |
                         +--------------------+-------------------------+
                                              |
                    +-------------------------+-------------------------+
                    |            Vercel (Next.js API)                    |
                    |                                                    |
                    |   /api/repos/[id]/search  -> Supabase             |
                    |   /api/repos/[id]/files   -> GitHub API           |
                    |   /api/repos/[id]/branches -> GitHub              |
                    |   /api/repos/[id]/pr      -> GitHub               |
                    |   /api/llm/chat           -> LLM (SSE streaming)  |
                    |   /api/slack/events       -> SQS                  |
                    |   /api/telegram/webhook   -> SQS                  |
                    |   /api/discord/interactions -> SQS                |
                    +-------------------------+-------------------------+
                                              |
              +-------------------------------+-------------------------------+
              |                         AWS Lambda                             |
              |                                                                |
              |   SQS -> processMessage()                                      |
              |     |-- Resolve platform context                               |
              |     |-- Load conversation + execution state                    |
              |     |-- Run orchestrator (same code as web)                    |
              |     +-- Send response via Platform API                         |
              |         (Slack Block Kit / Telegram / Discord)                 |
              +----------------------------------------------------------------+
```

### Web: Orchestrator runs in the browser
For the web UI, the agent loop runs client-side. LLM calls go directly to Ollama (localhost) or through a server proxy for cloud providers. Secrets (GitHub tokens, API keys) stay server-side.

### Platforms: Orchestrator runs in Lambda
For Slack, Telegram, and Discord, webhooks push messages to SQS. Lambda processes them using the same orchestrator code with `ServerToolExecutor` (direct DB/GitHub access instead of HTTP fetch).

## How the Orchestrator Works

Codeteel uses a **ReAct (Reasoning + Acting)** agent loop:

```
User message
    |
    v
+--- Orchestrator Loop (max 20 iterations) ---+
|                                              |
|  1. Build system prompt + context            |
|     (custom instructions, search journal,    |
|      files changed, failure state)           |
|                                              |
|  2. Call LLM with tools                      |
|     |                                        |
|  3. LLM returns:                             |
|     |-- Text -> return to user (stream)      |
|     |-- Tool call -> execute tool            |
|     |   |-- think (reasoning)                |
|     |   |-- delegate_to_search               |
|     |   |-- delegate_to_planner              |
|     |   |-- execute_plan                     |
|     |   |-- delete_files                     |
|     |   |-- create_pr                        |
|     |   |-- review_pr / review_issue         |
|     |   |-- security_scan                    |
|     |   +-- web_search / web_fetch           |
|     +-- JSON as text -> recoverToolCall()    |
|                                              |
|  4. Feed tool result back -> goto 2          |
+----------------------------------------------+
```

### Tool Call Recovery
OSS models (via Ollama) sometimes output tool calls as plain JSON text instead of structured function calls. Codeteel detects and recovers:
- `{"request": "..."}` -> `delegate_to_planner`
- `{"question": "..."}` -> `delegate_to_search`
- `{"paths": [...]}` -> `delete_files`
- `{"title": "...", "body": "..."}` -> `create_pr`

### Plan -> Approve -> Execute

```
1. User: "Add a health endpoint"
2. Agent searches codebase, reads files
3. Planner creates text plan:
   - MODIFY src/server.py -- Add /health route
4. User reviews and clicks [Approve]
5. Executor reads file from GitHub (fresh)
6. LLM generates old_string/new_string per step
7. applyEdit() applies deterministically
8. Committed to branch, diff shown
9. User: "/pr" -> PR created
```

Plans are **text-only descriptions** (what to do). Code is generated per step at execution time (how to do it). This means:
- Each step reads the latest file (includes prior step changes)
- User reviews the approach, not pages of code
- Diffs are shown after execution (actual changes, not predicted)

## Tools

### Orchestrator Tools
| Tool | Purpose |
|------|---------|
| `think` | Reason about the request before acting |
| `delegate_to_search` | Search codebase (semantic, text, grep) |
| `delegate_to_planner` | Create implementation plan |
| `execute_plan` | Execute approved plan |
| `delete_files` | Delete files (bypasses planner) |
| `create_pr` | Create pull request |
| `review_pr` | Review a PR or list open PRs |
| `review_issue` | Review an issue or list open issues |
| `security_scan` | Scan codebase for vulnerabilities |
| `web_search` | Search the web (DuckDuckGo) |
| `web_fetch` | Fetch a URL |
| `request_branch_selection` | Ask user to select a branch |
| `respond_to_user` | Send a text response |

### Search Tools (sub-agent)
| Tool | Purpose |
|------|---------|
| `semantic_search` | Vector similarity search (1536-dim embeddings) |
| `text_search` | Trigram text search (pg_trgm) |
| `grep` | Regex pattern search with context lines |
| `read_file` | Read file content (with line ranges) |
| `list_files` | List files by language/pattern |

### Planner Tools (sub-agent)
| Tool | Purpose |
|------|---------|
| `semantic_search` | Find relevant files |
| `read_file` | Read file content for planning |
| `grep` | Search for patterns |
| `create_plan` | Create the implementation plan |

## Web Slash Commands

Type `/` in the chat input for autocomplete:

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/branch [name]` | Switch branch or open selector |
| `/branches` | List available branches |
| `/reset` | Clear execution state |
| `/clear` | Start new conversation |
| `/security [path or pr N]` | Security scan |
| `/review pr [N]` | PR review or list PRs |
| `/compact` | Compress conversation |
| `/pr` | Create PR for changes |
| `/diff` | Show changed files |
| `/undo` | Revert last change |

## Platform Commands

### Slack
```
/codeteel connect owner/repo    # Connect channel to repo
/codeteel branch feature/xyz    # Switch branch
/codeteel security              # Security scan
/codeteel help                  # All commands
```

### Telegram
```
/branch feature/xyz             # Switch branch
/security                       # Security scan
/help                           # All commands
```
Regular messages go directly to the agent.

### Discord
```
/ask message:your question      # Send message (required)
/connect token:TOKEN            # Connect channel
/branch name:feature/xyz        # Switch branch
/security                       # Security scan
```

## Security

- **AES-256-GCM** encryption for all API keys and bot tokens at rest
- **Slack**: HMAC-SHA256 request signing + timing check
- **Discord**: Ed25519 signature verification (tweetnacl)
- **OAuth**: HMAC-signed state parameter prevents CSRF
- **Connect tokens**: One-time use, 5-minute expiry
- **Branch protection**: Main/master cannot be used as working branch
- **Processing locks**: Prevents concurrent execution per conversation
- **Bot tokens**: Never included in SQS messages -- Lambda looks up from DB

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL + pgvector + pg_trgm) |
| Auth | Supabase Auth (email/password + magic link) |
| LLM | Ollama (local) / OpenAI / Claude / Gemini / Grok / Qwen / Fireworks / Together |
| Embeddings | OpenAI / Gemini / Mistral / Voyage / Cohere (1536 dims) |
| Queue | AWS SQS |
| Compute | AWS Lambda (Serverless Framework) |
| Deployment | Vercel (web) + Lambda (platforms) |
| Encryption | AES-256-GCM |
| Styling | TailwindCSS |

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm
- Supabase project
- GitHub OAuth App
- (Optional) Ollama for local models

### Setup

```bash
# Clone
git clone https://github.com/your-org/codeteel.git
cd codeteel

# Install
pnpm install

# Configure
cp .env.example .env
# Fill in: Supabase URL/keys, GitHub OAuth, Encryption key

# Run migrations
# Apply SQL files from supabase/migrations/ in order

# Start dev server
pnpm dev    # http://localhost:9999

# (Optional) Start Ollama
ollama serve
ollama pull deepseek-coder-v2:16b
```

### Deploy

```bash
# Web (Vercel)
vercel deploy

# Lambda (platforms)
pnpm build:lambda
npx serverless deploy --aws-profile your-profile
```

## Testing

```bash
# Web comprehensive (21 tests)
npx tsx scripts/test-comprehensive.ts

# Slash commands (21 tests)
npx tsx scripts/test-commands.ts

# Slack (19 tests, via Lambda)
npx tsx scripts/test-slack.ts --lambda

# Telegram (16 tests)
npx tsx scripts/test-telegram.ts --lambda

# Discord (15 tests)
npx tsx scripts/test-discord.ts --lambda

# Security scan (4 tests)
npx tsx scripts/test-security-scan.ts

# Single test
npx tsx scripts/test-comprehensive.ts --only=17
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Landing page
│   ├── dashboard/          # Dashboard
│   ├── settings/           # Settings (LLM, embeddings, integrations)
│   ├── repos/[id]/         # Repo detail + chat interface
│   ├── docs/               # Documentation (16 pages with sidebar)
│   ├── api/
│   │   ├── slack/          # Slack OAuth, events, commands, interactive
│   │   ├── telegram/       # Telegram webhook
│   │   ├── discord/        # Discord interactions + OAuth
│   │   ├── llm/chat/       # LLM proxy with SSE streaming
│   │   ├── repos/[id]/     # Search, files, branches, PR, issues, commit
│   │   └── conversations/  # CRUD + messages + summary
│   └── components/         # Shared UI (navbar)
├── lib/
│   ├── agents/
│   │   ├── orchestrator.ts # ReAct loop + tool call recovery
│   │   ├── search.ts       # Semantic/text/grep search + journal
│   │   ├── planner.ts      # Plan generation
│   │   ├── executor.ts     # Deterministic edits (applyEdit)
│   │   ├── reviewer.ts     # PR review, issue review, security scan
│   │   ├── compression.ts  # Chat compression (100k token threshold)
│   │   ├── edit-utils.ts   # String matching + validation
│   │   └── tools/          # ToolExecutor interface + web/server impls
│   ├── platforms/
│   │   ├── handler.ts      # Shared pipeline for all platforms
│   │   ├── slack/          # Block Kit adapter
│   │   ├── telegram/       # Inline keyboard adapter
│   │   └── discord/        # Embed + action row adapter
│   ├── crypto.ts           # AES-256-GCM encrypt/decrypt
│   ├── llm/                # Multi-provider LLM client
│   └── embeddings/         # Multi-provider embedding client
├── lambda/handler.ts       # SQS event handler
├── hooks/
│   ├── useOrchestrator.ts  # React wrapper + slash commands
│   └── useIndexer.ts       # Browser-side indexing
└── scripts/                # Test suites (92 tests total)
```

## License

AGPL-3.0

---

<p align="center">
  Built with Codeteel. Ship code faster with AI.
</p>
