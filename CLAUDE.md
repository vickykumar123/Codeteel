@AGENTS.md

# CodeBot - Project Context

## What is CodeBot?
AI coding agent that:
1. Connects to GitHub repositories
2. Indexes codebase (code + AI summaries)
3. Receives requests via Slack/Telegram/Web
4. Shows implementation plan for approval
5. Creates branches, writes code, opens PRs

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + pgvector + pg_trgm)
- **Auth**: Supabase Auth (email/password + magic link)
- **LLM**: Ollama (local) or OpenAI (cloud)
- **Realtime**: Supabase Realtime (WebSocket for progress updates)
- **Queue**: Supabase pgmq + pg_cron
- **Styling**: TailwindCSS

## Project Structure
```
src/
├── app/
│   ├── page.tsx              # Landing page (redirects if logged in)
│   ├── login/page.tsx        # Login (client component)
│   ├── signup/page.tsx       # Signup (client component)
│   ├── dashboard/page.tsx    # Main dashboard (server component)
│   ├── settings/
│   │   ├── page.tsx          # Settings page (server component)
│   │   └── llm-settings.tsx  # LLM config form (client component)
│   ├── repos/
│   │   ├── [id]/
│   │   │   ├── page.tsx          # Repo detail (server component)
│   │   │   ├── index-button.tsx  # Index trigger + realtime progress
│   │   │   ├── file-list.tsx     # Indexed files display
│   │   │   └── chat/
│   │   │       ├── page.tsx              # New chat (server component)
│   │   │       ├── [chatId]/page.tsx     # Existing chat (server component)
│   │   │       ├── chat-interface.tsx    # Main chat UI (client component)
│   │   │       ├── message-list.tsx      # Messages with markdown
│   │   │       ├── chat-input.tsx        # Input area
│   │   │       ├── sidebar.tsx           # Conversation list
│   │   │       ├── plan-approval.tsx     # Plan review UI
│   │   │       ├── task-progress.tsx     # Execution task list (TODO)
│   │   │       └── branch-modal.tsx      # Branch selection (TODO)
│   │   └── connect/
│   │       ├── page.tsx      # Repo selection (server component)
│   │       └── repo-list.tsx # Repo list (client component)
│   ├── api/
│   │   ├── github/
│   │   │   ├── auth/route.ts     # Initiate GitHub OAuth
│   │   │   └── callback/route.ts # GitHub OAuth callback
│   │   ├── repos/
│   │   │   ├── route.ts              # GET/POST/DELETE repos
│   │   │   ├── [id]/
│   │   │   │   ├── index/route.ts    # Queue files for indexing
│   │   │   │   ├── search/route.ts   # Proxy: vector/text search
│   │   │   │   ├── files/route.ts    # Proxy: read/write GitHub files (NEW)
│   │   │   │   ├── branches/route.ts # Proxy: list/create branches (NEW)
│   │   │   │   └── pr/route.ts       # Proxy: create pull request (NEW)
│   │   ├── conversations/
│   │   │   ├── route.ts              # POST create, GET list (NEW)
│   │   │   └── [id]/
│   │   │       └── messages/route.ts # GET/POST messages (NEW)
│   │   ├── process-index-batch/route.ts # Process batch from queue
│   │   ├── llm/
│   │   │   └── chat/route.ts     # LLM proxy (keeps API keys server-side)
│   │   ├── settings/route.ts     # GET/POST user settings
│   │   └── ollama/models/route.ts # Fetch Ollama models
│   └── auth/
│       ├── callback/route.ts # OAuth/magic link callback
│       └── signout/route.ts  # Sign out handler
├── lib/
│   ├── auth/index.ts         # getCurrentUser, requireAuth
│   ├── db/
│   │   ├── client.ts         # Browser client (singleton) + admin client
│   │   └── server.ts         # Server client (uses cookies)
│   ├── llm/index.ts          # Ollama & OpenAI chat client (uses OpenAI SDK)
│   ├── embeddings/index.ts   # Multi-provider embedding client (1536 dims)
│   ├── github/index.ts       # GitHub API utilities
│   └── agents/
│       ├── index.ts          # Exports orchestrator, executor
│       ├── types.ts          # Tool, Message, Plan, StreamEvent types
│       ├── orchestrator.ts   # Main ReAct loop (pure module, runs in browser or Node.js)
│       ├── search.ts         # Search tools
│       ├── planner.ts        # Planner tools (generates old_string/new_string)
│       ├── executor.ts       # Executor (deterministic edits via applyEdit)
│       ├── edit-utils.ts     # File editing (findAllMatches, applyEdit, findCloseMatch)
│       └── tools/
│           ├── interface.ts  # ToolExecutor interface (swappable)
│           ├── web.ts        # Web impl: fetch() → /api/* (browser + test scripts)
│           └── server.ts     # Server impl: direct DB/GitHub (Slack/Telegram)
├── hooks/
│   └── useOrchestrator.ts    # React wrapper (state, UI events, background DB saves)
├── middleware.ts             # Route protection
└── types/
    └── database.ts           # Auto-generated Supabase types
```

## Database Schema (Supabase)
```
users           - Profile + LLM settings + embedding settings (auto-created on signup via trigger)
repositories    - Connected GitHub repos + index_status
file_summaries  - Code + AI summary + embeddings (trigram + vector search, 1536 dims)
index_jobs      - Track indexing progress (batches, processed_files, status)
tasks           - User requests, plans, execution status
conversations   - Chat conversations with working_branch for edits
messages        - Chat messages (user, assistant, tool, system)
messaging_connections - Slack/Telegram tokens per user
```

## Migrations
- `000_full_schema.sql` - Core tables, triggers, extensions
- `001_indexing_queue.sql` - pgmq queue, pg_cron job, queue functions
- `002_realtime_policies.sql` - RLS policies for Realtime subscriptions
- `003_embedding_settings.sql` - Embedding provider settings, updated queue functions
- `004_conversations.sql` - Conversations, messages tables, search functions
- `005_branch_management.sql` - Add working_branch to conversations (TODO)

## Environment Variables (.env)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:9999

# GitHub OAuth App (NOT GitHub App!)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Cron job authentication (generate with: openssl rand -hex 32)
CRON_SECRET=
```

## Scripts
```bash
pnpm dev        # Start on port 9999
pnpm db:types   # Generate types from Supabase
```

## Completed
- [x] Project setup
- [x] Database schema + migrations
- [x] Supabase types generated
- [x] Auth (login/signup/middleware)
- [x] Dashboard (basic)
- [x] DB clients (browser singleton + server + admin)
- [x] GitHub OAuth - Connect repositories
- [x] Repository connection UI (/repos/connect)
- [x] LLM Settings Page - Configure Ollama/OpenAI (/settings)
- [x] Repository Indexing - Queue-based with streaming
  - LLM client (src/lib/llm) - Ollama & OpenAI support
  - GitHub API client (src/lib/github) - fetch repo tree & files
  - Queue system (pgmq + pg_cron)
  - Streaming endpoints (300s timeout safe for Vercel)
  - Batch processing (25 files per batch)
- [x] Realtime progress updates (Supabase Realtime WebSocket)
- [x] RLS policies for Realtime subscriptions
- [x] Embedding generation during indexing
  - Multi-provider support (OpenAI, Gemini, Mistral, Voyage, Cohere)
  - All providers output 1536 dimensions
  - Embedding client library (src/lib/embeddings)
  - Settings UI for embedding provider configuration
- [x] Large file chunking for summaries
  - Chunk by lines (500) or chars (6000) with overlap
  - Summarize each chunk, combine with LLM
  - Thresholds: > 2000 lines OR > 8000 chars
- [x] Parallel file processing
  - Ollama: 2 concurrent files (rate limit safe)
  - OpenAI: 10 concurrent files
- [x] Comprehensive file filtering
  - Skip: lock files, build dirs, assets, minified, generated
  - Index: code files, infra configs, documentation
- [x] Web Chat Interface
  - Full-page chat UI with sidebar
  - Markdown rendering in messages
  - Conversation history and switching
  - URL structure: /repos/[id]/chat/[chatId]
- [x] Hierarchical Agent System
  - Orchestrator agent (coordinates sub-agents)
  - Search agent (semantic + text search)
  - Planner agent (creates implementation plans)
  - Executor agent (GitHub API: branch, write, PR)
  - Plan approval flow with UI

## Next Steps (TODO)
1. ~~**Web Chat Interface**~~ - ✅ Chat with indexed codebase (completed)
2. ~~**Hierarchical Agent System**~~ - ✅ Orchestrator + Search + Planner + Executor (completed)
3. ~~**Branch Management**~~ - ✅ Branch selection/creation before edits (completed)
   - [x] Add `working_branch` column to conversations table
   - [x] Branch API endpoints (GET /branches, POST /branches)
   - [x] Branch selector UI component (Web)
   - [x] `request_branch_selection` tool for agent
   - [x] `branch_selection_required` stream event
   - [ ] Platform handlers (Slack text, Telegram buttons) - deferred to integration phase
4. ~~**File Editing (Custom Implementation)**~~ - ✅ Deterministic edit logic (completed)
   - [x] Create `src/lib/agents/edit-utils.ts` with edit algorithm
   - [x] Add `edit_file` tool to executor tools
   - [x] Implement `findAllMatches()` for exact string matching
   - [x] Implement `applyEdit()` with uniqueness validation
   - [x] Implement `findCloseMatch()` for whitespace hints
   - [x] Add actionable error messages for LLM self-correction
   - [x] Integrate with GitHub Contents API for commits
   **Note:** PlanStep is TEXT only (description). old_string/new_string generated at
   execution time by LLM per step. applyEdit() applies deterministically.
5. **Move Orchestrator to Frontend** - Client-side agent loop
   - [ ] Create `ToolExecutor` interface (`src/lib/agents/tools/interface.ts`)
   - [ ] Create `WebToolExecutor` (`src/lib/agents/tools/web.ts`) - fetch() → /api/*
   - [ ] Create thin API routes:
     - [ ] `POST /api/repos/[id]/search` - vector/text search proxy
     - [ ] `GET /api/repos/[id]/files/[...path]` - read file from GitHub
     - [ ] `PUT /api/repos/[id]/files/[...path]` - write/edit file on GitHub
     - [ ] `GET /api/repos/[id]/branches` - list branches
     - [ ] `POST /api/repos/[id]/branches` - create branch
     - [ ] `POST /api/repos/[id]/pr` - create pull request
     - [ ] `POST /api/conversations` - create conversation
     - [ ] `GET /api/conversations/[id]/messages` - load messages
     - [ ] `POST /api/conversations/[id]/messages` - save message
   - [ ] Refactor `orchestrator.ts` to accept `ToolExecutor` (pure module)
   - [ ] Move LLM calls to browser fetch (Ollama/OpenAI directly)
   - [ ] Create `useOrchestrator` React hook
   - [ ] Add [Approve] / [Reject] buttons to plan display
   - [ ] Add branch modal guard before execution
   - [ ] Add conversation creation guard on first message
   - [ ] Background DB saves (messages, execution state)
   - [ ] Update test scripts to use same fetch-based pattern
6. **Task Tracking (Todo List)** - Track execution progress in UI
   - [x] Add `ExecutionTask` interface to types.ts
   - [ ] Convert plan.steps → tasks at execution start (in React state)
   - [ ] Show task progress UI during execution
   - [ ] Update task status as steps complete/fail
   **Note:** Plan steps ARE the tasks. No separate storage - just React state during execution.
7. **Slack/Telegram Integration** - Messaging bots (uses ServerToolExecutor)

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
