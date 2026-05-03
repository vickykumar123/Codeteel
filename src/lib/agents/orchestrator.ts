// Orchestrator Agent - PURE ROUTER to sub-agents
//
// Pure module: no Supabase, no Next.js, no @/lib/llm imports.
// All DB/API access goes through ToolExecutor.
// LLM calls go through injected ChatFn.
// Works in browser (WebToolExecutor) or server (ServerToolExecutor).
//
// Architecture:
//   - Orchestrator is a PURE ROUTER — it does NOT execute tools itself
//   - Questions: delegates to Search Agent (which has its own ReAct loop)
//   - Code changes: delegates to Planner Agent (which searches + plans)
//   - Execution: delegates to Executor Agent (reads files, generates code, commits)
//   - PR creation: handled via ToolExecutor

import type { ToolExecutor } from "./tools/interface";
import type {
  AgentContext,
  AgentMessage,
  Tool,
  ToolCall,
  Plan,
  StreamEvent,
  PersistedExecutionState,
  ChatFn,
  LLMChatMessage,
  LLMToolDef,
  LLMToolCall,
} from "./types";
import { runSearch } from "./search";
import { runPlanner } from "./planner";
import { runExecutor } from "./executor";
import { reviewPR, reviewIssue, listOpenPRs, listOpenIssues, securityScan } from "./reviewer";
import {
  compressConversation,
  buildCompressedMessages,
  countMessagesTokens,
  countTokens,
  shouldCompress,
  type ChatSummary,
} from "./compression";
import { MAX_ORCHESTRATOR_ITERATIONS, SAME_ACTION_LIMIT, APPROVAL_PHRASES, REJECTION_PHRASES, PAUSE_PHRASES } from "./constants";
import type { SearchJournalEntry } from "./types";

const MAX_JOURNAL_ENTRIES = 7;

function addJournalEntry(
  journal: SearchJournalEntry[],
  entry: SearchJournalEntry,
): SearchJournalEntry[] {
  const updated = [...journal, entry];
  return updated.slice(-MAX_JOURNAL_ENTRIES); // Keep last 7
}

// Approval/Rejection/Pause phrases imported from constants.ts (single source of truth)

function isApprovalMessage(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  if (APPROVAL_PHRASES.includes(normalized)) return true;
  return APPROVAL_PHRASES.some(
    (p) =>
      normalized.startsWith(p + ",") ||
      normalized.startsWith(p + ".") ||
      normalized.startsWith(p + "!") ||
      normalized.startsWith(p + " ")
  );
}

function isRejectionMessage(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  // Exact match
  if (REJECTION_PHRASES.includes(normalized)) return true;
  // Starts with rejection phrase
  if (REJECTION_PHRASES.some(
    (p) =>
      normalized.startsWith(p + ",") ||
      normalized.startsWith(p + ".") ||
      normalized.startsWith(p + "!") ||
      normalized.startsWith(p + " ")
  )) return true;
  // Contains "instead" — strong signal of rejection + new request
  // e.g. "No, instead add a /metrics endpoint"
  if (normalized.includes("instead")) return true;
  return false;
}

function isPauseMessage(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  if (PAUSE_PHRASES.includes(normalized)) return true;
  return PAUSE_PHRASES.some(
    (p) =>
      normalized.startsWith(p + ",") ||
      normalized.startsWith(p + ".") ||
      normalized.startsWith(p + "!") ||
      normalized.startsWith(p + " ")
  );
}

// ===========================================
// TOOL CALL RECOVERY (for OSS models via Ollama)
// ===========================================
// OSS models sometimes output tool calls as plain JSON text instead of
// proper function calls. This function detects common patterns and
// converts them to real tool calls so the orchestrator can proceed.

function recoverToolCallFromText(
  content: string,
  context: AgentContext,
  hasPendingPlan: boolean,
): LLMToolCall | null {
  const trimmed = content.trim();

  // Pattern 1: Raw JSON with "request" field → delegate_to_planner
  // e.g. {"request": "Add a /metrics endpoint..."}
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.request && typeof parsed.request === "string") {
      return {
        id: `recovered-${Date.now()}`,
        type: "function" as const,
        function: {
          name: "delegate_to_planner",
          arguments: JSON.stringify({ request: parsed.request }),
        },
      };
    }
    if (parsed.question && typeof parsed.question === "string") {
      return {
        id: `recovered-${Date.now()}`,
        type: "function" as const,
        function: {
          name: "delegate_to_search",
          arguments: JSON.stringify({ question: parsed.question }),
        },
      };
    }
  } catch {
    // Not valid JSON — try other patterns
  }

  // Pattern 2: Content contains a JSON block (possibly with surrounding text)
  const jsonMatch = trimmed.match(/\{[\s\S]*"(?:request|question)"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.request) {
        return {
          id: `recovered-${Date.now()}`,
          type: "function" as const,
          function: {
            name: "delegate_to_planner",
            arguments: JSON.stringify({ request: parsed.request }),
          },
        };
      }
      if (parsed.question) {
        return {
          id: `recovered-${Date.now()}`,
          type: "function" as const,
          function: {
            name: "delegate_to_search",
            arguments: JSON.stringify({ question: parsed.question }),
          },
        };
      }
    } catch {
      // Couldn't parse extracted JSON
    }
  }

  // Pattern 3: LLM asks a confirmation question instead of acting
  // e.g. "Should I go ahead and add a /status endpoint?"
  // If working branch is set and no plan pending, this should have been a planner call
  if (
    context.workingBranch &&
    !hasPendingPlan &&
    /should I|shall I|would you like me to|want me to/i.test(trimmed) &&
    /add|create|modify|update|delete|remove|fix|refactor/i.test(trimmed)
  ) {
    return {
      id: `recovered-${Date.now()}`,
      type: "function" as const,
      function: {
        name: "delegate_to_planner",
        arguments: JSON.stringify({ request: trimmed }),
      },
    };
  }

  return null;
}

/**
 * Recover tool calls from the user message when the LLM returns empty/no response.
 * This handles cases where OSS models fail to produce any output for certain requests.
 */
function recoverFromUserMessage(
  userMessage: string,
  filesChanged: string[],
  prCreated: boolean,
): LLMToolCall | null {
  const normalized = userMessage.toLowerCase();

  // User asks to create PR and there are files changed
  if (
    !prCreated &&
    filesChanged.length > 0 &&
    /\b(create|open|make|submit)\b.*\b(pr|pull request)\b/i.test(userMessage)
  ) {
    // Extract title from user message if present
    const titleMatch = userMessage.match(/title\s+(?:it\s+)?['""]([^'""]+)['""]|['""]([^'""]+)['""]|title:\s*(.+)/i);
    const title = titleMatch?.[1] || titleMatch?.[2] || titleMatch?.[3] || "Code changes";

    return {
      id: `recovered-${Date.now()}`,
      type: "function" as const,
      function: {
        name: "create_pr",
        arguments: JSON.stringify({
          title,
          body: `Changes made:\n${filesChanged.map(f => `- ${f}`).join("\n")}`,
        }),
      },
    };
  }

  return null;
}

// ===========================================
// ORCHESTRATOR SYSTEM PROMPT
// ===========================================

const orchestratorSystemPrompt = `You are Codeteel, an AI coding assistant. You are a ROUTER — you MUST delegate to specialized agents using tools. You NEVER answer questions about code yourself or describe changes without delegating.

## Tools

| Tool | When to use |
|------|-------------|
| think | Reason about a complex or ambiguous request before deciding which tool to call |
| delegate_to_search | Any question about the codebase (read-only) |
| request_branch_selection | Before planning code changes (if no branch set) |
| delete_files | User wants to delete/remove files ONLY (no other ops) |
| delegate_to_planner | Any code change (add, modify, create, refactor, fix, or mixed ops including delete) |
| execute_plan | User approved a plan — execute immediately, no re-planning |
| create_pr | User explicitly asks to create a pull request |
| web_search | User explicitly asks to search the web |
| web_fetch | User provides a URL to read |
| review_pr | Review a PR (with number) or list open PRs (without) |
| review_issue | Review an issue (with number) or list open issues (without) |
| security_scan | Scan codebase for security vulnerabilities (optional path to scope the scan) |

## Routing

1. **Greeting** ("hi", "hello") → Respond directly, ask how you can help
2. **Code question** ("what does X do?", "how does X work?", "explain", "tell me about") → MUST call delegate_to_search
3. **Delete only** ("delete X", "remove X" with no other ops) → delete_files → wait for approval
4. **Code change** ("add", "create", "modify", "fix", "refactor", or mixed ops) → ensure branch → MUST call delegate_to_planner → wait for approval
5. **Follow-up change** ("now add X to that file", "also add X") → MUST call delegate_to_planner (this is a change, not a question)
6. **Approval** ("yes", "go ahead", "do it", "looks good") → execute_plan immediately
7. **Create PR** → create_pr
8. **Web search/fetch** → only when user explicitly asks
9. **Review PR/issue** ("review PR", "review issue", "show PRs", "show issues", "list PRs", "list issues", "open PRs", "open issues") → MUST call review_pr or review_issue
10. **Security scan** ("check security", "security audit", "scan for vulnerabilities", "find security issues") → MUST call security_scan

## Rules
- ALWAYS delegate — never answer code questions yourself, never describe code changes without calling delegate_to_planner
- For ANY question about the codebase, you MUST call delegate_to_search. Do NOT respond with text about the code.
- For ANY code change request, you MUST call delegate_to_planner. Do NOT describe the change in text — delegate it.
- For PR/issue reviews, you MUST call review_pr or review_issue. Do NOT answer about PRs/issues without using the tool.
- After planning, STOP and wait for user approval before executing
- On approval, call execute_plan immediately — do not re-plan or re-search
- Call delegate_to_planner once per request — it handles searching internally
- Never call web_search/web_fetch unless the user explicitly asks
- Never create a PR unless the user explicitly asks
- Respond naturally in plain text. Do not use bullet points or dashes for simple responses like greetings. Keep responses concise.`;

// ===========================================
// ORCHESTRATOR-SPECIFIC TOOLS
// ===========================================

const orchestratorTools: Tool[] = [
  {
    name: "think",
    description:
      "Use this to reason about the user's request before deciding which tool to call. Call this when: (1) the request involves multiple operations (create + modify + delete), (2) you're unsure whether to use delete_files vs delegate_to_planner, (3) the request is ambiguous. Do NOT call this for simple requests.",
    parameters: {
      type: "object",
      properties: {
        thought: {
          type: "string",
          description: "Your reasoning about the request and which tool to use next",
        },
      },
      required: ["thought"],
    },
  },
  {
    name: "delegate_to_search",
    description:
      "Delegate to the Search Agent which will explore the codebase and answer the user's question. The Search Agent has its own tools (semantic_search, text_search, read_file, list_files, list_code_definitions) — you do NOT need to search yourself.",
    parameters: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description:
            "The user's question about the codebase (pass it as-is or lightly summarized)",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "request_branch_selection",
    description:
      "Request user to select or create a branch for making code changes. Call this BEFORE delegate_to_planner if no working branch is set.",
    parameters: {
      type: "object",
      properties: {
        suggested_name: {
          type: "string",
          description:
            "Suggested branch name based on the task (e.g., 'feature/add-logging')",
        },
      },
      required: ["suggested_name"],
    },
  },
  {
    name: "delegate_to_planner",
    description:
      "Delegate to the Planner Agent which will explore the codebase and create an implementation plan. The Planner has its own search tools — you do NOT need to search first. Just pass the user's request.",
    parameters: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description:
            "The user's request for code changes (pass it as-is or lightly summarized)",
        },
      },
      required: ["request"],
    },
  },
  {
    name: "delete_files",
    description:
      "Instantly create a delete plan for one or more files. Bypasses the planner — no searching needed. Use this when the user wants to DELETE or REMOVE files.",
    parameters: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description:
            "File paths to delete (e.g., ['src/utils/logger.py', 'src/utils/formatters.py'])",
        },
        reason: {
          type: "string",
          description: "Brief reason for deletion (used in plan summary)",
        },
      },
      required: ["paths"],
    },
  },
  {
    name: "execute_plan",
    description:
      "Execute the approved plan by delegating to the Executor Agent. ONLY call this AFTER user has approved the plan.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_pr",
    description:
      "Create a pull request for the changes made. Only call when user explicitly asks.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "PR title",
        },
        body: {
          type: "string",
          description: "PR description",
        },
      },
      required: ["title", "body"],
    },
  },
  {
    name: "web_search",
    description:
      "Search the web using DuckDuckGo. ONLY use when the user explicitly asks to search the web, look something up online, or find external documentation. Do NOT use automatically — only on user request.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "web_fetch",
    description:
      "Fetch and extract text content from a specific URL. ONLY use when the user provides a URL and asks to read/check it. Do NOT use automatically.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "review_pr",
    description:
      "Review a pull request. If no PR number is given, lists open PRs. If a number is given, reviews that PR's code changes.",
    parameters: {
      type: "object",
      properties: {
        number: {
          type: "number",
          description: "PR number to review. Omit to list all open PRs.",
        },
      },
    },
  },
  {
    name: "review_issue",
    description:
      "Review a GitHub issue. If no issue number is given, lists open issues. If a number is given, reviews that issue.",
    parameters: {
      type: "object",
      properties: {
        number: {
          type: "number",
          description: "Issue number to review. Omit to list all open issues.",
        },
      },
    },
  },
  {
    name: "security_scan",
    description:
      "Scan for CRITICAL and HIGH security vulnerabilities. Can scan the codebase, a specific path, or a PR diff.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Optional path to scope the scan (e.g., 'src/api'). Omit to scan the entire codebase.",
        },
        pr_number: {
          type: "number",
          description: "Optional PR number to scan only the changed files in that PR.",
        },
      },
    },
  },
];

// ===========================================
// TOOL CONVERSION FOR LLM
// ===========================================

function toolsToLLMFormat(tools: Tool[]): LLMToolDef[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function convertToolCalls(llmToolCalls: LLMToolCall[]): ToolCall[] {
  return llmToolCalls.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments || "{}"),
  }));
}

// ===========================================
// RUN ORCHESTRATOR
// ===========================================

export async function runOrchestrator(
  userMessage: string,
  context: AgentContext,
  executor: ToolExecutor,
  chatFn: ChatFn,
  onEvent: (event: StreamEvent) => void,
  initialState?: PersistedExecutionState,
): Promise<{
  response: string;
  plan?: Plan;
  executionState: PersistedExecutionState;
}> {
  // Orchestrator tools: delegation only (no search tools)
  const allTools = orchestratorTools;
  let iterations = 0;
  const actionHistory: string[] = [];

  // Initialize from persisted state
  let currentPlan: Plan | undefined = initialState?.currentPlan;
  let filesChanged: string[] = initialState?.filesChanged || [];
  let prCreated = initialState?.prCreated || false;
  let prUrl = initialState?.prUrl;
  let prNumber = initialState?.prNumber;
  let searchJournal: SearchJournalEntry[] = initialState?.searchJournal || [];

  // Short-circuit: if there's a pending plan and user sends approval,
  // execute directly without LLM call (LLM sometimes re-plans instead)
  if (currentPlan && context.workingBranch && isApprovalMessage(userMessage)) {
    onEvent({ type: "thinking", message: "Executing approved plan..." });

    const execResult = await runExecutor(currentPlan, context, executor, chatFn, onEvent);
    if (execResult.success) {
      filesChanged = [...new Set([...filesChanged, ...(execResult.filesChanged || [])])];
      const executedPlanTitle = currentPlan.title;
      currentPlan = undefined;
      onEvent({ type: "execution_complete", filesChanged });

      const responseText = `Executed plan "${executedPlanTitle}" successfully. Changed ${filesChanged.length} file(s): ${filesChanged.join(", ")}`;
      onEvent({ type: "message", content: responseText });

      return {
        response: responseText,
        executionState: { filesChanged, currentPlan, prCreated, prUrl, prNumber, searchJournal },
      };
    } else {
      const errorMsg = `Execution failed: ${execResult.error}`;
      onEvent({ type: "error", message: errorMsg });
      return {
        response: errorMsg,
        executionState: { filesChanged, currentPlan, prCreated, prUrl, prNumber, searchJournal },
      };
    }
  }

  // Short-circuit: if user says "stop"/"cancel"/"wait" — keep the plan intact, just pause
  if (currentPlan && isPauseMessage(userMessage)) {
    const responseText = `Paused. Your plan "${currentPlan.title}" is still saved. Say "go ahead" to execute it, or send a new request.`;
    onEvent({ type: "message", content: responseText });
    return {
      response: responseText,
      executionState: { filesChanged, currentPlan, prCreated, prUrl, prNumber, searchJournal },
    };
  }

  // Short-circuit: if there's a pending plan and user sends a rejection,
  // clear the plan and feed the new request to the LLM with explicit instructions
  // to call delegate_to_planner (LLM sometimes just narrates instead of acting)
  if (currentPlan && isRejectionMessage(userMessage)) {
    const rejectedTitle = currentPlan.title;
    currentPlan = undefined; // Clear so LLM doesn't see "PENDING PLAN EXISTS"

    // Extract the new request from the rejection message (everything after rejection phrase)
    // The full user message goes to the LLM, but we also inject a system nudge
    onEvent({ type: "thinking", message: `Plan "${rejectedTitle}" rejected. Creating new plan...` });
  }

  // Build system context with current state info
  // This is done AFTER the rejection short-circuit so cleared plans are reflected.
  let systemContext = orchestratorSystemPrompt;

  // Inject current plan context if exists (uses live variable, not initialState)
  if (currentPlan) {
    systemContext += `\n\n## CRITICAL - PENDING PLAN EXISTS:
A plan is ALREADY created and waiting for action:
- Plan Title: "${currentPlan.title}"
- Files to modify: ${currentPlan.filesAffected?.join(", ") || "N/A"}
- Steps: ${currentPlan.steps.length} changes

IMPORTANT: Check if user message is an approval or retry request:
- "yes", "go ahead", "proceed", "do it", "ok", "sure", "try again", "retry" = EXECUTE
- If user approves OR asks to retry → call execute_plan IMMEDIATELY as your first and only action
- DO NOT call delegate_to_planner again. The plan is ready. Just execute it.
- Only create a new plan if the user explicitly asks for a DIFFERENT approach.`;
  }

  // Inject files changed context
  if (filesChanged.length > 0) {
    systemContext += `\n\n## EXECUTION COMPLETED:
Files already modified: ${filesChanged.join(", ")}
${prCreated ? `PR already created: ${prUrl}` : "PR not yet created. Call create_pr only when user asks."}`;
  }

  // Inject custom instructions
  if (context.customInstructions) {
    systemContext += `\n\n## CUSTOM INSTRUCTIONS (from user/repo settings — follow these):
${context.customInstructions}`;
  }

  // Inject search journal
  const journal = initialState?.searchJournal;
  if (journal && journal.length > 0) {
    const journalText = journal.map(j =>
      `- "${j.query}" → ${j.filesFound.join(", ")} (${j.summary})`
    ).join("\n");
    systemContext += `\n\n## PREVIOUS SEARCHES (from this conversation):
${journalText}
If the user references files already found above, delegate directly — don't search again.`;
  }

  // Inject branch context
  if (context.workingBranch) {
    systemContext += `\n\n## BRANCH INFO:
Working branch is set: "${context.workingBranch}"
You can proceed with delegate_to_planner directly.`;
  } else {
    systemContext += `\n\n## BRANCH INFO:
NO working branch is set. Before calling delegate_to_planner, you MUST call request_branch_selection first.`;
  }

  const messages: AgentMessage[] = [
    { role: "system", content: systemContext },
    ...context.messages,
    { role: "user", content: userMessage },
  ];

  // --- Chat Compression ---
  // Fetch existing summary and check if compression is needed before LLM calls
  let chatSummary: ChatSummary | null = null;
  try {
    const existing = await executor.getChatSummary(context.conversationId);
    if (existing) {
      chatSummary = {
        conversationId: existing.conversationId,
        summary: existing.summary,
        lastMessageId: existing.lastMessageId,
        tokensCompressed: existing.tokensCompressed,
      };
    }
  } catch {
    // No summary yet — that's fine
  }

  // Fetch DB messages for compression cutoff tracking
  let dbMessages = await executor.getMessages(context.conversationId);

  onEvent({ type: "thinking", message: "Analyzing your request..." });

  while (iterations < MAX_ORCHESTRATOR_ITERATIONS) {
    iterations++;

    // --- Check if compression is needed ---
    const summaryTokens = chatSummary ? countTokens(chatSummary.summary) : 0;
    const messagesTokens = countMessagesTokens(messages);
    if (shouldCompress(summaryTokens, messagesTokens)) {
      onEvent({ type: "thinking", message: "Compressing conversation history..." });
      try {
        chatSummary = await compressConversation(
          context.conversationId, executor, chatFn, chatSummary,
        );
        // Refresh DB messages after compression (summary points to a message ID)
        dbMessages = await executor.getMessages(context.conversationId);
      } catch (err) {
        // Compression failed — continue without it
        const msg = err instanceof Error ? err.message : "Unknown error";
        onEvent({ type: "thinking", message: `Compression skipped: ${msg}` });
      }
    }

    // Build LLM messages (compressed if summary exists)
    const llmMessages: LLMChatMessage[] = buildCompressedMessages(
      systemContext, messages, chatSummary, dbMessages,
    ).map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool" as const,
          content: m.content,
          tool_call_id: m.tool_call_id,
          name: m.name,
        };
      }
      if (m.role === "assistant" && m.tool_calls) {
        return {
          role: "assistant" as const,
          content: m.content,
          tool_calls: m.tool_calls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });

    const response = await chatFn(llmMessages, toolsToLLMFormat(allTools));

    // Fallback: OSS models (Ollama) sometimes return tool calls as JSON text
    // instead of proper function calls. Detect and convert them.
    if (!response.tool_calls || response.tool_calls.length === 0) {
      const recovered = response.content
        ? recoverToolCallFromText(response.content, context, !!currentPlan)
        : recoverFromUserMessage(userMessage, filesChanged, prCreated);
      if (recovered) {
        response.tool_calls = [recovered];
      }
    }

    // No tool calls → final response
    if (!response.tool_calls || response.tool_calls.length === 0) {
      onEvent({ type: "message", content: response.content });
      const executionState: PersistedExecutionState = {
        filesChanged, currentPlan, prCreated, prUrl, prNumber, searchJournal,
      };
      return { response: response.content, plan: currentPlan, executionState };
    }

    const toolCalls = convertToolCalls(response.tool_calls);

    for (const toolCall of toolCalls) {
      // Loop detection
      const actionKey = `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`;
      if (actionHistory.filter((a) => a === actionKey).length >= SAME_ACTION_LIMIT) {
        onEvent({ type: "error", message: "I seem to be stuck. Let me try a different approach." });
        const executionState: PersistedExecutionState = {
          filesChanged, currentPlan, prCreated, prUrl, prNumber, searchJournal,
        };
        return {
          response: "I encountered an issue and couldn't complete the task. Please try rephrasing your request.",
          executionState,
        };
      }
      actionHistory.push(actionKey);

      onEvent({ type: "tool_call", tool: toolCall.name, args: toolCall.arguments });

      let result: string;
      let error = false;

      // =============================================
      // THINK (reasoning scratchpad — returns thought back to LLM)
      // =============================================
      if (toolCall.name === "think") {
        const thought = toolCall.arguments.thought as string;
        onEvent({ type: "thinking", message: "Reasoning about your request..." });
        result = `Thought noted: ${thought}\n\nNow call the appropriate tool based on your reasoning.`;

      // =============================================
      // DELEGATE TO SEARCH AGENT
      // =============================================
      } else if (toolCall.name === "delegate_to_search") {
        const question = toolCall.arguments.question as string;
        onEvent({ type: "thinking", message: "Searching codebase..." });

        const searchResult = await runSearch(question, context, executor, chatFn, onEvent, { filesChanged });

        // Update search journal
        if (searchResult.filesFound && searchResult.filesFound.length > 0) {
          searchJournal = addJournalEntry(searchJournal, {
            query: question,
            filesFound: searchResult.filesFound,
            summary: searchResult.answer.slice(0, 150),
          });
        }

        if (!context.customInstructions) {
          // No custom instructions — return search results directly to user
          // (don't let the LLM summarize the detailed answer into a vague one-liner)
          onEvent({ type: "message", content: searchResult.answer });
          const executionState: PersistedExecutionState = {
            filesChanged, currentPlan, prCreated, prUrl, prNumber, searchJournal,
          };
          return { response: searchResult.answer, executionState };
        }

        // Custom instructions exist — feed search result back to orchestrator LLM
        // so it can reformat the answer following user's style preferences
        result = `Search agent found the answer:\n\n${searchResult.answer}\n\n[REFLECT: Does this fully answer the user's question? If yes, present the answer following the CUSTOM INSTRUCTIONS. If not, you may use think to reason about what's missing, or delegate_to_search again with a refined question.]`;

      // =============================================
      // BRANCH SELECTION
      // =============================================
      } else if (toolCall.name === "request_branch_selection") {
        if (context.workingBranch) {
          result = `Working branch is already set to '${context.workingBranch}'. You can proceed with delegate_to_planner.`;
        } else {
          const suggestedName = (toolCall.arguments.suggested_name as string) || "feature/changes";

          onEvent({
            type: "branch_selection_required",
            request: {
              availableBranches: [],
              suggestedName,
              defaultBase: context.defaultBranch,
              protectedBranches: ["main", "master"],
            },
          });

          // Return early — wait for branch selection
          const executionState: PersistedExecutionState = {
            filesChanged, currentPlan, prCreated, prUrl, prNumber, searchJournal,
          };

          onEvent({ type: "tool_result", tool: toolCall.name, result: "Waiting for branch selection", error: false });
          onEvent({ type: "message", content: "Please select or create a branch to continue." });
          onEvent({ type: "done" });

          return {
            response: "Please select or create a branch to continue.",
            executionState,
          };
        }

      // =============================================
      // DELETE FILES (instant plan, no planner needed)
      // =============================================
      } else if (toolCall.name === "delete_files") {
        if (!context.workingBranch) {
          onEvent({
            type: "branch_selection_required",
            request: {
              availableBranches: [],
              suggestedName: "feature/cleanup",
              defaultBase: context.defaultBranch,
              protectedBranches: ["main", "master"],
            },
          });
          result = "Cannot delete without a working branch. Branch selection required.";
          error = true;
        } else {
          const paths = toolCall.arguments.paths as string[];
          const reason = (toolCall.arguments.reason as string) || "Files no longer needed";

          const plan: Plan = {
            id: `plan-${Date.now()}`,
            title: paths.length === 1 ? `Delete ${paths[0]}` : `Delete ${paths.length} files`,
            summary: reason,
            steps: paths.map((p, i) => ({
              id: `step-${i + 1}`,
              type: "delete" as const,
              path: p,
              description: `Delete this file — ${reason}`,
            })),
            filesAffected: paths,
            estimatedChanges: paths.length,
            createdAt: new Date().toISOString(),
          };

          currentPlan = plan;
          onEvent({ type: "plan_pending", plan: currentPlan });

          const stepsFormatted = plan.steps
            .map((step, i) => `${i + 1}. **DELETE** \`${step.path}\`\n   ${step.description}`)
            .join("\n\n");

          result = `Delete plan created: "${plan.title}" with ${plan.steps.length} step(s).\n\n${stepsFormatted}\n\nWaiting for user approval.`;
        }

      // =============================================
      // DELEGATE TO PLANNER AGENT
      // =============================================
      } else if (toolCall.name === "delegate_to_planner") {
        // Guard: branch must be set
        if (!context.workingBranch) {
          onEvent({
            type: "branch_selection_required",
            request: {
              availableBranches: [],
              suggestedName: "feature/changes",
              defaultBase: context.defaultBranch,
              protectedBranches: ["main", "master"],
            },
          });
          result = "Cannot plan without a working branch. Branch selection required.";
          error = true;
        } else {
          // Run the planner sub-agent (passes executor + chatFn through)
          const request = toolCall.arguments.request as string;
          onEvent({ type: "thinking", message: "Exploring codebase and creating plan..." });

          const planResult = await runPlanner(request, context, executor, chatFn, onEvent, {
            filesChanged,
            searchJournal: initialState?.searchJournal,
          });

          if (planResult.plan) {
            currentPlan = planResult.plan;

            // Update search journal with files found during planning
            if (planResult.filesFound && planResult.filesFound.length > 0) {
              searchJournal = addJournalEntry(searchJournal, {
                query: request,
                filesFound: planResult.filesFound,
                summary: `Plan: ${planResult.plan.title}`,
              });
            }

            onEvent({ type: "plan_pending", plan: currentPlan });

            const stepsFormatted = currentPlan.steps
              .map((step, i) => `${i + 1}. **${step.type.toUpperCase()}** \`${step.path}\`\n   ${step.description}`)
              .join("\n\n");

            result = `Plan created: "${currentPlan.title}" with ${currentPlan.steps.length} steps.\n\n${stepsFormatted}\n\n[REFLECT: Does this plan fully address the user's request? If something looks off, you may use think to reason before presenting. Otherwise, present the plan and wait for approval.]`;
          } else {
            result = `Planner failed: ${planResult.error || "Unknown error"}`;
            error = true;
          }
        }

      // =============================================
      // DELEGATE TO EXECUTOR AGENT
      // =============================================
      } else if (toolCall.name === "execute_plan") {
        if (!currentPlan) {
          result = "No plan to execute. Use delegate_to_planner first.";
          error = true;
        } else if (!context.workingBranch) {
          result = "No working branch selected.";
          error = true;
        } else {
          const execResult = await runExecutor(currentPlan, context, executor, chatFn, onEvent);
          if (execResult.success) {
            filesChanged = [...new Set(execResult.filesChanged || [])];
            currentPlan = undefined; // Clear plan after execution
            result = `Execution complete! Changed ${filesChanged.length} file(s): ${filesChanged.join(", ")}`;
            onEvent({ type: "execution_complete", filesChanged });
          } else {
            result = `Execution failed: ${execResult.error}\n\n[REFLECT: The execution had issues. Use think to assess what went wrong before responding to the user.]`;
            error = true;
          }
        }

      // =============================================
      // CREATE PR (via ToolExecutor)
      // =============================================
      } else if (toolCall.name === "create_pr") {
        if (prCreated) {
          result = `PR already created: #${prNumber} - ${prUrl}`;
        } else if (filesChanged.length === 0) {
          result = "No changes made yet. Execute a plan first.";
          error = true;
        } else if (!context.workingBranch) {
          result = "No working branch set.";
          error = true;
        } else {
          try {
            const prResult = await executor.createPR(context.repoId, {
              title: toolCall.arguments.title as string,
              body: `${toolCall.arguments.body as string}\n\n---\n*Created by Codeteel*`,
              head: context.workingBranch,
              base: context.defaultBranch,
            });
            prCreated = true;
            prUrl = prResult.url;
            prNumber = prResult.number;
            result = `Created PR #${prResult.number}: ${prResult.url}`;
            onEvent({ type: "pr_created", url: prResult.url, number: prResult.number });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            result = `Failed to create PR: ${msg}`;
            error = true;
          }
        }
      // =============================================
      // WEB SEARCH (DuckDuckGo — user-triggered only)
      // =============================================
      } else if (toolCall.name === "web_search") {
        const query = toolCall.arguments.query as string;
        onEvent({ type: "thinking", message: `Searching the web for "${query}"...` });

        try {
          const results = await executor.webSearch(query, 5);
          if (results.length === 0) {
            result = `No web results found for "${query}". Try a different query.`;
          } else {
            result = `Web search results for "${query}":\n\n` +
              results.map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`).join("\n\n");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          result = `Web search failed: ${msg}\n\nDo NOT retry web_search. Tell the user the web search is temporarily unavailable and offer to help with their question using your own knowledge instead.`;
          error = true;
        }

      // =============================================
      // WEB FETCH (URL → text — user-triggered only)
      // =============================================
      } else if (toolCall.name === "web_fetch") {
        const url = toolCall.arguments.url as string;
        onEvent({ type: "thinking", message: `Fetching ${url}...` });

        try {
          const page = await executor.webFetch(url);
          result = `**${page.title}**\n${page.url}\n\n${page.content}`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          result = `Failed to fetch URL: ${msg}\n\nDo NOT retry web_fetch. Tell the user the page could not be fetched and suggest they check the URL or try again later.`;
          error = true;
        }

      // =============================================
      // REVIEW PR
      // =============================================
      } else if (toolCall.name === "review_pr") {
        const prNumber = toolCall.arguments.number as number | undefined;

        if (!prNumber) {
          // List open PRs
          onEvent({ type: "thinking", message: "Fetching open pull requests..." });
          try {
            result = await listOpenPRs(context, executor);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            result = `Failed to list PRs: ${msg}`;
            error = true;
          }
        } else {
          // Review specific PR
          onEvent({ type: "thinking", message: `Reviewing PR #${prNumber}...` });
          const reviewResult = await reviewPR(prNumber, context, executor, chatFn, onEvent);
          if (reviewResult.error) {
            result = reviewResult.error;
            error = true;
          } else {
            // Return review directly to user
            onEvent({ type: "message", content: reviewResult.review });
            const executionState: PersistedExecutionState = {
              filesChanged, currentPlan, prCreated, prUrl, prNumber: prNumber as number, searchJournal,
            };
            return { response: reviewResult.review, executionState };
          }
        }

      // =============================================
      // REVIEW ISSUE
      // =============================================
      } else if (toolCall.name === "review_issue") {
        const issueNumber = toolCall.arguments.number as number | undefined;

        if (!issueNumber) {
          // List open issues
          onEvent({ type: "thinking", message: "Fetching open issues..." });
          try {
            result = await listOpenIssues(context, executor);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            result = `Failed to list issues: ${msg}`;
            error = true;
          }
        } else {
          // Review specific issue
          onEvent({ type: "thinking", message: `Reviewing issue #${issueNumber}...` });
          const reviewResult = await reviewIssue(issueNumber, context, executor, chatFn, onEvent);
          if (reviewResult.error) {
            result = reviewResult.error;
            error = true;
          } else {
            onEvent({ type: "message", content: reviewResult.review });
            const executionState: PersistedExecutionState = {
              filesChanged, currentPlan, prCreated, prUrl, prNumber, searchJournal,
            };
            return { response: reviewResult.review, executionState };
          }
        }

      // =============================================
      // SECURITY SCAN
      // =============================================
      } else if (toolCall.name === "security_scan") {
        const scanPath = toolCall.arguments.path as string | undefined;
        const scanPR = toolCall.arguments.pr_number as number | undefined;
        const scanLabel = scanPR ? `PR #${scanPR}` : scanPath || "codebase";
        onEvent({ type: "thinking", message: `Scanning ${scanLabel} for security issues...` });

        const scanResult = await securityScan(context, executor, chatFn, onEvent, scanPath, scanPR);
        if (scanResult.error) {
          result = scanResult.error;
          error = true;
        } else {
          onEvent({ type: "message", content: scanResult.report });
          const executionState: PersistedExecutionState = {
            filesChanged, currentPlan, prCreated, prUrl, prNumber: prNumber as number, searchJournal,
          };
          return { response: scanResult.report, executionState };
        }

      } else {
        result = `Unknown tool: ${toolCall.name}`;
        error = true;
      }

      onEvent({ type: "tool_result", tool: toolCall.name, result, error });

      // Add tool result to messages
      if (
        messages[messages.length - 1]?.role !== "assistant" ||
        !messages[messages.length - 1]?.tool_calls
      ) {
        messages.push({
          role: "assistant",
          content: response.content || "",
          tool_calls: toolCalls,
        });
      }

      messages.push({
        role: "tool",
        content: result,
        tool_call_id: toolCall.id,
        name: toolCall.name,
      });
    }
  }

  // Max iterations
  onEvent({ type: "error", message: "Reached maximum iterations." });
  const executionState: PersistedExecutionState = {
    filesChanged, currentPlan, prCreated, prUrl, prNumber, searchJournal,
  };
  return {
    response: "I wasn't able to complete the task within the iteration limit.",
    executionState,
  };
}
