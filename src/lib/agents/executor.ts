// Executor Agent - executes code changes via GitHub API
//
// Pure module: no Supabase, no Next.js, no @/lib/llm imports.
// All DB/API access goes through ToolExecutor.
// LLM calls go through injected ChatFn.
// Works in browser (WebToolExecutor) or server (ServerToolExecutor).

import type {
  AgentContext,
  Tool,
  ToolCall,
  ToolResult,
  Plan,
  ExecutionResult,
  BranchInfo,
  StreamEvent,
  ChatFn,
  LLMChatMessage,
} from "./types";
import type { ToolExecutor } from "./tools/interface";
import { applyEdit, validateEdit } from "./edit-utils";

import { MAX_EDIT_RETRIES, PROTECTED_BRANCHES, SMALL_FILE_THRESHOLD } from "./constants";

// ===========================================
// EXECUTOR TOOLS
// ===========================================

export const executorTools: Tool[] = [
  {
    name: "request_branch_selection",
    description:
      "Request user to select or create a working branch before making edits. Call this if no working branch is set. Main/master branches are protected and cannot be selected.",
    parameters: {
      type: "object",
      properties: {
        suggested_name: {
          type: "string",
          description:
            "Suggested branch name based on the task (e.g., 'feature/add-logout-button')",
        },
      },
      required: ["suggested_name"],
    },
  },
  {
    name: "create_branch",
    description:
      "Create a new git branch for the changes. Only use this if user explicitly chose to create a new branch via branch selection.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Branch name (e.g., 'feature/add-logout-button')",
        },
        base_branch: {
          type: "string",
          description: "Base branch to create from (defaults to main)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "read_current_file",
    description: "Read the current content of a file from GitHub",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to read",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "edit_file",
    description:
      "Edit a file by replacing specific text. More efficient than write_file for targeted changes. The old_string must be UNIQUE in the file.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to edit",
        },
        old_string: {
          type: "string",
          description: "Exact text to find (must be unique in the file)",
        },
        new_string: {
          type: "string",
          description: "Replacement text",
        },
        message: {
          type: "string",
          description: "Commit message for this change",
        },
      },
      required: ["path", "old_string", "new_string", "message"],
    },
  },
  {
    name: "write_file",
    description: "Write or update a file in the repository",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to write",
        },
        content: {
          type: "string",
          description: "Full file content to write",
        },
        message: {
          type: "string",
          description: "Commit message for this change",
        },
      },
      required: ["path", "content", "message"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file from the repository",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to delete",
        },
        message: {
          type: "string",
          description: "Commit message for this deletion",
        },
      },
      required: ["path", "message"],
    },
  },
  {
    name: "create_pull_request",
    description: "Create a pull request for the changes",
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
];

// ===========================================
// EXECUTOR SYSTEM PROMPT
// ===========================================

export const executorSystemPrompt = `You are a code executor agent. You implement approved plans by making changes to a GitHub repository.

## Workflow
For each step in the plan:
1. **Modify**: read_current_file → write_file (with commit message)
2. **Create**: write_file (no read needed)
3. **Delete**: delete_file
After all steps → create_pull_request

## Rules
- Use the existing working branch — do NOT create a new branch
- Read each file once before modifying — always work with the latest content
- If a write fails, re-read the file and retry (up to 3 attempts)
- For small files (under 20 lines), prefer writing the complete file over partial edits
- Preserve existing formatting, indentation style, and imports
- Write clear, descriptive commit messages
- Do NOT repeat the same tool call with identical arguments
- Complete the execution by calling create_pull_request as the final step`;

// Execution state stored during execution
interface ExecutionState {
  branchName: string | null;
  branchSha: string | null;
  filesChanged: string[];
  prUrl: string | null;
  prNumber: number | null;
  prAttempted: boolean;
  prError: string | null;
  branchSelectionPending: boolean;
  sendEvent?: (event: StreamEvent) => void;
}

// ===========================================
// EXECUTE EXECUTOR TOOL
// ===========================================

export async function executeExecutorTool(
  toolCall: ToolCall,
  context: AgentContext,
  state: ExecutionState
): Promise<ToolResult> {
  const { name, arguments: args, id } = toolCall;
  const [owner, repo] = context.repoFullName.split("/");

  try {
    switch (name) {
      case "request_branch_selection":
        return await requestBranchSelection(
          id,
          args.suggested_name as string,
          owner,
          repo,
          context,
          state
        );

      case "create_branch":
        return await createBranch(
          id,
          args.name as string,
          args.base_branch as string | undefined,
          owner,
          repo,
          context,
          state
        );

      case "read_current_file":
        return await readCurrentFile(
          id,
          args.path as string,
          owner,
          repo,
          context,
          state
        );

      case "edit_file":
        return await editFile(
          id,
          args.path as string,
          args.old_string as string,
          args.new_string as string,
          args.message as string,
          owner,
          repo,
          context,
          state
        );

      case "write_file":
        return await writeFile(
          id,
          args.path as string,
          args.content as string,
          args.message as string,
          owner,
          repo,
          context,
          state
        );

      case "delete_file":
        return await deleteFile(
          id,
          args.path as string,
          args.message as string,
          owner,
          repo,
          context,
          state
        );

      case "create_pull_request":
        return await createPullRequest(
          id,
          args.title as string,
          args.body as string,
          owner,
          repo,
          context,
          state
        );

      default:
        return {
          tool_call_id: id,
          content: `Unknown tool: ${name}`,
          error: true,
        };
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
// REQUEST BRANCH SELECTION
// ===========================================

async function requestBranchSelection(
  toolCallId: string,
  suggestedName: string,
  owner: string,
  repo: string,
  context: AgentContext,
  state: ExecutionState
): Promise<ToolResult> {
  // If working branch is already set in context, use it (cannot change mid-conversation)
  if (context.workingBranch) {
    state.branchName = context.workingBranch;
    state.branchSelectionPending = false;
    return {
      tool_call_id: toolCallId,
      content: `Working branch is locked to \`${context.workingBranch}\` for this conversation. Proceeding with edits.`,
    };
  }

  // If already set in state (shouldn't happen, but safety check)
  if (state.branchName) {
    return {
      tool_call_id: toolCallId,
      content: `Working branch already set: \`${state.branchName}\`. Proceeding with edits.`,
    };
  }

  // Fetch available branches from GitHub
  const branchesResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${context.githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!branchesResponse.ok) {
    return {
      tool_call_id: toolCallId,
      content: "Failed to fetch branches from GitHub",
      error: true,
    };
  }

  const githubBranches = await branchesResponse.json();
  const branches: BranchInfo[] = githubBranches.map(
    (b: { name: string; commit: { sha: string }; protected: boolean }) => ({
      name: b.name,
      sha: b.commit.sha,
      protected: PROTECTED_BRANCHES.includes(b.name) || b.protected,
    })
  );

  // Send branch selection event to UI
  if (state.sendEvent) {
    state.sendEvent({
      type: "branch_selection_required",
      request: {
        availableBranches: branches,
        suggestedName,
        defaultBase: context.defaultBranch,
        protectedBranches: PROTECTED_BRANCHES,
      },
    });
  }

  // Mark that we're waiting for branch selection
  state.branchSelectionPending = true;

  return {
    tool_call_id: toolCallId,
    content: `Waiting for user to select a branch. Suggested: \`${suggestedName}\`. Available non-protected branches: ${branches
      .filter((b) => !b.protected)
      .map((b) => b.name)
      .join(", ") || "none (create new branch)"}`,
  };
}

// ===========================================
// CREATE BRANCH
// ===========================================

async function createBranch(
  toolCallId: string,
  branchName: string,
  baseBranch: string | undefined,
  owner: string,
  repo: string,
  context: AgentContext,
  state: ExecutionState
): Promise<ToolResult> {
  const base = baseBranch || context.defaultBranch;

  // Get the SHA of the base branch
  const refResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${base}`,
    {
      headers: {
        Authorization: `Bearer ${context.githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!refResponse.ok) {
    const error = await refResponse.text();
    return {
      tool_call_id: toolCallId,
      content: `Failed to get default branch: ${error}`,
      error: true,
    };
  }

  const refData = await refResponse.json();
  const sha = refData.object.sha;

  // Create the new branch
  const createResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.text();
    return {
      tool_call_id: toolCallId,
      content: `Failed to create branch: ${error}`,
      error: true,
    };
  }

  state.branchName = branchName;
  state.branchSha = sha;
  state.branchSelectionPending = false;

  // Send branch selected event
  if (state.sendEvent) {
    state.sendEvent({ type: "branch_selected", branchName });
  }

  return {
    tool_call_id: toolCallId,
    content: `Created branch \`${branchName}\` from \`${base}\``,
  };
}

// ===========================================
// READ CURRENT FILE
// ===========================================

async function readCurrentFile(
  toolCallId: string,
  path: string,
  owner: string,
  repo: string,
  context: AgentContext,
  state: ExecutionState
): Promise<ToolResult> {
  const branch = state.branchName || context.defaultBranch;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${context.githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return {
        tool_call_id: toolCallId,
        content: `File not found: ${path} (will be created as new file)`,
      };
    }
    const error = await response.text();
    return {
      tool_call_id: toolCallId,
      content: `Failed to read file: ${error}`,
      error: true,
    };
  }

  const data = await response.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");

  return {
    tool_call_id: toolCallId,
    content: `Current content of \`${path}\`:\n\n\`\`\`\n${content}\n\`\`\`\n\nSHA: ${data.sha}\n\n**Next step:** Apply your changes and use write_file to save the updated content.`,
  };
}

// ===========================================
// EDIT FILE (Deterministic String Replacement)
// ===========================================

async function editFile(
  toolCallId: string,
  path: string,
  oldString: string,
  newString: string,
  message: string,
  owner: string,
  repo: string,
  context: AgentContext,
  state: ExecutionState
): Promise<ToolResult> {
  if (!state.branchName) {
    return {
      tool_call_id: toolCallId,
      content: "No working branch set. Select a branch before making edits.",
      error: true,
    };
  }

  // Send file reading event
  if (state.sendEvent) {
    state.sendEvent({ type: "file_reading", path });
  }

  // Fetch current file content
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${state.branchName}`,
    {
      headers: {
        Authorization: `Bearer ${context.githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return {
        tool_call_id: toolCallId,
        content: `File not found: ${path}. Use write_file to create new files.`,
        error: true,
      };
    }
    const error = await response.text();
    return {
      tool_call_id: toolCallId,
      content: `Failed to read file: ${error}`,
      error: true,
    };
  }

  const data = await response.json();
  const currentContent = Buffer.from(data.content, "base64").toString("utf-8");
  const fileSha = data.sha;

  // Apply the edit using deterministic string replacement
  const editResult = applyEdit(currentContent, oldString, newString);

  if (!editResult.success) {
    // Provide actionable error message
    let errorMsg = `Edit failed for ${path}: ${editResult.error}`;
    if (editResult.hint) {
      errorMsg += `\n\nHint: ${editResult.hint}`;
    }
    if (editResult.matches && editResult.matches.length > 0) {
      errorMsg += `\n\nTo fix: Include more surrounding context in old_string to make it unique.`;
    }
    return {
      tool_call_id: toolCallId,
      content: errorMsg,
      error: true,
    };
  }

  const newContent = editResult.content!;

  // Optional: Validate the edit (basic syntax check)
  const validation = validateEdit(newContent, path);
  if (!validation.valid) {
    return {
      tool_call_id: toolCallId,
      content: `Edit would produce invalid file: ${validation.error}\n\nPlease check your new_string for syntax errors.`,
      error: true,
    };
  }

  // Send file writing event
  if (state.sendEvent) {
    state.sendEvent({ type: "file_writing", path });
  }

  // Commit the updated content
  const writeResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${context.githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(newContent).toString("base64"),
        branch: state.branchName,
        sha: fileSha,
      }),
    }
  );

  if (!writeResponse.ok) {
    const error = await writeResponse.text();
    return {
      tool_call_id: toolCallId,
      content: `Failed to write edited file: ${error}`,
      error: true,
    };
  }

  state.filesChanged.push(path);

  // Send file written event
  if (state.sendEvent) {
    state.sendEvent({ type: "file_written", path });
  }

  const changedCount = state.filesChanged.length;

  return {
    tool_call_id: toolCallId,
    content: `✅ Successfully edited \`${path}\` with commit: "${message}"\n\nFiles changed so far: ${changedCount}\n\n**Next step:** Continue with the next edit, or if all changes are done, use create_pull_request.`,
  };
}

// ===========================================
// WRITE FILE
// ===========================================

async function writeFile(
  toolCallId: string,
  path: string,
  content: string,
  message: string,
  owner: string,
  repo: string,
  context: AgentContext,
  state: ExecutionState
): Promise<ToolResult> {
  if (!state.branchName) {
    return {
      tool_call_id: toolCallId,
      content: "No working branch set. Select a branch before making edits.",
      error: true,
    };
  }

  // Check if file exists to get its SHA
  const checkResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${state.branchName}`,
    {
      headers: {
        Authorization: `Bearer ${context.githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  let sha: string | undefined;
  if (checkResponse.ok) {
    const existingFile = await checkResponse.json();
    sha = existingFile.sha;
  }

  // Write the file
  const writeResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${context.githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString("base64"),
        branch: state.branchName,
        ...(sha ? { sha } : {}),
      }),
    }
  );

  if (!writeResponse.ok) {
    const error = await writeResponse.text();
    return {
      tool_call_id: toolCallId,
      content: `Failed to write file: ${error}`,
      error: true,
    };
  }

  state.filesChanged.push(path);

  // Count remaining files in plan vs changed files
  const changedCount = state.filesChanged.length;

  return {
    tool_call_id: toolCallId,
    content: `✅ Successfully wrote \`${path}\` with commit: "${message}"\n\nFiles changed so far: ${changedCount}\n\n**Next step:** Continue with the next file in the plan, or if all files are done, use create_pull_request to open a PR.`,
  };
}

// ===========================================
// DELETE FILE
// ===========================================

async function deleteFile(
  toolCallId: string,
  path: string,
  message: string,
  owner: string,
  repo: string,
  context: AgentContext,
  state: ExecutionState
): Promise<ToolResult> {
  if (!state.branchName) {
    return {
      tool_call_id: toolCallId,
      content: "No working branch set. Select a branch before making edits.",
      error: true,
    };
  }

  // Get file SHA
  const checkResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${state.branchName}`,
    {
      headers: {
        Authorization: `Bearer ${context.githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!checkResponse.ok) {
    return {
      tool_call_id: toolCallId,
      content: `File not found: ${path}`,
      error: true,
    };
  }

  const existingFile = await checkResponse.json();

  // Delete the file
  const deleteResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${context.githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        sha: existingFile.sha,
        branch: state.branchName,
      }),
    }
  );

  if (!deleteResponse.ok) {
    const error = await deleteResponse.text();
    return {
      tool_call_id: toolCallId,
      content: `Failed to delete file: ${error}`,
      error: true,
    };
  }

  state.filesChanged.push(`(deleted) ${path}`);

  const changedCount = state.filesChanged.length;

  return {
    tool_call_id: toolCallId,
    content: `✅ Successfully deleted \`${path}\` with commit: "${message}"\n\nFiles changed so far: ${changedCount}\n\n**Next step:** Continue with the next file in the plan, or if all files are done, use create_pull_request to open a PR.`,
  };
}

// ===========================================
// CREATE PULL REQUEST
// ===========================================

async function createPullRequest(
  toolCallId: string,
  title: string,
  body: string,
  owner: string,
  repo: string,
  context: AgentContext,
  state: ExecutionState
): Promise<ToolResult> {
  // Mark that PR creation was attempted
  state.prAttempted = true;

  if (!state.branchName) {
    state.prError = "No working branch set";
    return {
      tool_call_id: toolCallId,
      content: "No working branch set. This should not happen - please report this error.",
      error: true,
    };
  }

  if (!title) {
    state.prError = "Missing PR title";
    return {
      tool_call_id: toolCallId,
      content: "Missing PR title. Call create_pull_request with both 'title' and 'body' parameters.",
      error: true,
    };
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body: `${body}\n\n---\n*Created by CodeBot*`,
        head: state.branchName,
        base: context.defaultBranch,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorText;
      // Check for common GitHub PR errors
      if (errorJson.errors) {
        const fieldErrors = errorJson.errors.map((e: { message?: string }) => e.message).join(", ");
        errorMessage += `: ${fieldErrors}`;
      }
    } catch {
      errorMessage = errorText;
    }

    state.prError = errorMessage;

    return {
      tool_call_id: toolCallId,
      content: `Failed to create PR: ${errorMessage}`,
      error: true,
    };
  }

  const pr = await response.json();
  state.prUrl = pr.html_url;
  state.prNumber = pr.number;
  state.prError = null;

  return {
    tool_call_id: toolCallId,
    content: `✅ Successfully created PR #${pr.number}: ${pr.html_url}\n\nExecution complete!`,
  };
}

// ===========================================
// CREATE EXECUTION STATE
// ===========================================

export function createExecutionState(
  workingBranch?: string,
  sendEvent?: (event: StreamEvent) => void
): ExecutionState {
  return {
    branchName: workingBranch || null,
    branchSha: null,
    filesChanged: [],
    prUrl: null,
    prNumber: null,
    prAttempted: false,
    prError: null,
    branchSelectionPending: false,
    sendEvent,
  };
}

// ===========================================
// SET WORKING BRANCH (From User Selection)
// ===========================================

export function setWorkingBranch(
  state: ExecutionState,
  branchName: string
): void {
  state.branchName = branchName;
  state.branchSelectionPending = false;

  if (state.sendEvent) {
    state.sendEvent({ type: "branch_selected", branchName });
  }
}

// ===========================================
// CHECK IF BRANCH SELECTION PENDING
// ===========================================

export function isBranchSelectionPending(state: ExecutionState): boolean {
  return state.branchSelectionPending;
}

// ===========================================
// GET EXECUTION RESULT
// ===========================================

export function getExecutionResult(state: ExecutionState): ExecutionResult {
  if (state.prUrl) {
    return {
      success: true,
      branchName: state.branchName || undefined,
      prUrl: state.prUrl,
      prNumber: state.prNumber || undefined,
      filesChanged: state.filesChanged,
    };
  }

  // If PR was attempted but failed, include the error
  if (state.prAttempted && state.prError) {
    return {
      success: false,
      branchName: state.branchName || undefined,
      filesChanged: state.filesChanged,
      error: `PR creation failed: ${state.prError}`,
    };
  }

  return {
    success: false,
    branchName: state.branchName || undefined,
    filesChanged: state.filesChanged,
    error: "Execution incomplete - no PR created",
  };
}

// Check if PR was attempted (success or failure)
export function wasPrAttempted(state: ExecutionState): boolean {
  return state.prAttempted;
}

// ===========================================
// GENERATE EXECUTOR PROMPT
// ===========================================

export function generateExecutorPrompt(plan: Plan, workingBranch: string): string {
  const stepsText = plan.steps
    .map(
      (step, i) =>
        `${i + 1}. ${step.type.toUpperCase()} ${step.path}: ${step.description}`
    )
    .join("\n");

  const totalSteps = plan.steps.length;
  const filesAffected = plan.filesAffected?.length || totalSteps;

  return `Execute the following approved plan:

## ${plan.title}
${plan.summary}

### Working Branch: \`${workingBranch}\`
All commits will be made to this branch. Do NOT create a new branch.

### Steps (${totalSteps} total):
${stepsText}

## EXECUTION WORKFLOW (FOLLOW THIS EXACTLY):

1. **For EACH file that needs to be modified:**
   - Call \`read_current_file\` to get the current content
   - Apply the changes from the plan
   - Call \`write_file\` with the complete updated content and a descriptive commit message

2. **For EACH new file:**
   - Call \`write_file\` with the new content (no need to read first)

3. **After ALL ${filesAffected} file(s) are written:**
   - Call \`create_pull_request\` with a title and description summarizing the changes
   - This is the FINAL step that completes the execution

**IMPORTANT:**
- Do NOT repeat the same tool call with the same arguments
- Do NOT call read_current_file multiple times for the same file
- After write_file succeeds, move to the next file or create the PR
- The execution is ONLY complete when create_pull_request is called

Begin execution now. Start with the first file.`;
}

// ===========================================
// EXECUTOR AGENT: CODE GENERATION SYSTEM PROMPT
// ===========================================

const EXECUTOR_CODE_GEN_PROMPT = `You are a precise code editor. Given the current file content and a description of the change to make, output the EXACT edit needed.

RULES:
- For "modify": Return JSON with "old_string" and "new_string"
  - old_string: Copy EXACTLY from the file (same whitespace, indentation, quotes, blank lines)
  - old_string MUST be unique in the file — include enough surrounding context lines (e.g. function name, class name, decorators) to disambiguate
  - If a pattern repeats (e.g. multiple __init__ methods), include the class name or function signature above it
  - Preserve the EXACT indentation: use spaces if the file uses spaces, tabs if tabs. Count carefully.
  - new_string: The replacement text with correct indentation matching the file style
- For "create": Return JSON with "content" (the full file content)
- For "delete": Return JSON with "delete": true (file will be removed entirely)
- Return ONLY the JSON object, no markdown, no explanation, no extra text
- If old_string spans multiple lines, include ALL lines exactly as they appear
- Do NOT return the full modified file — only the specific old/new strings

RESPONSE FORMAT (modify):
{"old_string": "exact text from file", "new_string": "replacement text"}

RESPONSE FORMAT (create):
{"content": "full file content"}

IMPORTANT: Your entire response must be a single JSON object. Nothing else.`;

// ===========================================
// JSON EXTRACTION (from LLM response)
// ===========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJSON(text: string): Record<string, any> | null {
  // Strategy 1: Direct parse (response IS the JSON)
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch { /* continue */ }

  // Strategy 2: Extract from markdown code block
  const codeBlockMatch = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch { /* continue */ }
  }

  // Strategy 3: Find first { ... } that contains old_string or content key
  const braceMatch = text.match(/\{[\s\S]*"(?:old_string|content)"[\s\S]*\}/);
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0]);
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch { /* continue */ }
  }

  // Strategy 4: Find the first { and last } and try parsing
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch { /* continue */ }
  }

  return null;
}

// ===========================================
// LLM CODE GENERATION (per step)
// ===========================================

async function generateCodeForStep(
  stepType: "create" | "modify",
  path: string,
  description: string,
  fileContent: string | null,
  chatFn: ChatFn,
  previousError?: string,
  customInstructions?: string,
): Promise<{
  success: boolean;
  oldString?: string;
  newString?: string;
  content?: string;
  error?: string;
}> {
  let userPrompt: string;

  if (stepType === "create") {
    userPrompt = `Create a new file: ${path}\n\nDescription: ${description}\n\nReturn JSON: {"content": "full file content"}`;
  } else {
    userPrompt = `File: ${path}\nChange: ${description}\n\nCurrent file content:\n\`\`\`\n${fileContent}\n\`\`\`\n\nReturn JSON: {"old_string": "exact text to find", "new_string": "replacement text"}`;
  }

  if (previousError) {
    userPrompt += `\n\n⚠️ PREVIOUS ATTEMPT FAILED: ${previousError}\n` +
      `CRITICAL: Your old_string MUST be copied character-for-character from the file content above. ` +
      `Do NOT retype it from memory. Find the exact lines in the file content, select them precisely ` +
      `(including indentation, spaces, and newlines), and use that as old_string.`;
  }

  let systemPrompt = EXECUTOR_CODE_GEN_PROMPT;
  if (customInstructions) {
    systemPrompt += `\n\nCUSTOM INSTRUCTIONS (follow these when writing code):\n${customInstructions}`;
  }

  const llmMessages: LLMChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const response = await chatFn(llmMessages);

    const text = response.content.trim();

    // Try multiple strategies to extract JSON from the response
    const parsed = extractJSON(text);

    if (!parsed) {
      return { success: false, error: `LLM did not return valid JSON. Response was ${text.length} chars. Ensure you return ONLY a JSON object with old_string and new_string.` };
    }

    if (stepType === "create") {
      if (!parsed.content) {
        return { success: false, error: "LLM returned no content for file creation" };
      }
      return { success: true, content: parsed.content };
    } else {
      // LLM sometimes returns {content: "full file"} instead of {old_string, new_string}
      // for modify steps. Handle this as a full file replacement.
      if (parsed.content && !parsed.old_string) {
        return { success: true, oldString: fileContent!, newString: parsed.content };
      }
      if (!parsed.old_string || parsed.new_string === undefined) {
        const keys = Object.keys(parsed).join(", ");
        return { success: false, error: `LLM returned JSON but missing old_string/new_string. Got keys: [${keys}]. Return ONLY: {"old_string": "...", "new_string": "..."}` };
      }
      return { success: true, oldString: parsed.old_string, newString: parsed.new_string };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: `Code generation failed: ${msg}` };
  }
}

// ===========================================
// RUN EXECUTOR AGENT
// ===========================================
//
// For each plan step:
//   1. Read file from GitHub via ToolExecutor (fresh, includes prior step commits)
//   2. LLM call: file content + step.description → old_string/new_string (modify) or content (create)
//   3. applyEdit() deterministically
//   4. If fails → retry with error context (up to 3 times)
//   5. Commit via ToolExecutor (single batch commit at end)
//   6. Send diff event for UI

export async function runExecutor(
  plan: Plan,
  context: AgentContext,
  executor: ToolExecutor,
  chatFn: ChatFn,
  onEvent: (event: StreamEvent) => void,
): Promise<{ success: boolean; filesChanged?: string[]; error?: string }> {
  const repoId = context.repoId;
  const branch = context.workingBranch!;
  const filesChanged: string[] = [];

  // In-memory file cache: accumulate all changes, commit once at the end.
  // Key = file path, Value = { content (null for deletes) }
  const fileCache = new Map<string, { content: string | null }>();

  onEvent({ type: "execution_start", branchName: branch });

  try {
    for (let stepIdx = 0; stepIdx < plan.steps.length; stepIdx++) {
      const step = plan.steps[stepIdx];
      const path = step.path;
      if (!path) continue;

      onEvent({
        type: "step_start",
        stepId: step.id,
        stepIndex: stepIdx,
        totalSteps: plan.steps.length,
        description: step.description,
      });

      // === DELETE ===
      if (step.type === "delete") {
        fileCache.set(path, { content: null });
        filesChanged.push(`(deleted) ${path}`);
        onEvent({ type: "step_complete", stepId: step.id, status: "completed" });
        continue;
      }

      // === CREATE (LLM generates full content) ===
      if (step.type === "create") {
        onEvent({ type: "step_generating_code", stepId: step.id, path });

        const generated = await generateCodeForStep(
          step.type, path, step.description, null, chatFn,
          undefined, context.customInstructions,
        );

        if (!generated.success) {
          onEvent({ type: "step_complete", stepId: step.id, status: "failed", error: generated.error });
          continue;
        }

        const content = generated.content!;
        fileCache.set(path, { content });
        filesChanged.push(path);
        onEvent({ type: "step_diff", stepId: step.id, path, oldString: "", newString: content });
        onEvent({ type: "step_complete", stepId: step.id, status: "completed" });
        continue;
      }

      // === MODIFY (LLM generates old_string/new_string, applyEdit deterministic) ===
      // Read from cache first (previous step may have modified this file), else from GitHub
      let fileContent: string;
      const cached = fileCache.get(path);
      if (cached && cached.content !== null) {
        fileContent = cached.content;
      } else {
        onEvent({ type: "file_reading", path });
        const currentFile = await executor.readFileFromGitHub(repoId, path, branch);
        if (!currentFile) {
          onEvent({ type: "step_complete", stepId: step.id, status: "failed", error: `File not found: ${path}` });
          continue;
        }
        fileContent = currentFile.content;
      }

      let success = false;
      let lastError = "";

      // Small file optimization: for files under SMALL_FILE_THRESHOLD lines,
      // ask LLM to produce the full modified file instead of old_string/new_string.
      // OSS models struggle with exact string matching on very small files.
      const fileLines = fileContent.split("\n").length;
      const useFullFileMode = fileLines < SMALL_FILE_THRESHOLD;

      if (useFullFileMode) {
        onEvent({ type: "step_generating_code", stepId: step.id, path });

        const generated = await generateCodeForStep(
          "create", // ask for full content
          path,
          `The file currently contains:\n\`\`\`\n${fileContent}\n\`\`\`\n\nApply this change: ${step.description}\n\nReturn the COMPLETE modified file content.`,
          null,
          chatFn,
          undefined,
          context.customInstructions,
        );

        if (generated.success && generated.content) {
          const validation = validateEdit(generated.content, path);
          if (validation.valid) {
            const oldContent = fileContent;
            fileContent = generated.content;
            fileCache.set(path, { content: fileContent });
            filesChanged.push(path);
            onEvent({ type: "step_diff", stepId: step.id, path, oldString: oldContent, newString: fileContent });
            success = true;
          } else {
            lastError = `Validation failed: ${validation.error}`;
          }
        } else {
          lastError = generated.error || "Failed to generate code";
        }
      }

      // Standard edit mode: old_string/new_string with retry loop
      if (!success && !useFullFileMode) {
        // Retry loop for edit generation + application
        // On retry, re-read the file to get fresh content (handles stale reads / model mismatch)
        for (let attempt = 1; attempt <= MAX_EDIT_RETRIES; attempt++) {
          // Re-read file on retry to give LLM fresh, accurate content
          if (attempt > 1) {
            onEvent({ type: "file_reading", path });
            const freshFile = await executor.readFileFromGitHub(repoId, path, branch);
            if (freshFile) {
              fileContent = freshFile.content;
              // Update cache with fresh content
              fileCache.set(path, { content: fileContent });
            }
          }

          onEvent({ type: "step_generating_code", stepId: step.id, path });

          const generated = await generateCodeForStep(
            step.type,
            path,
            step.description,
            fileContent,
            chatFn,
            attempt > 1 ? lastError : undefined,
            context.customInstructions,
          );

          if (!generated.success) {
            lastError = generated.error || "Failed to generate code";
            continue;
          }

          const oldString = generated.oldString!;
          const newString = generated.newString!;

          // Apply edit deterministically
          const editResult = applyEdit(fileContent, oldString, newString);

          if (!editResult.success) {
            lastError = editResult.error || "Edit failed";
            if (editResult.hint) lastError += ` ${editResult.hint}`;
            continue;
          }

          // Validate the edit
          const validation = validateEdit(editResult.content!, path);
          if (!validation.valid) {
            lastError = `Validation failed: ${validation.error}`;
            continue;
          }

          // Store in cache (no commit yet)
          fileContent = editResult.content!;
          fileCache.set(path, { content: fileContent });
          filesChanged.push(path);

          // Send diff for UI
          onEvent({ type: "step_diff", stepId: step.id, path, oldString, newString });

          success = true;
          break;
        }
      }

      if (success) {
        onEvent({ type: "step_complete", stepId: step.id, status: "completed" });
      } else {
        onEvent({
          type: "step_complete",
          stepId: step.id,
          status: "failed",
          error: `Failed after ${MAX_EDIT_RETRIES} attempts: ${lastError}`,
        });
      }
    }

    // === SINGLE COMMIT: batch all cached changes into one commit ===
    if (fileCache.size > 0) {
      onEvent({ type: "thinking", message: `Committing ${fileCache.size} file(s)...` });

      const batchFiles = Array.from(fileCache.entries()).map(([path, { content }]) => ({
        path,
        content,
      }));

      await executor.commitFiles(repoId, {
        branch,
        message: `${plan.title}\n\n${plan.steps.map((s, i) => `${i + 1}. ${s.type} ${s.path}: ${s.description}`).join("\n")}`,
        files: batchFiles,
      });
    }

    // Deduplicate filesChanged (same file may appear in multiple steps)
    const uniqueFiles = [...new Set(filesChanged)];
    return { success: true, filesChanged: uniqueFiles };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: errorMsg };
  }
}
