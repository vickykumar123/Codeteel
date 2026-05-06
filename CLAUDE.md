@AGENTS.md

# CodeBot - Project Context

## What is Codeteel?
AI coding agent platform that:
1. Connects to GitHub repositories
2. Indexes codebase (code + AI summaries + embeddings)
3. Receives requests via **Web UI, Slack, Telegram, Discord**
4. Shows implementation plan for approval (buttons or text)
5. Creates branches, writes code, opens PRs
6. Reviews PRs, issues, and runs security scans

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + pgvector + pg_trgm)
- **Auth**: Supabase Auth (email/password + magic link)
- **LLM**: Multi-provider — Ollama (local), OpenAI, Claude, Gemini, Grok, Qwen, Fireworks, Together
- **Realtime**: Supabase Realtime (WebSocket for progress updates)
- **Queue**: AWS SQS (platform messages) — browser-side indexing (no pgmq/pg_cron)
- **Compute**: AWS Lambda (platform message processing)
- **Deployment**: Vercel (web + webhooks) + Serverless Framework (Lambda)
- **Encryption**: AES-256-GCM for API keys and bot tokens
- **Styling**: TailwindCSS

## Project Structure
```
src/
├── app/
│   ├── page.tsx                    # Landing page (redirects if logged in)
│   ├── login/page.tsx              # Login (client component)
│   ├── signup/page.tsx             # Signup (client component)
│   ├── dashboard/page.tsx          # Main dashboard (server component)
│   ├── settings/page.tsx           # Settings page (server + client components)
│   ├── guides/
│   │   ├── slack/page.tsx          # Slack integration guide
│   │   ├── telegram/page.tsx       # Telegram integration guide
│   │   └── discord/page.tsx        # Discord integration guide
│   ├── repos/
│   │   ├── [id]/
│   │   │   ├── page.tsx            # Repo detail (server component)
│   │   │   ├── index-button.tsx    # Index trigger + realtime progress
│   │   │   ├── file-list.tsx       # Indexed files display
│   │   │   └── chat/
│   │   │       ├── page.tsx              # New chat (server component)
│   │   │       ├── [chatId]/page.tsx     # Existing chat (server component)
│   │   │       ├── chat-interface.tsx    # Main chat UI (client component)
│   │   │       ├── message-list.tsx      # Messages with markdown
│   │   │       ├── chat-input.tsx        # Input + slash command autocomplete
│   │   │       ├── sidebar.tsx           # Conversation list
│   │   │       ├── plan-approval.tsx     # Plan review UI
│   │   │       ├── task-progress.tsx     # Execution progress display
│   │   │       └── branch-modal.tsx      # Branch selection modal
│   │   └── connect/
│   │       ├── page.tsx            # Repo selection (server component)
│   │       └── repo-list.tsx       # Repo list (client component)
│   ├── api/
│   │   ├── github/
│   │   │   ├── auth/route.ts       # Initiate GitHub OAuth
│   │   │   └── callback/route.ts   # GitHub OAuth callback
│   │   ├── repos/
│   │   │   ├── route.ts            # GET/POST/DELETE repos
│   │   │   └── [id]/
│   │   │       ├── index/          # Browser indexing endpoints (start, save-file, pause, complete, fail-file)
│   │   │       ├── search/route.ts # Proxy: vector/text/grep search
│   │   │       ├── files/route.ts  # Proxy: read/write GitHub files
│   │   │       ├── branches/route.ts # Proxy: list/create branches
│   │   │       ├── pr/route.ts     # Proxy: create PR, list PRs, get PR diff
│   │   │       ├── issues/route.ts # Proxy: list/get GitHub issues
│   │   │       ├── commit/route.ts # Batch commit via Git Trees API
│   │   │       └── platform/route.ts # Disconnect platform from repo
│   │   ├── conversations/
│   │   │   ├── route.ts            # POST create, GET list
│   │   │   └── [id]/
│   │   │       ├── route.ts        # GET/PATCH conversation
│   │   │       ├── messages/route.ts # GET/POST messages
│   │   │       └── summary/route.ts  # GET/PUT chat summary (compression)
│   │   ├── slack/
│   │   │   ├── oauth/route.ts      # Slack OAuth with signed state
│   │   │   ├── events/route.ts     # Slack events → SQS
│   │   │   ├── command/route.ts    # /codeteel slash commands
│   │   │   └── interactive/route.ts # Button clicks → SQS
│   │   ├── telegram/
│   │   │   └── webhook/route.ts    # Telegram updates → SQS
│   │   ├── discord/
│   │   │   ├── interactions/route.ts # Discord slash commands + buttons
│   │   │   └── oauth/route.ts      # Discord bot OAuth
│   │   ├── platform/
│   │   │   └── connect/route.ts    # Generate one-time tokens (Telegram/Discord)
│   │   ├── webhooks/
│   │   │   └── github/route.ts     # GitHub push/PR merge → change detection
│   │   ├── llm/
│   │   │   └── chat/route.ts       # LLM proxy with SSE streaming
│   │   ├── instructions/route.ts   # Custom instructions (user + repo level)
│   │   ├── web/route.ts            # Web search + fetch for agents
│   │   ├── settings/route.ts       # GET/POST user settings
│   │   └── ollama/models/route.ts  # Fetch Ollama models
│   └── auth/
│       ├── callback/route.ts       # OAuth/magic link callback
│       └── signout/route.ts        # Sign out handler
├── lib/
│   ├── auth/index.ts               # getCurrentUser, requireAuth
│   ├── crypto.ts                   # AES-256-GCM encrypt/decrypt (API keys, bot tokens)
│   ├── db/
│   │   ├── client.ts               # Browser client (singleton) + admin client
│   │   └── server.ts               # Server client (uses cookies)
│   ├── llm/index.ts                # Multi-provider LLM client + createChatFn()
│   ├── embeddings/index.ts         # Multi-provider embedding client (1536 dims)
│   ├── github/index.ts             # GitHub API utilities + file filtering
│   ├── web/index.ts                # webSearch() + webFetch()
│   ├── platforms/
│   │   ├── handler.ts              # Shared pipeline: resolveContext → orchestrator → save
│   │   ├── interface.ts            # PlatformAdapter interface + splitMessage()
│   │   ├── queue.ts                # SQS push helper
│   │   ├── slack/
│   │   │   ├── adapter.ts          # Block Kit messages, buttons
│   │   │   └── handler.ts          # Slack-specific routing
│   │   ├── telegram/
│   │   │   ├── adapter.ts          # Inline keyboards, Markdown
│   │   │   └── handler.ts          # /start TOKEN, bot commands
│   │   └── discord/
│   │       ├── adapter.ts          # Embeds, action rows
│   │       └── handler.ts          # Slash commands, interactions
│   └── agents/
│       ├── index.ts                # Exports orchestrator, executor
│       ├── types.ts                # Tool, Message, Plan, StreamEvent, SearchJournalEntry
│       ├── constants.ts            # Iteration limits, phrases, provider defaults
│       ├── orchestrator.ts         # Main ReAct loop + tool call recovery
│       ├── search.ts               # Semantic/text/grep search + search journal
│       ├── planner.ts              # Plan generation with search budget
│       ├── executor.ts             # Deterministic edits via applyEdit
│       ├── edit-utils.ts           # findAllMatches, applyEdit, findCloseMatch
│       ├── reviewer.ts             # PR review, issue review, security scan
│       ├── compression.ts          # Chat compression (100k token threshold)
│       └── tools/
│           ├── interface.ts        # ToolExecutor interface (swappable)
│           ├── web.ts              # Web impl: fetch() → /api/* (browser + tests)
│           └── server.ts           # Server impl: direct DB/GitHub (platforms + Lambda)
├── lambda/
│   └── handler.ts                  # SQS event handler for platform messages
├── hooks/
│   ├── useOrchestrator.ts          # React wrapper + slash commands + DB persistence
│   └── useIndexer.ts               # Browser-side indexing orchestration
├── middleware.ts                   # Route protection + auth session refresh
└── types/
    └── database.ts                 # Auto-generated Supabase types

scripts/
├── build-lambda.js                 # esbuild with @/lib alias resolution
├── test-comprehensive.ts           # 16 web E2E tests
├── test-commands.ts                # 21 slash command tests
├── test-slack.ts                   # 15 Slack E2E tests
├── test-telegram.ts                # 16 Telegram E2E tests
├── test-discord.ts                 # 15 Discord E2E tests
├── test-security-scan.ts           # 4 security scan tests
└── test-compression.ts             # Compression unit tests

serverless.yml                      # Lambda + SQS config (ap-south-1)
```

## Database Schema (Supabase)
```
users                - Profile + LLM settings + embedding settings (auto-created on signup via trigger)
repositories         - Connected GitHub repos + index_status + indexed_commit_sha + pending_changes
file_summaries       - Code + AI summary + embeddings (trigram + vector search, 1536 dims)
index_jobs           - Indexing progress (file_list, completed_paths[], failed_paths[], status)
conversations        - Chat conversations (working_branch, execution_state JSONB, platform metadata)
messages             - Chat messages (user, assistant, tool, system) with metadata JSONB
chat_summaries       - Conversation compression summaries (last_message_id, tokens_compressed)
platform_connections - Platform channel → repo mapping (one channel = one repo)
slack_installations  - Slack workspace OAuth tokens (encrypted bot_token, team_id, bot_user_id)
platform_llm_providers - Cloud LLM providers for platforms (one active per user, encrypted api_key)
custom_instructions  - User-level and repo-level instructions (merged into agent prompt)
```

## Migrations
- `000_full_schema.sql` - Core tables, triggers, extensions (pgvector, pg_trgm)
- `001_indexing_queue.sql` - pgmq queue, pg_cron job, queue functions
- `002_realtime_policies.sql` - RLS policies for Realtime subscriptions
- `003_embedding_settings.sql` - Embedding provider settings
- `004_conversations.sql` - Conversations, messages tables, search functions
- `005_branch_management.sql` - working_branch column on conversations
- `006_execution_state.sql` - execution_state JSONB on conversations
- `007_llm_providers.sql` - LLM provider settings on users
- `008_browser_indexing.sql` - Browser-side indexing (file_list, completed/failed paths)
- `009_change_detection.sql` - indexed_commit_sha, pending_changes, webhook tracking
- `010_chat_summaries.sql` - Chat compression table + RLS
- `011_llm_providers_update.sql` - Multi-provider LLM settings
- `012_custom_instructions.sql` - User + repo level custom instructions
- `013_platform_llm_providers.sql` - Separate cloud LLM for platforms
- `014_platform_connections.sql` - Platform channel → repo mapping
- `015_slack_installations.sql` - Slack OAuth tokens (encrypted)
- `017_conversation_processing_lock.sql` - is_processing column + stale lock detection
- `018_telegram_connect_tokens.sql` - One-time tokens for Telegram/Discord connect

## Environment Variables (.env)
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:9999

# GitHub OAuth App (NOT GitHub App!)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=           # 32-byte hex for AES-256-GCM (API keys, bot tokens)

# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=

# Telegram
TELEGRAM_BOT_TOKEN=

# Discord
DISCORD_APPLICATION_ID=
DISCORD_PUBLIC_KEY=       # Ed25519 signature verification
DISCORD_BOT_TOKEN=

# AWS (for Lambda/SQS)
SQS_QUEUE_URL=

# Cron job authentication (generate with: openssl rand -hex 32)
CRON_SECRET=
```

## Scripts
```bash
pnpm dev        # Start on port 9999
pnpm db:types   # Generate types from Supabase
```

## Features

### Core Agent System
- **Orchestrator** — Main ReAct loop with tool call recovery for OSS models
- **Search Agent** — Semantic (vector), text (trigram), grep search with search journal (max 7 entries, avoids re-searching)
- **Planner Agent** — Text-only plans (WHAT), code generated per step at execution time (HOW). Max 10 iterations, search budget guidance
- **Executor Agent** — Deterministic edits via applyEdit(). Reads fresh file from GitHub before each step. Max 3 retries per edit
- **Reviewer Agent** — PR review, issue review, security scan (summary-based file prioritization)
- **Compression** — Auto-compresses at 100k tokens (60% of messages). Manual via `/compact` (threshold=0)
- **Tool Call Recovery** — OSS models sometimes output JSON as text. Recovers: request→planner, question→search, paths→delete_files, title+body→create_pr
- **Error Nudge** — After 2 consecutive errors, appends nudge to tool result. One nudge per result (error OR reflect, never both)

### Web UI
- **Chat Interface** — Full-page chat with sidebar, markdown rendering, conversation history
- **Slash Commands** — `/help`, `/branch`, `/branches`, `/reset`, `/clear`, `/security`, `/review`, `/compact`, `/pr`, `/diff`, `/undo`
- **Command Autocomplete** — Popup suggestions as user types `/`, arrow key navigation, Tab/Enter to select
- **Plan Approval** — UI buttons (100% reliable) + text detection ("yes", "go ahead", etc.) + LLM fallback
- **Branch Modal** — Branch selector guard before execution (not before planning)
- **Execution Progress** — Step-by-step progress with diffs shown after each step
- **Persistent Commands** — `/security`, `/review`, `/compact`, `/diff`, `/reset` save to DB. Ephemeral: `/help`, `/branches`, `/branch`, `/clear`
- **Auto-create Conversation** — Persistent commands as first message auto-create the chat

### Platform Integrations

**Architecture:** Vercel (web + webhooks) → SQS → Lambda (orchestrator processing) → Platform APIs

#### Slack
- **OAuth** with signed state parameter (HMAC-SHA256, cross-domain safe)
- **Commands**: `/codeteel connect`, `disconnect`, `status`, `branch`, `branches`, `reset`, `clear`, `security`, `help`
- **Block Kit** buttons for plan approval and branch selection
- **Request signature verification** (HMAC-SHA256, timing check)
- Auto-join bot to channel on connect. One channel = one repo
- Message splitting at 4000 chars

#### Telegram
- **Token-based connect** — Click link from repo page → `/start TOKEN` in Telegram
- **Commands**: `/connect`, `/disconnect`, `/status`, `/branch`, `/branches`, `/reset`, `/clear`, `/security`, `/help`
- **Inline keyboard** buttons for approval/branch selection
- Markdown formatting with plain-text fallback on parse errors
- Message splitting at 4096 chars. Typing indicator via sendChatAction

#### Discord
- **Slash commands only** — Discord doesn't support regular messages to bots
- **`/ask`** command for all messages/questions
- **Commands**: `/connect`, `/disconnect`, `/status`, `/branch`, `/branches`, `/reset`, `/clear`, `/security`, `/help`
- **Ed25519 signature verification** via tweetnacl
- Discord embeds + action row buttons. Message splitting at 2000 chars
- Guild-scoped command registration (instant, not 1hr global delay)

#### Shared Platform Handler (`src/lib/platforms/handler.ts`)
- Single pipeline for all platforms: resolveContext → getLLMConfig → check processing lock → load history → run orchestrator → save state
- Stale lock detection (5-minute timeout for Lambda crash recovery)
- Bot token NOT in SQS messages — Lambda looks up from DB using teamId
- `splitMessage()` utility for platform character limits

### Security & Encryption
- **AES-256-GCM** encryption for API keys, bot tokens, OAuth tokens (`src/lib/crypto.ts`)
- Format: `aes256gcm:<iv_hex>:<ciphertext_hex>:<tag_hex>`
- **Slack request signing** — HMAC-SHA256 with timing check (rejects > 300s old)
- **Discord Ed25519** — tweetnacl detached signature verification
- **Slack OAuth state signing** — HMAC-SHA256 prevents CSRF without cookies
- **One-time connect tokens** — 5-minute expiry for Telegram/Discord linking
- **Security scan agent** — Regex summaries for keywords, only reads full code for flagged/sensitive files
- **Processing lock** — `is_processing` column prevents concurrent execution per conversation

### LLM Providers
- **Web**: Ollama (local, direct browser fetch) or cloud (OpenAI, Claude, Gemini, Grok, Qwen, Fireworks, Together) via SSE proxy
- **Platforms**: Cloud-only (separate config, Lambda can't reach user's localhost)
- Provider defaults in `constants.ts` with OpenAI-compatible base URLs
- SSE streaming keeps Vercel connection alive past 15s timeout

### Custom Instructions
- **User-level** — applies to all repos for the user
- **Repo-level** — applies to specific repository
- Merged into agent system prompt. Validated during code review

### Indexing
- **Browser-side** — No server queue. Browser orchestrates file-by-file with pause/resume
- **Parallel processing** — Ollama: 2 concurrent, OpenAI: 10 concurrent
- **Large file chunking** — >2000 lines or >8000 chars → chunk by 500 lines / 6000 chars with overlap
- **Multi-provider embeddings** — OpenAI, Gemini, Mistral, Voyage, Cohere (all 1536 dims)
- **File filtering** — 30+ languages indexed. Excludes: lock files, build dirs, assets, minified, >100KB
- **Content hash tracking** — Skip unchanged files on re-index
- **Change detection** — GitHub webhooks track push/PR merge → pending_changes for re-indexing

### Search
- **Semantic search** — pgvector cosine similarity on 1536-dim embeddings
- **Text search** — pg_trgm trigram matching
- **Grep search** — Regex patterns with context lines, file pattern filtering
- **Web search & fetch** — Agents can search the web and fetch URLs for external documentation

### Branch Management
- Main/master protected (cannot be selected for edits)
- Branch required before execution, NOT before planning
- Stored in conversation (persists across page refresh)
- Web: modal dialog. Platforms: buttons + text commands

### Batch Commits
- Git Trees API for multi-file changes in single commit
- Supports create + modify + delete in one atomic operation
- No race conditions (tree-based, not contents API)

### Iteration Limits & Safety
- Orchestrator: 20 iterations max
- Planner: 10 iterations max
- Same action 3x = stuck → surface error
- Small file threshold: <20 lines → full-file replacement
- Max grep matches: 20. Max search results: 20
- Tool result truncation at 8000 chars (search token optimization)

### Test Suites
- **Web comprehensive**: 16 tests (88-100% pass rate)
- **Slash commands**: 21 tests (100% pass rate)
- **Slack**: 15 tests (93% pass rate)
- **Telegram**: 16 tests (93% pass rate)
- **Discord**: 15 tests (86% pass rate)
- **Security scan**: 4 tests
- All tests use real LLM calls + real GitHub API (not mocked)

## Architecture: Client-Side Orchestrator

### Why Client-Side? (Research: Claude Code, Cline, Cursor)
Based on research into Claude Code, Cline, and Cursor patterns:
- **Cline/Cursor**: Orchestrator runs on client (VS Code extension), not server
- **Approval**: Uses UI buttons (100% reliable), not LLM parsing (unreliable)
- **Tool restrictions**: Hard code-level guards, not "soft hints" in prompts

**Key decision**: Move orchestrator from Next.js API (server) to React (browser).

### System Split
```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Browser - React)                                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  useOrchestrator() hook                                  │    │
│  │  - Orchestrator loop (ReAct pattern)                     │    │
│  │  - LLM calls via fetch() → Ollama/OpenAI directly       │    │
│  │  - Agent state in React (plan, messages, filesChanged)   │    │
│  │  - UI buttons for approval (not text parsing)            │    │
│  │  - Background DB saves (non-blocking)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│              fetch() to backend API routes                       │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│  BACKEND (Next.js API - Thin Proxy)                              │
│                                                                  │
│  /api/repos/[id]/search    → Supabase vector search (service key)│
│  /api/repos/[id]/files     → GitHub API (read/write, token)      │
│  /api/repos/[id]/branches  → GitHub API (list/create, token)     │
│  /api/repos/[id]/pr        → GitHub API (create PR, token)       │
│  /api/conversations        → Supabase (save/load conversations)  │
│  /api/messages             → Supabase (save/load messages)       │
│  /api/settings             → Supabase (user LLM/embedding config)│
│                                                                  │
│  Secrets stay server-side: GitHub token, Supabase service key    │
└──────────────────────────────────────────────────────────────────┘
```

### Agent Components
```
src/lib/agents/                    ← Pure modules (no React, no Next.js)
├── orchestrator.ts                ← Main ReAct loop
├── types.ts                       ← Tool, Message, Plan, StreamEvent types
├── tools/
│   ├── interface.ts               ← ToolExecutor interface (swappable)
│   ├── web.ts                     ← Web impl: fetch() → /api/* routes
│   └── server.ts                  ← Server impl: direct DB/GitHub (for Slack/Telegram later)
├── planner.ts                     ← Planner + tools (generates old_string/new_string)
├── executor.ts                    ← Deterministic executor (applyEdit, GitHub commits)
├── edit-utils.ts                  ← findAllMatches, applyEdit, findCloseMatch
└── search.ts                      ← Search tools (semantic + text)

src/hooks/
└── useOrchestrator.ts             ← React wrapper (state, UI events, background saves)

scripts/
└── test-full-flow.ts              ← Same fetch() calls as browser (testable without React)
```

### Swappable Tool Executors
```typescript
// Same interface for Web, Server, and Tests
interface ToolExecutor {
  search(query: string): Promise<SearchResult[]>;
  readFile(path: string, branch: string): Promise<FileContent>;
  writeFile(path: string, content: string, branch: string, message: string): Promise<void>;
  editFile(path: string, oldStr: string, newStr: string, branch: string, msg: string): Promise<void>;
  createBranch(name: string, base: string): Promise<void>;
  createPR(title: string, body: string, head: string, base: string): Promise<PRResult>;
}

// Web: fetch() → /api/* (browser)
// Server: direct DB/GitHub calls (Slack/Telegram webhooks)
// Test: same as Web (scripts mimic browser)
```

### Agent Flow (Client-Side)
```
User opens /repos/[id]/chat (new chat)
  conversationId = null, branch = null, messages = []
      ↓
User types: "Add logout button to navbar"
      ↓
┌─ Guard 1: Conversation exists? ─────────────────────┐
│  NO → POST /api/conversations { repoId, title }      │
│       ← conversationId                               │
│       Update URL → /repos/[id]/chat/[chatId]          │
│  YES → continue                                       │
└───────────────────────────────────────────────────────┘
      ↓
  Add message to React state (instant render)
  Save message to DB in background (non-blocking)
      ↓
  Orchestrator loop runs in browser:
    1. fetch() → LLM (search tools available)
    2. LLM returns tool calls → execute via fetch() → /api/*
    3. LLM creates plan → setPlan(plan) in React state
    4. Show plan in chat with [Approve] [Reject] buttons
    5. STOP loop - wait for user action
      ↓
  User clicks [Approve]
      ↓
┌─ Guard 2: Branch selected? ─────────────────────────┐
│  NO → Show branch modal (blocks until selection)      │
│       Save branch to conversation in DB               │
│       setBranch(selectedBranch)                       │
│  YES → continue                                       │
└───────────────────────────────────────────────────────┘
      ↓
  Execute plan (LLM generates code per step):
    For each step:
      - "modify" → read file → LLM generates old_string/new_string → applyEdit() → commit → show diff
      - "create" → LLM generates full content → commit → show diff
      - "delete" → delete file via GitHub API
      ↓
  All steps done → Show diff summary + [Create PR] button
      ↓
  User clicks [Create PR] → POST /api/repos/[id]/pr
      ↓
  Done. Show PR link.
```

### Guards (Code-Level, Not LLM Decisions)
```typescript
// Guard 1 - Conversation must exist before any message
async function handleSend(text: string) {
  if (!conversationId) {
    conversationId = await createConversation(repoId, text);
    window.history.replaceState({}, "", `/repos/${repoId}/chat/${conversationId}`);
  }

  // Guard 2 - Text approval/rejection detection (before LLM)
  if (currentPlan) {
    if (isApprovalText(text)) {
      setMessages(prev => [...prev, { role: "user", content: text }]);
      handleApprove();
      return; // Don't send to LLM
    }
    if (isRejectionText(text)) {
      setMessages(prev => [...prev, { role: "user", content: text }]);
      handleReject();
      return; // Don't send to LLM
    }
  }

  // Normal message → send to LLM
  setMessages(prev => [...prev, { role: "user", content: text }]);
  saveMessageToDB(conversationId, text).catch(console.error); // background
  runOrchestrator(text, ...);
}

// Guard 3 - Branch must exist before execution (not before planning)
async function handleApprove() {
  if (!workingBranch) {
    openBranchModal(); // blocks until user selects
    return; // modal callback will call handleApprove() again
  }
  executePlan(currentPlan, workingBranch);
}
```

### Approval Flow (3 Layers)
```
Plan displayed in chat:
┌─────────────────────────────────────────────────┐
│ CodeBot: Here's my plan:                        │
│                                                 │
│ 📋 Add health endpoint                          │
│ 1. MODIFY src/webhook.py - Add /health route    │
│ 2. MODIFY src/webhook.py - Add import           │
│                                                 │
│ ┌──────────┐  ┌──────────┐                      │
│ │ Approve  │  │  Reject  │                      │
│ └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────┘
```

**Three approval layers (most reliable first):**

| Layer | Method | Reliability | How |
|-------|--------|-------------|-----|
| 1. UI Button | Click [Approve] | 100% | `handleApprove()` directly |
| 2. Text Detection | Type "yes"/"go ahead" | ~95% | Pre-LLM check in `handleSend()` |
| 3. LLM Fallback | Type anything else while plan exists | ~70% | LLM sees plan in context |

**Text detection (Layer 2) - code-level, before LLM:**
```typescript
const APPROVAL_PHRASES = [
  "yes", "y", "go ahead", "proceed", "do it", "ok", "okay",
  "sure", "yep", "yeah", "looks good", "approve", "lgtm",
  "ship it", "make the changes", "sounds good", "perfect",
  "great", "let's do it", "yes please", "continue",
];

const REJECTION_PHRASES = [
  "no", "n", "cancel", "stop", "reject", "don't", "nope",
  "nevermind", "never mind", "scratch that", "undo",
];

function isApprovalText(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  // Exact match
  if (APPROVAL_PHRASES.includes(normalized)) return true;
  // Starts with approval phrase (e.g., "yes, that looks good")
  return APPROVAL_PHRASES.some(p =>
    normalized.startsWith(p + ",") ||
    normalized.startsWith(p + ".") ||
    normalized.startsWith(p + "!") ||
    normalized === p
  );
}
```

### State Management
```
React State (instant, real-time):
├── messages[]          ← Renders immediately
├── currentPlan         ← Approve/Reject buttons work instantly
├── filesChanged[]      ← Progress updates live
├── workingBranch       ← Set once per conversation
├── conversationId      ← Created on first message
└── isExecuting         ← Loading state

DB (background, for persistence):
├── conversations       ← Created on first message, updated on branch select
├── messages            ← Saved after each exchange (non-blocking)
└── execution_state     ← Saved after execution completes

Page refresh → Load from DB → Hydrate React state → Resume
```

### Existing Chat (Resume)
```
User opens /repos/[id]/chat/[chatId]
  ↓
GET /api/conversations/[chatId]  ← conversationId, workingBranch
GET /api/messages?conv=[chatId]  ← message history
  ↓
Hydrate React state from DB
  ↓
Ready - user continues conversation
```

### Platform Integration (Future)
```
Web (Browser):    Orchestrator in browser, tools via fetch() → /api/*
Slack (Webhook):  Orchestrator on server, tools via direct DB/GitHub calls
Telegram (Webhook): Same as Slack
Test Scripts:     Same as Web (fetch-based, no React needed)
```

| Platform | Orchestrator | LLM Called From | Tools | Approval UI |
|----------|-------------|-----------------|-------|-------------|
| Web | Browser | Browser fetch() | WebToolExecutor | Chat buttons |
| Slack | Server | Server fetch() | ServerToolExecutor | Block Kit buttons |
| Telegram | Server | Server fetch() | ServerToolExecutor | Inline keyboard |
| Test Script | Node.js | Node.js fetch() | WebToolExecutor | Auto/manual |

### Plan = Text Only, Code Generated Per Step

**Key insight (from Cline/Claude Code patterns):**
- Plan mode = text descriptions (WHAT to do)
- Execution mode = LLM generates code per step (HOW to do it)
- User approves the APPROACH, not exact code

**PlanStep (text only):**
```typescript
interface PlanStep {
  id: string;           // "step-1", "step-2"
  type: "create" | "modify" | "delete";
  path: string;         // File to change
  description: string;  // Human-readable: "Add /health route that returns {status: ok}"
}
```

**Plan display (text, user reviews approach):**
```
┌─────────────────────────────────────────────────┐
│ 📋 Add health endpoint                          │
│                                                 │
│ 1. Modify src/webhook.py                        │
│    Add /health route that returns {status: ok}  │
│                                                 │
│ 2. Modify src/webhook.py                        │
│    Add import for json module                    │
│                                                 │
│ ┌──────────┐  ┌──────────┐                      │
│ │ Approve  │  │  Reject  │                      │
│ └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────┘
```

**Execution flow (LLM generates code per step, then deterministic apply):**
```
For each step in plan.steps:
  1. Set step status → "in_progress" (React setState)
  2. Read current file from GitHub (always fresh, includes prior step changes)
  3. LLM call: given file content + step.description → generates old_string/new_string
  4. applyEdit(content, old_string, new_string) → deterministic replacement
  5. Commit to GitHub
  6. Show diff in chat (what actually changed)
  7. Success → "completed" | Fail → retry or "failed" with error
All done → Show [Create PR] button
```

**Diff shown AFTER each step (actual changes, not predicted):**
```
┌─────────────────────────────────────────────────┐
│ ✅ Step 1: Modify src/webhook.py                 │
│ ┌─────────────────────────────────────────┐     │
│ │ - app.run(host="0.0.0.0", port=8080)   │     │
│ │ + @app.route("/health")                 │     │
│ │ + def health():                         │     │
│ │ +     return {"status": "ok"}           │     │
│ │ +                                       │     │
│ │ + app.run(host="0.0.0.0", port=8080)   │     │
│ └─────────────────────────────────────────┘     │
│                                                 │
│ ⟳ Step 2: Modify src/webhook.py...              │
│ ○ Step 3: Create PR                             │
│                                                 │
│ Progress: 1/3 completed                         │
└─────────────────────────────────────────────────┘
```

**Why this is better:**
| Concern | Code-in-plan (old) | Text-plan + code-on-fly (new) |
|---------|-------------------|------------------------------|
| File freshness | May be stale | Always reads latest |
| Multi-step edits to same file | Later steps have wrong old_string | Each step reads after prior commit |
| Plan readability | Huge code blocks | Clean text descriptions |
| LLM accuracy | One-shot generates all code | Focused on one change at a time |
| User review | Reviews exact code (overwhelming) | Reviews approach (manageable) |
| Diff visibility | Before execution (predicted) | After execution (actual) |

### Branch Management (Code Guard, Not LLM Decision)

Branch selection is enforced by code before execution starts - not by the LLM.

**Key Rules:**
| Rule | Behavior |
|------|----------|
| Main is protected | Cannot select main/master as working branch |
| Must select before execution | Code guard blocks execution if no branch |
| NOT required for planning | LLM can search + create plan without branch |
| Branch stored in conversation | Saved to DB, loaded on resume |
| Code enforces this | `if (!branch) openBranchModal()` - not an LLM tool |

**Web UI (Modal on Approve):**
```
User clicks [Approve] on plan
  ↓
if (!workingBranch) → show modal:
┌───────────────────────────────────────────────────────────┐
│  🌿 Select Working Branch                                 │
│                                                           │
│  ○ feature/user-auth          (3 commits ahead)          │
│  ○ feature/api-refactor       (1 commit ahead)           │
│  ● main                       🔒 Protected (disabled)    │
│                                                           │
│  ─────────────── OR ───────────────                      │
│                                                           │
│  Branch name: feature/____________________                │
│  Base branch: [main ▼]                                    │
│                                                           │
│  [Create & Continue]  [Cancel]                            │
└───────────────────────────────────────────────────────────┘
  ↓
Branch selected → save to DB → proceed with execution
```

**Platform-Specific (Future):**
| Platform | UI |
|----------|-----|
| Web | Modal dialog with dropdown + create form |
| Slack | Block Kit buttons |
| Telegram | Inline keyboard buttons |

### Iteration Limits & Exit Conditions
Based on ReAct pattern (Reasoning + Acting) used by Claude Code, Cline, and industry best practices.

**Per-Agent Limits:**
| Agent | Max Iterations | Exit Conditions |
|-------|----------------|-----------------|
| Orchestrator | 20 | Task complete, user cancel, max iters, unrecoverable error |
| Search | 5 | Found relevant files, max iters, no results after refinement |
| Planner | 3 | Plan approved, plan rejected, max revisions |
| Executor | 30 | PR created, max iters, 3 consecutive failures on same file |

**Note:** Executor limit is 30 because each plan step may require multiple LLM calls (read_file + write_file + potential retries).

**Loop Prevention:**
- Same tool + same args **3 times** = stuck, surface error to user
- Context window buffer: 15% reserved for recovery
- Total task timeout: 5 minutes (configurable)

**Search Agent Loop:**
```
1. semantic_search(query) → top 10 matches
2. If confidence < 0.7 → refine query (max 3 refinements)
3. read_file() for top candidates
4. If not found → expand to related directories
5. Exit: Found files OR exhausted search space OR max iterations
```

**Edit Retry Strategy:**
```
edit_file(path, old_string, new_string)
  ↓
Validate match (unique? exists?)
  ↓ fail
  ├── "Not found" → Re-read file, retry with corrected match
  ├── "Multiple matches" → Include more context in old_string
  └── 3 failures → Surface error to user
  ↓ success
Validate (syntax, types, lint)
  ↓ fail
Parse error → Read current file → Retry with fix
  ↓ 3 failures
Surface error to user with context
```

### Executor Step Processing

For each plan step during execution, the LLM generates code on the fly:

**Step execution flow:**
```
1. Read current file content from GitHub (always fresh)
2. LLM call: system prompt + file content + step.description
   → LLM returns: { old_string, new_string } for modify
   → LLM returns: { content } for create
3. For modify: applyEdit(content, old_string, new_string) → deterministic
   For create: write full content
   For delete: delete file
4. Commit to GitHub
5. Return { old_string, new_string } to UI for diff display
```

**LLM prompt for code generation (per step):**
```
You are a code editor. Given the current file content and the requested change,
return the EXACT old_string to find and new_string to replace it with.

Rules:
- old_string must be UNIQUE in the file (include enough context)
- Copy old_string EXACTLY from the file (same whitespace/indentation)
- Return valid JSON: { "old_string": "...", "new_string": "..." }
- For new files, return: { "content": "..." }
```

**Error recovery (edit_file retries):**
| Error | Recovery |
|-------|----------|
| String not found | Re-read file, LLM retries with correct text |
| Multiple matches | LLM includes more context in old_string |
| 3 failures | Surface error to user, skip step |

### File Editing Implementation (edit-utils.ts)

Custom string-replacement algorithm. LLM generates old_string/new_string at execution time, applyEdit() applies deterministically.

**Algorithm:**
```
applyEdit(content, old_string, new_string)
  ├── findAllMatches(content, old_string) → exact indexOf matching
  ├── 0 matches → Error + findCloseMatch() hint
  ├── 1 match → Replace deterministically ✓
  ├── N matches → Error: "include more context"
  └── Return new content (or error with actionable message)
```

**Error messages (fed back to LLM for retry):**
| Error | Message | LLM Action |
|-------|---------|------------|
| Not found | `"String not found. Hint: possible match at line N"` | Re-read file, fix old_string |
| Multiple matches | `"Found N matches at lines X, Y. Add more context."` | Expand old_string |
| Whitespace mismatch | `"Close match at line N (whitespace differs)"` | Fix whitespace |

**Context Management:**
| Strategy | Threshold | Action |
|----------|-----------|--------|
| Chunk large files | > 500 lines | Read in sections with offset/limit |
| Truncate tool outputs | > 10,000 chars | Truncate with "... (truncated)" |
| Track tokens | > 80% capacity | Warn user, suggest /compact |
| Auto-compact | > 20 messages | Summarize conversation history |

### Validation Gates
Self-correction requires external validation, not self-grading.

```typescript
interface ValidationGates {
  // After each file edit
  postEdit: {
    syntaxCheck: boolean;    // Parse file (AST valid?)
    typeCheck: boolean;      // TypeScript compiler
    lintCheck: boolean;      // ESLint errors only
  };

  // After all edits in a task step
  postBatch: {
    buildCheck: boolean;     // npm run build
    testCheck: boolean;      // Run affected tests
  };

  // Before creating PR
  prePR: {
    fullTestSuite: boolean;  // npm test
    noConflicts: boolean;    // Git merge check
    diffReview: boolean;     // Sanity check changes
  };
}
```

**Validation Flow:**
```
Edit File → Syntax OK? → Types OK? → Lint OK? → Continue
              ↓ no        ↓ no        ↓ no
           Retry (3x)  Retry (3x)  Auto-fix or Retry
              ↓ fail      ↓ fail      ↓ fail
           Surface error to user
```

### Error Recovery Patterns

**1. Edit Failures (most common):**
- `"String to replace not found"` → Re-read file, retry with corrected match
- `"File modified externally"` → Re-read, recompute diff, retry
- Duplicate matches → Include more context in search string

**2. API Failures:**
- 5xx errors → Exponential backoff (1s, 2s, 4s), max 3 retries
- Rate limits → Respect Retry-After header
- Timeout → Reduce batch size, retry

**3. LLM Failures:**
- Output token limit → Inject "Resume directly, no recap" (max 3x)
- Context overflow → AutoCompact (summarize conversation)
- Malformed tool call → Re-prompt with error context

**4. GitHub API Failures:**
- Auth expired → Prompt user to re-authenticate
- Rate limit → Queue and retry after reset
- Conflict on push → Pull, rebase, retry

### Context Management
```
Context Budget: ~100k tokens (model dependent)
  ├── System prompt: ~2k
  ├── Conversation history: ~60k (auto-compacted)
  ├── Tool results: ~25k
  └── Buffer for response: ~13k

AutoCompact triggers when:
  - Approaching 85% of context window
  - Generates structured summary (up to 20k tokens)
  - Re-injects: recent files (5k/file cap), active plans, tool schemas
  - Circuit breaker: 3 consecutive compression failures → stop
```

### Edge Cases to Handle

| Case | Detection | Resolution |
|------|-----------|------------|
| Infinite loop | Same action 3x | Break loop, surface to user |
| Cascading errors | Error propagates through steps | Validate each step independently |
| Stale file read | File hash mismatch on edit | Re-read immediately before edit |
| Large file | > 100KB or > 2000 lines | Chunk processing, summarize sections |
| Binary file | Non-text detected | Skip with warning |
| Protected branch | Push rejected | Create new branch, open PR |
| Test flakiness | Same test fails/passes randomly | Retry test 2x before reporting |
| Partial success | Some files edited, some failed | Report partial progress, allow retry |

## Indexing Architecture
```
1. User clicks "Index" → POST /api/repos/[id]/index (streaming)
   - Fetches file list from GitHub
   - Filters files (see File Filtering below)
   - Queues files in batches of 25 → pgmq
   - Streams progress: "Queuing batch 3/5..."

2. Manual trigger OR pg_cron (every 10s) → POST /api/process-index-batch
   - Pulls batch from queue
   - For each file: GitHub fetch → LLM summary → Embedding → DB insert
   - Parallel processing: 2 files (Ollama) or 10 files (OpenAI)
   - Large files are chunked (see Chunking Logic below)
   - Updates index_jobs table

3. Frontend subscribes via Supabase Realtime
   - Listens to index_jobs table changes
   - Instant progress bar updates (no polling!)
   - Auto-refreshes when complete
```

### File Filtering (src/lib/github/index.ts)
**Indexed Languages:**
- JS/TS: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`
- Python: `.py`, `.pyw`
- Go, Rust, Java, Kotlin, C/C++, C#, Ruby, PHP, Swift, Scala
- Shell: `.sh`, `.bash`, `.zsh`
- Frontend: `.vue`, `.svelte`, `.astro`
- SQL: `.sql`, `.graphql`, `.gql`
- Infra: `.yaml`, `.yml`, `.toml`, `.tf`, `.hcl`, `Dockerfile`, `Makefile`
- Docs: `.md`, `.mdx`
- Config: `.json` (excluding lock files)

**Excluded:**
- Directories: `node_modules`, `dist`, `build`, `__pycache__`, `.git`, `vendor`, `assets`, `static`, etc.
- Files: `package-lock.json`, `yarn.lock`, `*.min.js`, `*.d.ts`, `*.map`, `.env*`, etc.
- Size: > 100KB

### Chunking Logic for Large Files (src/lib/llm/index.ts)
```
Code Input
    │
    ▼
┌─────────────────────────────────┐
│  Thresholds:                    │
│  - lines > 2000? OR             │
│  - chars > 8000?                │
└─────────────────────────────────┘
    │
    ├── NO → Single LLM call
    │
    └── YES ↓
            │
    ┌───────┴───────┐
    │               │
 lines > 2000    chars > 8000
    │               │
    ▼               ▼
 Chunk by        Chunk by
 500 lines       6000 chars
 (50 overlap)    (500 overlap)
    │               │
    └───────┬───────┘
            │
            ▼
   Summarize each chunk
            │
            ▼
   Combine with LLM call
            │
            ▼
      Final Summary
```

**Thresholds:**
| Constant | Value | Purpose |
|----------|-------|---------|
| MAX_LINES | 2000 | Trigger chunking |
| MAX_CHARS | 8000 | Trigger chunking (fallback) |
| CHUNK_LINES | 500 | Lines per chunk |
| CHUNK_LINES_OVERLAP | 50 | Overlap for context |
| CHUNK_CHARS | 6000 | Chars per chunk |
| CHUNK_CHARS_OVERLAP | 500 | Overlap for context |

**Example LLM Calls:**
| File Size | Chunks | LLM Calls |
|-----------|--------|-----------|
| 500 lines | 1 | 1 |
| 1500 lines | 1 | 1 |
| 3000 lines | 7 | 8 (7 + combine) |
| 5000 lines | 11 | 12 (11 + combine) |

## Important Notes
- Browser client uses `@supabase/ssr` createBrowserClient (singleton pattern)
- Server client uses `next/headers` cookies - only in Server Components
- Admin client uses service_role key - bypasses RLS
- Port: 9999 (configured in package.json)
- No team/organization support (single-user MVP)
- Ollama must be running locally: `ollama serve` (or use OpenAI API key)
- Embedding API key is REQUIRED for indexing (configured in Settings)
- File edits use custom string-matching algorithm (no external SDK, no extra API costs)
- Main/master branches are protected - edits require selecting/creating a working branch
- **Orchestrator runs on frontend (browser)** - LLM calls via fetch, not server-side
- **Backend is thin proxy** - only for secrets (GitHub token, Supabase service key)
- **Approval via UI buttons** - not LLM text parsing (based on Cline/Cursor research)
- **Guards are code-level** - conversation exists before message, branch before execution
- **React state for real-time** - DB saves happen in background for persistence
- **Test scripts mimic browser** - same fetch calls, same orchestrator, no React needed
- **Vercel compatible** - no long-running serverless functions needed for agent loop

## Embedding Providers (1536 dimensions)
| Provider | Model | Price |
|----------|-------|-------|
| OpenAI | text-embedding-3-small | $0.02/1M tokens |
| Gemini | text-embedding-004 | $0.015/1M tokens |
| Mistral | mistral-embed | $0.10/1M tokens |
| Voyage | voyage-code-2 | $0.12/1M tokens |
| Cohere | embed-english-v3.0 | $0.10/1M tokens |

## Product Spec
Full spec at: `docs/PRODUCT_2_CODEBOT.md`

## Research References
Agent loop patterns based on:
- Claude Code: ReAct loop, single-threaded, context as constraint
- Cline: Plan-Act-Verify loop with human-in-the-loop
- Industry: 3-5 iteration limit typical, validation gates mandatory
