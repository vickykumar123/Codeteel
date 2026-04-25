// Search Agent - finds relevant code in the codebase
//
// Pure module: no Supabase, no Next.js imports.
// All DB/API access goes through ToolExecutor.
// Works in browser (WebToolExecutor) or server (ServerToolExecutor).

import type {
  Tool,
  ToolCall,
  ToolResult,
  AgentContext,
  AgentMessage,
  StreamEvent,
  ChatFn,
  LLMChatMessage,
  LLMToolDef,
  LLMToolCall,
} from "./types";
import type { ToolExecutor } from "./tools/interface";

import {
  MAX_SEARCH_RESULTS,
  MAX_LIST_FILES,
  READ_DEDUP_WARN_THRESHOLD,
  MAX_TOOL_RESULT_CHARS,
  READ_FILE_PREVIEW_LINES,
  MAX_GREP_MATCHES,
} from "./constants";

// ===========================================
// READ DEDUP TRACKER
// ===========================================

const readTracker = new Map<string, number>();

export function resetReadTracker(): void {
  readTracker.clear();
}

function trackRead(repoId: string, path: string): string | null {
  const key = `${repoId}:${path}`;
  const count = (readTracker.get(key) || 0) + 1;
  readTracker.set(key, count);

  if (count >= READ_DEDUP_WARN_THRESHOLD) {
    return `[DUPLICATE READ x${count}] You have read this file ${count} times. Consider using text_search instead.`;
  }
  return null;
}

// ===========================================
// SEARCH TOOLS (definitions for LLM)
// ===========================================

export const searchTools: Tool[] = [
  {
    name: "semantic_search",
    description:
      "Search the codebase using semantic similarity. Best for finding code related to a concept.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language description of what you're looking for",
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 10, max: 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "text_search",
    description:
      "Search for exact text matches in code. Best for function names, variables, imports.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Exact text to search for",
        },
        file_pattern: {
          type: "string",
          description: "Optional: filter by path pattern (e.g., 'src/components', '.tsx')",
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 10, max: 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "read_file",
    description:
      "Read a file. Without line range: returns the AI summary + first 50 lines as preview. With start_line/end_line: returns the exact code in that range. Use without line range first to understand the file, then drill into specific sections if needed.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to read",
        },
        start_line: {
          type: "number",
          description: "Start from this line (1-indexed). Omit for summary + preview mode.",
        },
        end_line: {
          type: "number",
          description: "Stop at this line (inclusive). Omit for summary + preview mode.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_files",
    description:
      "List indexed files in the repository by language or path pattern.",
    parameters: {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "Filter by language (e.g., 'TypeScript')",
        },
        pattern: {
          type: "string",
          description: "Filter by path pattern (e.g., 'src/components')",
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 50, max: 100)",
        },
      },
    },
  },
  {
    name: "grep",
    description:
      "Search for a pattern across all indexed files and return matching lines with line numbers and surrounding context. Like Unix grep. Best for finding exact code patterns, function calls, imports, error strings.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Pattern to search for (exact text or regex)",
        },
        is_regex: {
          type: "boolean",
          description: "Treat pattern as POSIX regex (default: false, uses case-insensitive substring match)",
        },
        file_pattern: {
          type: "string",
          description: "Filter by file path pattern (e.g., '.tsx', 'src/lib')",
        },
        context_lines: {
          type: "number",
          description: "Number of context lines before/after each match (default: 2, max: 5)",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "list_code_definitions",
    description:
      "List file summaries/structure without reading full code. See what functions/classes exist.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Path pattern to match (e.g., 'src/lib/')",
        },
        limit: {
          type: "number",
          description: "Maximum files (default: 20, max: 50)",
        },
      },
      required: ["pattern"],
    },
  },
];

// ===========================================
// TOOL EXECUTION (via ToolExecutor)
// ===========================================

export async function executeSearchTool(
  toolCall: ToolCall,
  repoId: string,
  executor: ToolExecutor
): Promise<ToolResult> {
  const { name, arguments: args, id } = toolCall;

  try {
    switch (name) {
      case "semantic_search":
        return await semanticSearch(
          id,
          args.query as string,
          Math.min((args.limit as number) || 10, MAX_SEARCH_RESULTS),
          repoId,
          executor
        );

      case "text_search":
        return await textSearch(
          id,
          args.query as string,
          args.file_pattern as string | undefined,
          Math.min((args.limit as number) || 10, MAX_SEARCH_RESULTS),
          repoId,
          executor
        );

      case "read_file":
        return await readFile(
          id,
          args.path as string,
          (args.start_line as number) || undefined,
          (args.end_line as number) || undefined,
          repoId,
          executor
        );

      case "list_files":
        return await listFiles(
          id,
          args.language as string | undefined,
          args.pattern as string | undefined,
          Math.min((args.limit as number) || 50, MAX_LIST_FILES),
          repoId,
          executor
        );

      case "grep":
        return await grepSearch(
          id,
          args.pattern as string,
          (args.is_regex as boolean) || false,
          args.file_pattern as string | undefined,
          Math.min((args.context_lines as number) || 2, 5),
          repoId,
          executor
        );

      case "list_code_definitions":
        return await listCodeDefinitions(
          id,
          args.pattern as string,
          Math.min((args.limit as number) || 20, 50),
          repoId,
          executor
        );

      // LLM sometimes hallucinates "search" or "find" instead of actual tool names
      case "search":
      case "find":
      case "find_file":
      case "search_code":
        return await textSearch(
          id,
          (args.query as string) || (args.pattern as string) || "",
          args.file_pattern as string | undefined,
          Math.min((args.limit as number) || 10, MAX_SEARCH_RESULTS),
          repoId,
          executor
        );

      default:
        return { tool_call_id: id, content: `Unknown tool: ${name}. Available tools: semantic_search, text_search, read_file, list_files, grep, list_code_definitions, create_plan.`, error: true };
    }
  } catch (error) {
    return {
      tool_call_id: id,
      content: `Error executing ${name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      error: true,
    };
  }
}

// ===========================================
// SEMANTIC SEARCH
// ===========================================

async function semanticSearch(
  toolCallId: string,
  query: string,
  limit: number,
  repoId: string,
  executor: ToolExecutor
): Promise<ToolResult> {
  const results = await executor.semanticSearch(repoId, { query, limit });

  if (results.length === 0) {
    return {
      tool_call_id: toolCallId,
      content: "No relevant files found. Try a different query or use text_search.",
    };
  }

  const formatted = results
    .map((r, i) => {
      const simPct = (r.similarity * 100).toFixed(1);
      const label = r.similarity >= 0.8 ? "HIGH" : r.similarity >= 0.6 ? "MEDIUM" : "LOW";
      return `${i + 1}. **${r.path}** (${r.language || "unknown"}) [${label} ${simPct}%]\n   ${r.summary || "No summary"}`;
    })
    .join("\n\n");

  return {
    tool_call_id: toolCallId,
    content: `Found ${results.length} relevant files:\n\n${formatted}\n\nUse read_file to examine specific files.`,
  };
}

// ===========================================
// TEXT SEARCH
// ===========================================

async function textSearch(
  toolCallId: string,
  query: string,
  filePattern: string | undefined,
  limit: number,
  repoId: string,
  executor: ToolExecutor
): Promise<ToolResult> {
  const results = await executor.textSearch(repoId, { query, filePattern, limit });

  if (results.length === 0) {
    return {
      tool_call_id: toolCallId,
      content: `No files found containing "${query}". Try semantic_search for concept-based search.`,
    };
  }

  const formatted = results
    .map((r, i) => {
      let snippet = "";
      if (r.code) {
        const lines = r.code.split("\n");
        const queryLower = query.toLowerCase();
        const matchingLines: number[] = [];
        for (let idx = 0; idx < lines.length; idx++) {
          if (lines[idx].toLowerCase().includes(queryLower)) {
            matchingLines.push(idx);
          }
        }

        const shown = matchingLines.slice(0, 3);
        const snippets = shown.map((lineIdx) => {
          const start = Math.max(0, lineIdx - 1);
          const end = Math.min(lines.length, lineIdx + 2);
          return lines
            .slice(start, end)
            .map(
              (line, offset) =>
                `${lineIdx === start + offset ? ">" : " "} ${start + offset + 1}: ${line}`
            )
            .join("\n");
        });

        snippet = snippets.join("\n  ...\n");
        if (matchingLines.length > 3) {
          snippet += `\n  ... and ${matchingLines.length - 3} more matches`;
        }
      }
      return `${i + 1}. **${r.path}** (${r.language || "unknown"})${snippet ? `\n\`\`\`\n${snippet}\n\`\`\`` : ""}`;
    })
    .join("\n\n");

  return {
    tool_call_id: toolCallId,
    content: `Found ${results.length} files containing "${query}":\n\n${formatted}`,
  };
}

// ===========================================
// GREP SEARCH
// ===========================================

async function grepSearch(
  toolCallId: string,
  pattern: string,
  isRegex: boolean,
  filePattern: string | undefined,
  contextLines: number,
  repoId: string,
  executor: ToolExecutor
): Promise<ToolResult> {
  const results = await executor.grepSearch(repoId, {
    pattern,
    isRegex,
    filePattern,
    contextLines,
    limit: MAX_GREP_MATCHES,
  });

  if (results.length === 0) {
    return {
      tool_call_id: toolCallId,
      content: `No matches found for "${pattern}"${filePattern ? ` in files matching "${filePattern}"` : ""}. Try a different pattern or use semantic_search for concept-based search.`,
    };
  }

  // Group results by file, then by match group
  const byFile = new Map<string, typeof results>();
  for (const r of results) {
    const existing = byFile.get(r.path) || [];
    existing.push(r);
    byFile.set(r.path, existing);
  }

  const totalMatches = results.filter((r) => r.isMatch).length;
  const fileCount = byFile.size;

  let formatted = "";
  for (const [filePath, lines] of byFile) {
    const lang = lines[0]?.language || "unknown";
    formatted += `\n### ${filePath} (${lang})\n\`\`\`\n`;

    let lastGroup = -1;
    for (const line of lines) {
      if (line.matchGroup !== lastGroup && lastGroup !== -1) {
        formatted += "  ...\n";
      }
      lastGroup = line.matchGroup;

      const marker = line.isMatch ? ">" : " ";
      formatted += `${marker} ${String(line.lineNumber).padStart(4)}: ${line.lineContent}\n`;
    }
    formatted += "```\n";
  }

  return {
    tool_call_id: toolCallId,
    content: `Found ${totalMatches} match${totalMatches !== 1 ? "es" : ""} in ${fileCount} file${fileCount !== 1 ? "s" : ""} for "${pattern}":\n${formatted}\nUse read_file to see more context around specific matches.`,
  };
}

// ===========================================
// READ FILE
// ===========================================

async function readFile(
  toolCallId: string,
  path: string,
  startLine: number | undefined,
  endLine: number | undefined,
  repoId: string,
  executor: ToolExecutor
): Promise<ToolResult> {
  const dedupWarning = trackRead(repoId, path);

  const file = await executor.readFile(repoId, {
    path,
    startLine,
    endLine,
  });

  if (!file) {
    return {
      tool_call_id: toolCallId,
      content: `File not found: ${path}`,
      error: true,
    };
  }

  const allLines = file.content.split("\n");
  const totalLines = allLines.length;
  const hasLineRange = startLine !== undefined || endLine !== undefined;

  let header = `## ${path}\n**Language:** ${file.language || "unknown"} | **Lines:** ${totalLines}`;
  if (file.summary) header += `\n**Summary:** ${file.summary}`;

  let content: string;

  if (!hasLineRange) {
    // No line range specified — return summary + preview only
    // The summary (from DB) already describes what the file does.
    // Show a small preview so the LLM can see structure and decide if it needs more.
    const previewEnd = Math.min(totalLines, READ_FILE_PREVIEW_LINES);
    const previewLines = allLines.slice(0, previewEnd);
    const numberedPreview = previewLines
      .map((line: string, idx: number) => `${idx + 1}\t${line}`)
      .join("\n");

    content = `${header}\n\n\`\`\`\n${numberedPreview}\n\`\`\``;
    if (previewEnd < totalLines) {
      content += `\n\n---\n*Showing first ${previewEnd} of ${totalLines} lines. Use read_file("${path}", start_line=${previewEnd + 1}) to see more.*`;
    }
  } else {
    // Specific line range requested — return the requested range
    const start = startLine || 1;
    const end = endLine || Math.min(totalLines, start + 499);
    const rangeLines = allLines.slice(0, end - start + 1);
    const numberedCode = rangeLines
      .map((line: string, idx: number) => `${start + idx}\t${line}`)
      .join("\n");

    content = `${header}\n\n\`\`\`\n${numberedCode}\n\`\`\``;
    if (end < totalLines) {
      content += `\n\n---\n*Showing lines ${start}-${end} of ${totalLines}. Use read_file("${path}", start_line=${end + 1}) to continue.*`;
    }
  }

  if (dedupWarning) content = `${dedupWarning}\n\n${content}`;

  return { tool_call_id: toolCallId, content };
}

// ===========================================
// LIST FILES
// ===========================================

async function listFiles(
  toolCallId: string,
  language: string | undefined,
  pattern: string | undefined,
  limit: number,
  repoId: string,
  executor: ToolExecutor
): Promise<ToolResult> {
  const files = await executor.listFiles(repoId, { language, pattern, limit });

  if (files.length === 0) {
    return {
      tool_call_id: toolCallId,
      content: `No files found${language ? ` for "${language}"` : ""}${pattern ? ` matching "${pattern}"` : ""}.`,
    };
  }

  const formatted = files
    .map((f) => `- ${f.path} (${f.language || "unknown"}, ${f.size || 0} bytes)`)
    .join("\n");

  return {
    tool_call_id: toolCallId,
    content: `Found ${files.length} files:\n\n${formatted}${files.length >= limit ? `\n\n*Limited to ${limit}. Add a pattern to narrow down.*` : ""}`,
  };
}

// ===========================================
// LIST CODE DEFINITIONS
// ===========================================

async function listCodeDefinitions(
  toolCallId: string,
  pattern: string,
  limit: number,
  repoId: string,
  executor: ToolExecutor
): Promise<ToolResult> {
  const defs = await executor.listCodeDefinitions(repoId, { pattern, limit });

  if (defs.length === 0) {
    return {
      tool_call_id: toolCallId,
      content: `No files found matching "${pattern}".`,
    };
  }

  const formatted = defs
    .map((f, i) => `${i + 1}. **${f.path}** (${f.language || "unknown"})\n   ${f.summary}`)
    .join("\n\n");

  return {
    tool_call_id: toolCallId,
    content: `Code definitions for "${pattern}" (${defs.length} files):\n\n${formatted}\n\nUse read_file to examine specific files.`,
  };
}

// ===========================================
// SEARCH AGENT SYSTEM PROMPT
// ===========================================

const searchAgentSystemPrompt = `You are a code search agent. Your job is to explore the codebase and answer the user's question thoroughly.

## Your Workflow:
1. SEARCH: Use grep, semantic_search, or text_search to find relevant files
2. READ: Use read_file to examine actual code (not just summaries)
3. EXPLORE: Use list_files and list_code_definitions to understand structure
4. ANSWER: When you have enough context, respond with a clear, detailed answer

## Available Tools:
- grep: Search for exact patterns across all files — returns matching lines with line numbers and context (like Unix grep). Best first choice for specific code patterns.
- semantic_search: Find code by concept/meaning (best for "how does X work?")
- text_search: Find files containing text (returns file-level results, not line-level)
- read_file: Read file content (use start_line/end_line for large files)
- list_files: Browse directory structure by language or path pattern
- list_code_definitions: See file summaries without reading full code

## Strategy:
- Use grep FIRST for specific code patterns (function names, imports, error strings) — it shows exact line numbers
- Use semantic_search for broad conceptual questions ("how does auth work?")
- Use text_search only when you need file-level results (which files contain X?)
- Always read the actual code before answering — don't guess from summaries alone
- If a file is large, use start_line/end_line to read the relevant section
- Cross-reference: if you find one file, check its imports to understand dependencies
- If initial search returns nothing, try different query terms or patterns

## Answer Rules:
- Be specific: mention file paths, function names, line numbers
- Show relevant code snippets when they help explain
- If you can't find the answer, say what you searched and suggest where to look
- Keep answers focused — don't dump entire files unless asked

## Important:
- You have up to 8 iterations — use them wisely
- Don't search for the same thing twice with the same query
- If first search is too broad, refine; if too narrow, broaden`;

// ===========================================
// TOOL CONVERSION (for Search Agent)
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
// RUN SEARCH AGENT (ReAct loop)
// ===========================================

const MAX_SEARCH_ITERATIONS = 8;
const SEARCH_SAME_ACTION_LIMIT = 3;

export async function runSearch(
  userRequest: string,
  context: AgentContext,
  executor: ToolExecutor,
  chatFn: ChatFn,
  onEvent: (event: StreamEvent) => void
): Promise<{ answer: string; error?: string }> {
  const messages: AgentMessage[] = [
    { role: "system", content: searchAgentSystemPrompt },
    {
      role: "user",
      content: `User question: ${userRequest}\n\nRepository: ${context.repoFullName}\nSearch the codebase and provide a thorough answer.`,
    },
  ];

  let iterations = 0;
  const actionHistory: string[] = [];

  onEvent({ type: "thinking", message: "Searching codebase..." });

  while (iterations < MAX_SEARCH_ITERATIONS) {
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

    const response = await chatFn(llmMessages, toolsToLLMFormat(searchTools));

    // No tool calls → final answer
    if (!response.tool_calls || response.tool_calls.length === 0) {
      return { answer: response.content };
    }

    const toolCalls = convertToolCalls(response.tool_calls);

    for (const toolCall of toolCalls) {
      // Loop detection
      const actionKey = `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`;
      if (
        actionHistory.filter((a) => a === actionKey).length >= SEARCH_SAME_ACTION_LIMIT
      ) {
        messages.push({
          role: "assistant",
          content: response.content || "",
          tool_calls: toolCalls,
        });
        messages.push({
          role: "tool",
          content:
            "You've searched the same thing 3 times. Answer the question NOW with what you know.",
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
        continue;
      }
      actionHistory.push(actionKey);

      // Execute search tool
      if (searchTools.some((t) => t.name === toolCall.name)) {
        onEvent({
          type: "tool_call",
          tool: toolCall.name,
          args: toolCall.arguments,
        });

        const toolResult = await executeSearchTool(
          toolCall,
          context.repoId,
          executor
        );

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

        // Truncate tool result if it exceeds the limit
        let resultContent = toolResult.content;
        if (resultContent.length > MAX_TOOL_RESULT_CHARS) {
          resultContent = resultContent.slice(0, MAX_TOOL_RESULT_CHARS) +
            `\n\n... (truncated — ${resultContent.length - MAX_TOOL_RESULT_CHARS} chars omitted. Use read_file with specific line ranges for more detail.)`;
        }

        // ReAct reflection nudge — encourage answering instead of endless searching
        const reflectionNudge = "\n\n[REFLECT: Do you have enough information to answer the user's question? " +
          "If yes, respond with your answer now. If not, refine your search — but do not repeat the same query.]";

        messages.push({
          role: "tool",
          content: resultContent + reflectionNudge,
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
          content: `Unknown tool: ${toolCall.name}. Use search tools only.`,
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
      }
    }
  }

  // Max iterations — force a final LLM call without tools to get an answer
  messages.push({
    role: "user",
    content: "You've reached the search limit. Answer the question NOW with what you've found so far.",
  });

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

  // Call without tools to force a text answer
  const finalResponse = await chatFn(llmMessages);
  return { answer: finalResponse.content };
}
