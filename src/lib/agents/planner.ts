// Planner Agent - explores codebase and creates implementation plans
//
// Pure module: no Supabase, no Next.js, no @/lib/llm imports.
// All DB/API access goes through ToolExecutor.
// LLM calls go through injected ChatFn.
// Works in browser (WebToolExecutor) or server (ServerToolExecutor).

import { searchTools, executeSearchTool, type SearchToolOpts } from "./search";
import type { ToolExecutor } from "./tools/interface";
import type {
  AgentContext,
  AgentMessage,
  Tool,
  ToolCall,
  ToolResult,
  Plan,
  PlanStep,
  StreamEvent,
  ChatFn,
  LLMChatMessage,
  LLMToolDef,
  LLMToolCall,
} from "./types";

import { MAX_PLANNER_ITERATIONS, SAME_ACTION_LIMIT } from "./constants";

// ===========================================
// PLANNER-ONLY TOOL: create_plan
// ===========================================

const thinkTool: Tool = {
  name: "think",
  description:
    "Use this to reason about your progress before deciding your next action. Call this when: (1) searches return no results and you're unsure why, (2) you're handling a complex multi-part request, (3) you've done several searches and need to assess what you know vs what's missing. Do NOT call this every step — only when you need to pause and reason.",
  parameters: {
    type: "object",
    properties: {
      thought: {
        type: "string",
        description: "Your reasoning about current progress, what you've learned, and what to do next",
      },
    },
    required: ["thought"],
  },
};

const createPlanTool: Tool = {
  name: "create_plan",
  description:
    "Create an implementation plan after you have explored the codebase. Call this ONLY after you have read the relevant files and understand the code. The plan should contain text descriptions only — code will be generated at execution time.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Short title (e.g., 'Add logout button to navbar')",
      },
      summary: {
        type: "string",
        description: "1-2 sentence summary of what will be done",
      },
      steps: {
        type: "array",
        description:
          "Implementation steps. Each step = one file change. Describe WHAT to change, not HOW (code generated later).",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["create", "modify", "delete"],
              description: "Type of change",
            },
            path: {
              type: "string",
              description: "REQUIRED. Full file path (e.g., 'src/components/Navbar.tsx'). Every step MUST have a path — this is the file to create/modify/delete.",
            },
            description: {
              type: "string",
              description:
                "ONE atomic change only. Be specific: mention function names, where to insert, what to add/remove. This text is used by the executor LLM to generate code. Do NOT combine multiple edits into one step.",
            },
          },
          required: ["type", "path", "description"],
        },
      },
    },
    required: ["title", "summary", "steps"],
  },
};

// ===========================================
// PLANNER SYSTEM PROMPT
// ===========================================

const plannerSystemPrompt = `You are a code planner agent. Explore the codebase and create a detailed implementation plan.

## Workflow
1. Check if the user gave exact file paths — if yes, read them directly (skip searching)
2. Otherwise, search for relevant files (grep first, then semantic_search if needed)
3. Read files to understand the code (read_file)
4. Call create_plan when you have enough context

## Tools
- grep: Exact pattern search with line numbers (best first choice)
- semantic_search: Conceptual search ("how does auth work?")
- text_search: File-level text search
- read_file: Read file content (use start_line/end_line for large files)
- list_files: Browse directory structure
- list_code_definitions: File summaries without full content
- think: Reason about progress (only when stuck or handling complex requests)
- create_plan: Submit the plan (call last)

## Search Budget
You have a MAXIMUM of 10 iterations. Use them wisely:
- If user gives file paths → read directly, plan in 2-3 iterations
- If searching → find files in 3-4 searches, read them, then call create_plan
- If you can't find files after 4-5 searches → stop and ask the user for exact file paths

Do NOT keep searching hoping to find something. Search efficiently, then create_plan or ask the user.

## Plan Rules
- Each step = ONE atomic change to ONE file
- Every step needs: type ("create" | "modify" | "delete"), path, and description
- Descriptions are SHORT (1-2 sentences max). No code, no implementation details.
- The executor generates code — you just say WHAT, not HOW
- Order steps logically (dependencies first)
- Split multi-edit requests into separate steps, even for the same file

**Good descriptions** (short, clear):
- "Add a /health GET route returning {status: ok}"
- "Add request logging with correlation ID to the webhook handler"
- "Create a utility module for date formatting helpers"

**Bad descriptions** (too long, too detailed):
- "Add imports: uuid, datetime, time, traceback. Then add 4 helper functions: _generate_request_id() which returns str using uuid4, _sanitize_headers() which..."
- "Modify the file to add a new function called handleAuth that takes a request parameter of type Request and returns..."

## Efficiency
- If the user provides exact file paths (e.g. "modify src/main.py"), call read_file DIRECTLY — do NOT search first
- Read each file at most once
- For delete/create operations, call create_plan immediately — no searching needed
- Call create_plan as soon as you have enough context. Don't over-search.
- If previous searches are listed below, use those results — don't search for the same files again

## CRITICAL: Always use the create_plan tool
You MUST submit your plan by calling the create_plan tool. Do NOT write the plan as text in your response.
Wrong: Responding with "- **Title:** Add error handling..."
Right: Calling create_plan({"title": "Add error handling", "steps": [...]})

## When you can't find files
If your searches return nothing relevant, DO NOT guess. Instead, respond with text explaining:
- What you searched for
- What files you found (if any)
- Ask the user to specify the exact file path(s) they want modified`;

// ===========================================
// TOOL CONVERSION
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
// TOOL CALL RECOVERY (for OSS models via Ollama)
// ===========================================

function recoverPlannerToolCall(content: string): LLMToolCall | null {
  const trimmed = content.trim();

  try {
    const parsed = JSON.parse(trimmed);
    // Pattern: LLM outputs create_plan JSON as text
    if (parsed.title && parsed.steps && Array.isArray(parsed.steps)) {
      return {
        id: `recovered-${Date.now()}`,
        type: "function" as const,
        function: {
          name: "create_plan",
          arguments: JSON.stringify(parsed),
        },
      };
    }
    // Pattern: LLM outputs a search tool call as JSON
    if (parsed.query && typeof parsed.query === "string") {
      return {
        id: `recovered-${Date.now()}`,
        type: "function" as const,
        function: {
          name: "text_search",
          arguments: JSON.stringify(parsed),
        },
      };
    }
    if (parsed.path && typeof parsed.path === "string") {
      return {
        id: `recovered-${Date.now()}`,
        type: "function" as const,
        function: {
          name: "read_file",
          arguments: JSON.stringify(parsed),
        },
      };
    }
  } catch {
    // Not valid JSON — try extracting embedded JSON
  }

  // Pattern: JSON block embedded in text
  const jsonMatch = trimmed.match(/\{[\s\S]*"(?:title|steps)"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.title && parsed.steps && Array.isArray(parsed.steps)) {
        return {
          id: `recovered-${Date.now()}`,
          type: "function" as const,
          function: {
            name: "create_plan",
            arguments: JSON.stringify(parsed),
          },
        };
      }
    } catch {
      // Couldn't parse
    }
  }

  return null;
}

// ===========================================
// RUN PLANNER (mini-agent with ReAct loop)
// ===========================================

export async function runPlanner(
  userRequest: string,
  context: AgentContext,
  executor: ToolExecutor,
  chatFn: ChatFn,
  onEvent: (event: StreamEvent) => void,
  opts?: { filesChanged?: string[]; searchJournal?: import("./types").SearchJournalEntry[] },
): Promise<{ plan: Plan | null; error?: string; filesFound?: string[] }> {
  const allTools = [...searchTools, thinkTool, createPlanTool];
  const searchOpts: SearchToolOpts = {
    filesChanged: opts?.filesChanged,
    workingBranch: context.workingBranch,
  };
  const filesFound: string[] = []; // Track files found for journal

  let systemPrompt = plannerSystemPrompt;

  // Inject search journal — files already found in previous messages
  if (opts?.searchJournal && opts.searchJournal.length > 0) {
    const journalText = opts.searchJournal.map(j =>
      `- "${j.query}" → ${j.filesFound.join(", ")} (${j.summary})`
    ).join("\n");
    systemPrompt += `\n\n## PREVIOUS SEARCHES (already found — don't search again):
${journalText}
Use these file paths directly with read_file if you need to examine them.`;
  }

  // Inject files changed in this conversation
  if (opts?.filesChanged && opts.filesChanged.length > 0) {
    systemPrompt += `\n\n## FILES ALREADY CHANGED IN THIS CONVERSATION:
${opts.filesChanged.map(f => `- ${f}`).join("\n")}
These files have been modified on the working branch. When reading them, you'll get the latest version.`;
  }

  if (context.customInstructions) {
    systemPrompt += `\n\n## CUSTOM INSTRUCTIONS (follow these when creating the plan):\n${context.customInstructions}`;
  }

  const messages: AgentMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `User request: ${userRequest}\n\nRepository: ${context.repoFullName}\nExplore the codebase and create an implementation plan.`,
    },
  ];

  let iterations = 0;
  const actionHistory: string[] = [];
  let consecutiveErrors = 0;

  onEvent({ type: "thinking", message: "Exploring codebase for planning..." });

  while (iterations < MAX_PLANNER_ITERATIONS) {
    iterations++;

    // Convert to LLM format
    const llmMessages: LLMChatMessage[] = messages.map((m) => {
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

    // Forced reflection: at iteration 5, force the planner to assess and plan
    if (iterations === 5) {
      const thinkCallId = `forced-think-${Date.now()}`;
      messages.push({
        role: "assistant",
        content: "",
        tool_calls: [{
          id: thinkCallId,
          name: "think",
          arguments: {
            thought: "I have used half my iterations. Let me assess what I know and what I still need before calling create_plan."
          },
        }],
      });
      messages.push({
        role: "tool",
        content: "You are halfway through your iterations. STOP searching and reflect:\n" +
          "- What file paths did the user give you? Use those EXACT paths in your plan.\n" +
          "- If files aren't found in search, they may exist but not be indexed. That's OK — proceed anyway.\n" +
          "- You MUST call create_plan on your next action with the information you have.",
        tool_call_id: thinkCallId,
        name: "think",
      });
    }

    const response = await chatFn(llmMessages, toolsToLLMFormat(allTools));

    // Fallback: OSS models (Ollama) sometimes return tool calls as JSON text.
    // Try to recover a create_plan or search tool call from the content.
    if ((!response.tool_calls || response.tool_calls.length === 0) && response.content) {
      const recovered = recoverPlannerToolCall(response.content);
      if (recovered) {
        response.tool_calls = [recovered];
      }
    }

    // No tool calls → planner responded with text (shouldn't happen, but handle it)
    if (!response.tool_calls || response.tool_calls.length === 0) {
      return {
        plan: null,
        error:
          "Planner finished without creating a plan. Response: " +
          response.content?.slice(0, 200),
      };
    }

    const toolCalls = convertToolCalls(response.tool_calls);

    for (const toolCall of toolCalls) {
      // Loop detection
      const actionKey = `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`;
      if (
        actionHistory.filter((a) => a === actionKey).length >= SAME_ACTION_LIMIT
      ) {
        // Inject a nudge to create the plan
        messages.push({
          role: "assistant",
          content: response.content || "",
          tool_calls: toolCalls,
        });
        messages.push({
          role: "tool",
          content:
            "You've searched the same thing 3 times. You have enough context. Call create_plan NOW with what you know.",
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
        continue;
      }
      actionHistory.push(actionKey);

      // Handle create_plan → extract plan and return
      if (toolCall.name === "create_plan") {
        onEvent({
          type: "tool_call",
          tool: "create_plan",
          args: toolCall.arguments,
        });

        const plan = parsePlanFromToolCall(toolCall);
        if (plan) {
          onEvent({
            type: "tool_result",
            tool: "create_plan",
            result: `Plan created: ${plan.title} (${plan.steps.length} steps)`,
          });

          return { plan, filesFound };
        } else {
          // Invalid plan — ask planner to retry
          messages.push({
            role: "assistant",
            content: response.content || "",
            tool_calls: toolCalls,
          });
          messages.push({
            role: "tool",
            content:
              "Invalid plan format. Each step MUST have type, path, and description. Try again.",
            tool_call_id: toolCall.id,
            name: toolCall.name,
          });
          continue;
        }
      }

      // Handle think tool (reasoning scratchpad)
      if (toolCall.name === "think") {
        const thought = toolCall.arguments.thought as string;
        onEvent({ type: "thinking", message: "Reasoning about approach..." });

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
          content: `Thought noted: ${thought}\n\nNow take your next action based on this reasoning.`,
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
        continue;
      }

      // Handle search tools (read-only) via ToolExecutor
      if (searchTools.some((t) => t.name === toolCall.name)) {
        onEvent({
          type: "tool_call",
          tool: toolCall.name,
          args: toolCall.arguments,
        });

        let toolResult = await executeSearchTool(
          toolCall,
          context.repoId,
          executor,
          searchOpts
        );

        // Fallback: if read_file returns "File not found" from Supabase index,
        // try reading directly from GitHub (file may exist but not be indexed)
        if (
          toolCall.name === "read_file" &&
          toolResult.error &&
          toolResult.content.includes("File not found")
        ) {
          const filePath = toolCall.arguments.path as string;
          const branch = context.workingBranch || context.defaultBranch;
          try {
            const githubFile = await executor.readFileFromGitHub(context.repoId, filePath, branch);
            if (githubFile) {
              const lines = githubFile.content.split("\n");
              const numbered = lines.map((line: string, idx: number) => `${idx + 1}\t${line}`).join("\n");
              toolResult = {
                tool_call_id: toolCall.id,
                content: `## ${filePath}\n**Language:** ${githubFile.language || "unknown"} | **Lines:** ${lines.length}\n*Note: Read from GitHub (not indexed in search)*\n\n\`\`\`\n${numbered}\n\`\`\``,
              };
            }
          } catch {
          }
        }

        // If search/list returned no results, hint to use read_file with exact paths
        if (
          toolCall.name !== "read_file" &&
          !toolResult.error &&
          (toolResult.content.includes("No matches found") ||
           toolResult.content.includes("No files found") ||
           toolResult.content.includes("Found 0"))
        ) {
          toolResult.content += "\n\nHINT: If the user gave you exact file paths, try read_file with those paths directly instead of searching. Files may exist on the branch but not be in the search index.";
        }

        // Track files found for journal
        if (toolCall.name === "read_file" && !toolResult.error) {
          const fp = toolCall.arguments.path as string;
          if (fp && !filesFound.includes(fp)) filesFound.push(fp);
        }

        onEvent({
          type: "tool_result",
          tool: toolCall.name,
          result: toolResult.content.slice(0, 500) + (toolResult.content.length > 500 ? "..." : ""),
          error: toolResult.error,
        });

        // Add to message history
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

        // Track consecutive errors
        if (toolResult.error) {
          consecutiveErrors++;
        } else {
          consecutiveErrors = 0;
        }

        // Append ONE nudge per tool result (never both — avoids conflicting signals)
        let resultContent = toolResult.content;

        if (toolResult.error && consecutiveErrors >= 2) {
          resultContent += "\n\n⚠️ 2 consecutive errors. Use think to assess what's wrong, or call create_plan with what you have.";
        } else if (!toolResult.error && iterations > 3) {
          // Only add reflect nudge after a few iterations (not on every result)
          resultContent += "\n\n[REFLECT: Do you have enough context to call create_plan? If yes, call it now.]";
        }

        messages.push({
          role: "tool",
          content: resultContent,
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
      } else {
        // Unknown tool
        messages.push({
          role: "assistant",
          content: response.content || "",
          tool_calls: toolCalls,
        });
        messages.push({
          role: "tool",
          content: `Unknown tool: ${toolCall.name}. Use search tools or create_plan.`,
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
      }
    }
  }

  // Max iterations
  return {
    plan: null,
    error: `Planner reached ${MAX_PLANNER_ITERATIONS} iterations without creating a plan.`,
  };
}

// ===========================================
// PARSE PLAN FROM TOOL CALL
// ===========================================

export function parsePlanFromToolCall(toolCall: ToolCall): Plan | null {
  if (toolCall.name !== "create_plan") {
    return null;
  }

  const args = toolCall.arguments;

  if (!Array.isArray(args.steps)) {
    return null;
  }

  const steps: PlanStep[] = (args.steps as unknown[]).map(
    (step: unknown, index: number) => {
      const s = step as Record<string, unknown>;

      // Normalize step type: LLM sometimes uses "add"/"add_file"/"new" instead of "create"
      const rawType = ((s.type as string) || "modify").toLowerCase();
      let normalizedType: "create" | "modify" | "delete";
      if (["create", "add", "add_file", "new", "create_file"].includes(rawType)) {
        normalizedType = "create";
      } else if (["delete", "remove", "delete_file"].includes(rawType)) {
        normalizedType = "delete";
      } else {
        normalizedType = "modify";
      }

      let path = (s.path as string) || "";
      const description = (s.description as string) || "";

      // Fallback: if path is missing, try to extract from description
      // Matches any path-like string with a file extension (e.g., src/utils/logger.py, cmd/server/main.go, etc.)
      if (!path && description) {
        const pathMatch = description.match(/(?:^|\s|['"`])((?:[\w.\-]+\/)*[\w.\-]+\.\w{1,10})(?:\s|['"`]|,|$)/);
        if (pathMatch) {
          path = pathMatch[1];
        }
      }

      return {
        id: (s.id as string) || `step-${index + 1}`,
        type: normalizedType,
        path,
        description,
      };
    }
  );

  // Validate: reject plans with empty steps
  const validSteps = steps.filter((s) => s.path && s.description);
  if (validSteps.length === 0 && steps.length > 0) {
    return null;
  }

  const finalSteps = validSteps.length > 0 ? validSteps : steps;
  const filesAffected = Array.from(
    new Set(finalSteps.map((s) => s.path).filter(Boolean))
  );

  const plan: Plan = {
    id: `plan-${Date.now()}`,
    title: (args.title as string) || "Implementation Plan",
    summary: (args.summary as string) || "",
    steps: finalSteps,
    filesAffected,
    estimatedChanges: finalSteps.length,
    createdAt: new Date().toISOString(),
  };

  return plan;
}

// ===========================================
// LEGACY EXPORTS (for backward compat)
// ===========================================

// The orchestrator used to import these — keep them for now
export const plannerTools: Tool[] = [createPlanTool];

export function executePlannerTool(toolCall: ToolCall): ToolResult {
  const plan = parsePlanFromToolCall(toolCall);

  if (!plan) {
    return {
      tool_call_id: toolCall.id,
      content: "Invalid plan format. Each step MUST have type, path, and description.",
      error: true,
    };
  }

  if (plan.steps.length === 0) {
    return {
      tool_call_id: toolCall.id,
      content: "Plan has no valid steps.",
      error: true,
    };
  }

  const stepsFormatted = plan.steps
    .map(
      (step, i) =>
        `${i + 1}. **${step.type.toUpperCase()}** \`${step.path}\`\n   ${step.description}`
    )
    .join("\n\n");

  return {
    tool_call_id: toolCall.id,
    content: `## ${plan.title}\n\n${plan.summary}\n\n### Steps:\n\n${stepsFormatted}\n\n**Files affected:** ${plan.filesAffected.join(", ")}`,
  };
}

export function generatePlanPrompt(
  request: string,
  filesContext: string
): string {
  return `User Request: ${request}\n\nRelevant Files and Code:\n${filesContext}\n\nCreate a detailed implementation plan using the create_plan tool.`;
}
