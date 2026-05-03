// Review Agent - reviews PRs and issues
//
// Pure module: no Supabase, no Next.js imports.
// All GitHub access goes through ToolExecutor.
// LLM calls go through injected ChatFn.

import type { ToolExecutor } from "./tools/interface";
import type {
  AgentContext,
  StreamEvent,
  ChatFn,
  LLMChatMessage,
} from "./types";
import { MAX_TOOL_RESULT_CHARS } from "./constants";

// ===========================================
// REVIEW SYSTEM PROMPT
// ===========================================

const reviewSystemPrompt = `You are a code review agent. You review pull requests and GitHub issues.

## PR Review
For each PR, provide:
1. **Summary** (1-2 sentences)
2. **Issues Found** — prioritize: security > bugs > performance > style
3. **Suggestions** — specific improvements with file names and line references
4. **Verdict**: APPROVE, REQUEST_CHANGES, or COMMENT (with reason)

Be specific — reference file names, line numbers, and code snippets. Suggest fixes, not just problems. For large PRs, focus on the most impactful files first.

## Issue Review
For each issue, provide:
1. **Summary** — what the issue is about
2. **Impact** (critical / high / medium / low)
3. **Suggested approach** — how to fix or implement it
4. **Estimated complexity** (simple / moderate / complex)

## Rules
- Be constructive and actionable
- If custom instructions are provided, verify the code follows them`;

// ===========================================
// RUN REVIEWER (PR)
// ===========================================

export async function reviewPR(
  prNumber: number,
  context: AgentContext,
  executor: ToolExecutor,
  chatFn: ChatFn,
  onEvent: (event: StreamEvent) => void,
): Promise<{ review: string; error?: string }> {
  onEvent({ type: "thinking", message: `Fetching PR #${prNumber}...` });

  try {
    const pr = await executor.getPRDiff(context.repoId, prNumber);

    // Build the review prompt with diff content
    let diffContent = "";
    for (const file of pr.files) {
      const patch = file.patch.length > MAX_TOOL_RESULT_CHARS
        ? file.patch.slice(0, MAX_TOOL_RESULT_CHARS) + "\n... (truncated)"
        : file.patch;

      diffContent += `\n### ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})\n\`\`\`diff\n${patch}\n\`\`\`\n`;
    }

    let commentsSection = "";
    if (pr.comments.length > 0) {
      commentsSection = "\n## Existing Comments:\n" +
        pr.comments.map(c => `**${c.user}** (${c.createdAt})${c.path ? ` on \`${c.path}\`` : ""}:\n${c.body}`).join("\n\n");
    }

    let systemPrompt = reviewSystemPrompt;
    if (context.customInstructions) {
      systemPrompt += `\n\n## CUSTOM INSTRUCTIONS (check code against these):\n${context.customInstructions}`;
    }

    const userPrompt = `Review this pull request:

## PR #${pr.number}: ${pr.title}
**Author:** ${pr.user}
**Branch:** ${pr.headBranch} → ${pr.baseBranch}
**URL:** ${pr.url}

### Description:
${pr.body || "(no description)"}

### Changed Files (${pr.files.length}):
${diffContent}
${commentsSection}

Provide a thorough code review following the guidelines.`;

    const messages: LLMChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    onEvent({ type: "thinking", message: `Reviewing ${pr.files.length} changed files...` });

    const response = await chatFn(messages);
    return { review: response.content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { review: "", error: `Failed to review PR: ${msg}` };
  }
}

// ===========================================
// RUN REVIEWER (ISSUE)
// ===========================================

export async function reviewIssue(
  issueNumber: number,
  context: AgentContext,
  executor: ToolExecutor,
  chatFn: ChatFn,
  onEvent: (event: StreamEvent) => void,
): Promise<{ review: string; error?: string }> {
  onEvent({ type: "thinking", message: `Fetching issue #${issueNumber}...` });

  try {
    const issue = await executor.getIssue(context.repoId, issueNumber);

    let commentsSection = "";
    if (issue.comments.length > 0) {
      commentsSection = "\n## Comments:\n" +
        issue.comments.map(c => `**${c.user}** (${c.createdAt}):\n${c.body}`).join("\n\n");
    }

    let systemPrompt = reviewSystemPrompt;
    if (context.customInstructions) {
      systemPrompt += `\n\n## CUSTOM INSTRUCTIONS:\n${context.customInstructions}`;
    }

    const userPrompt = `Review this GitHub issue:

## Issue #${issue.number}: ${issue.title}
**Author:** ${issue.user}
**State:** ${issue.state}
**Labels:** ${issue.labels.join(", ") || "none"}
**URL:** ${issue.url}

### Description:
${issue.body || "(no description)"}
${commentsSection}

Analyze this issue and provide your assessment following the guidelines.
Consider searching the codebase to identify affected files and suggest an approach.`;

    const messages: LLMChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    onEvent({ type: "thinking", message: "Analyzing issue..." });

    const response = await chatFn(messages);
    return { review: response.content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { review: "", error: `Failed to review issue: ${msg}` };
  }
}

// ===========================================
// LIST PRs / ISSUES (formatted for user)
// ===========================================

export async function listOpenPRs(
  context: AgentContext,
  executor: ToolExecutor,
): Promise<string> {
  const prs = await executor.listPRs(context.repoId, "open");

  if (prs.length === 0) {
    return "No open pull requests found.";
  }

  const list = prs.map(pr =>
    `- **#${pr.number}** ${pr.title} (by ${pr.user}, ${pr.changedFiles} files, +${pr.additions}/-${pr.deletions})\n  ${pr.url}`
  ).join("\n");

  return `**Open Pull Requests (${prs.length}):**\n\n${list}\n\nSay "review PR #N" to review a specific PR.`;
}

export async function listOpenIssues(
  context: AgentContext,
  executor: ToolExecutor,
): Promise<string> {
  const issues = await executor.listIssues(context.repoId, "open");

  if (issues.length === 0) {
    return "No open issues found.";
  }

  const list = issues.map(i =>
    `- **#${i.number}** ${i.title} (by ${i.user}${i.labels.length > 0 ? `, labels: ${i.labels.join(", ")}` : ""}, ${i.commentCount} comments)\n  ${i.url}`
  ).join("\n");

  return `**Open Issues (${issues.length}):**\n\n${list}\n\nSay "review issue #N" to review a specific issue.`;
}

// ===========================================
// SECURITY SCAN
// ===========================================

const securityScanPrompt = `You are a security auditor. Your job is to scan code files for security vulnerabilities.

Focus ONLY on CRITICAL and HIGH severity issues:

**CRITICAL:**
- Hardcoded secrets, API keys, passwords, tokens in source code
- SQL injection (raw query construction with user input)
- Command injection (exec/spawn with user input)
- Authentication bypass (missing auth checks on sensitive routes)
- Insecure deserialization
- Path traversal (user input in file paths)

**HIGH:**
- XSS (unescaped user input in HTML/templates)
- SSRF (fetching user-provided URLs without validation)
- Insecure cryptography (weak algorithms, hardcoded IVs)
- Missing CSRF protection on state-changing endpoints
- Exposed stack traces or debug info in production
- Overly permissive CORS
- Missing rate limiting on auth endpoints

**DO NOT report:**
- Code style issues
- Missing type annotations
- Low-severity warnings
- Best practice suggestions that aren't security-related

## Output Format:
For each issue found:
1. **Severity**: CRITICAL or HIGH
2. **File**: exact file path
3. **Line/Area**: where the issue is
4. **Issue**: what the vulnerability is
5. **Risk**: what an attacker could do
6. **Fix**: specific remediation

If no CRITICAL or HIGH issues are found, say "No critical or high security issues found."`;

export async function securityScan(
  context: AgentContext,
  executor: ToolExecutor,
  chatFn: ChatFn,
  onEvent: (event: StreamEvent) => void,
  targetPath?: string,
  prNumber?: number,
): Promise<{ report: string; error?: string }> {
  onEvent({ type: "thinking", message: "Starting security scan..." });

  try {
    let codeContent = "";
    let filesScanned = 0;

    // If PR number provided, scan the PR diff
    if (prNumber) {
      const pr = await executor.getPRDiff(context.repoId, prNumber);
      onEvent({ type: "thinking", message: `Scanning PR #${prNumber} (${pr.files.length} changed files)...` });

      for (const file of pr.files) {
        const patch = file.patch.length > MAX_TOOL_RESULT_CHARS
          ? file.patch.slice(0, MAX_TOOL_RESULT_CHARS) + "\n... (truncated)"
          : file.patch;
        codeContent += `\n### ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})\n\`\`\`diff\n${patch}\n\`\`\`\n`;
        filesScanned++;
        if (codeContent.length > 50_000) { codeContent += "\n... (remaining files skipped)"; break; }
      }

      if (filesScanned === 0) return { report: "No changed files in this PR." };
    } else {
      // Step 1: Read summaries to find files with security issues flagged
      const allFiles = await executor.listCodeDefinitions(context.repoId, { pattern: targetPath || "", limit: 200 });
      if (allFiles.length === 0) return { report: "No files found to scan." };

      const securityPattern = /security|vulnerab|inject|xss|csrf|ssrf|auth.*bypass|hardcoded.*secret|hardcoded.*key|hardcoded.*password|exposed|insecure|unsafe|unescaped|path.*traversal|command.*inject|sql.*inject/i;

      const flaggedFiles = allFiles.filter(f => f.summary && securityPattern.test(f.summary));
      const securityNamePattern = /auth|login|token|password|secret|api|route|middleware|webhook|crypto|session|admin|upload|config|oauth|jwt/i;
      const sensitiveFiles = allFiles.filter(f => !flaggedFiles.includes(f) && securityNamePattern.test(f.path));

      // Combine: flagged by summary first, then sensitive by name
      const filesToScan = [...flaggedFiles, ...sensitiveFiles].slice(0, 30);

      onEvent({ type: "thinking", message: `Found ${flaggedFiles.length} files with security flags, ${sensitiveFiles.length} sensitive files. Reading ${filesToScan.length} files...` });

      // Step 2: Read full code only for flagged/sensitive files
      for (const file of filesToScan) {
        const fileData = await executor.readFile(context.repoId, { path: file.path });
        if (!fileData) continue;

        const content = fileData.content.length > MAX_TOOL_RESULT_CHARS
          ? fileData.content.slice(0, MAX_TOOL_RESULT_CHARS) + "\n... (truncated)"
          : fileData.content;
        const summaryNote = flaggedFiles.includes(file) ? `\n**Summary flag:** ${file.summary?.match(securityPattern)?.[0] || "security issue noted"}` : "";
        codeContent += `\n### ${file.path} (${file.language})${summaryNote}\n\`\`\`\n${content}\n\`\`\`\n`;
        filesScanned++;
        if (codeContent.length > 50_000) { codeContent += "\n... (remaining files skipped)"; break; }
      }

      // If no flagged or sensitive files found, report clean
      if (filesScanned === 0) {
        return { report: `Scanned ${allFiles.length} file summaries — no security issues flagged. The codebase appears clean.\n\nNote: Run a full re-index to ensure summaries include security analysis.` };
      }
    }

    if (filesScanned === 0) {
      return { report: "No code files found to scan." };
    }

    let systemPrompt = securityScanPrompt;
    if (context.customInstructions) {
      systemPrompt += `\n\n## CUSTOM INSTRUCTIONS (also check against these):\n${context.customInstructions}`;
    }

    const scopeLabel = prNumber ? `PR #${prNumber}` : targetPath || "entire codebase";
    const userPrompt = `Scan these ${filesScanned} files for CRITICAL and HIGH security vulnerabilities:\n\n**Repository:** ${context.repoFullName}\n**Scope:** ${scopeLabel}\n${codeContent}`;

    const messages: LLMChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    onEvent({ type: "thinking", message: `Analyzing ${filesScanned} files...` });

    const response = await chatFn(messages);
    return { report: response.content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { report: "", error: `Security scan failed: ${msg}` };
  }
}
