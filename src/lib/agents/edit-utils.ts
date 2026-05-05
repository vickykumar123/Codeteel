/**
 * File Editing Utilities
 *
 * Multi-tier string-based editing for code files.
 * Based on patterns from Claude Code and Cline.
 *
 * Matching tiers (tried in order):
 *   1. Exact match (indexOf)
 *   2. Smart quote normalization (curly → straight quotes)
 *   3. Line-trimmed match (ignore leading/trailing whitespace per line)
 *   4. Block anchor match (first + last line anchors for 3+ line blocks)
 *   5. Levenshtein similarity ≥ 66% (last resort fuzzy)
 *
 * Safety features:
 *   - Uniqueness enforcement (rejects ambiguous matches)
 *   - Sequential edit safety (prevents editing just-inserted text)
 *   - Trailing newline handling for deletions
 */

// ===========================================
// TYPES
// ===========================================

export interface EditMatch {
  start: number;
  end: number;
  line: number;
  tier: MatchTier;
}

export type MatchTier =
  | "exact"
  | "smart_quote"
  | "line_trimmed"
  | "block_anchor"
  | "levenshtein";

export interface EditResult {
  success: boolean;
  content?: string;
  error?: string;
  matches?: EditMatch[];
  hint?: string;
  matchTier?: MatchTier;
}

export interface BatchEditResult {
  success: boolean;
  content?: string;
  error?: string;
  appliedEdits: number;
  failedEdit?: { index: number; error: string };
}

// ===========================================
// SMART QUOTE NORMALIZATION (Claude Code pattern)
// ===========================================

/**
 * Normalize smart/curly quotes to straight quotes.
 * LLMs often generate curly quotes while source files use straight quotes.
 */
function normalizeQuotes(str: string): string {
  return str
    .replace(/\u2018/g, "'") // left single quote
    .replace(/\u2019/g, "'") // right single quote
    .replace(/\u201C/g, '"') // left double quote
    .replace(/\u201D/g, '"'); // right double quote
}

// ===========================================
// LEVENSHTEIN DISTANCE
// ===========================================

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching as last resort (Cline's apply_patch pattern).
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Optimization: use single-row DP for memory efficiency
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Calculate similarity ratio between two strings (0.0 to 1.0).
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

// ===========================================
// LINE UTILITIES
// ===========================================

function getLineNumber(content: string, pos: number): number {
  return content.slice(0, pos).split("\n").length;
}

function splitLines(str: string): string[] {
  return str.split("\n");
}

// ===========================================
// TIER 1: EXACT MATCH
// ===========================================

/**
 * Find all exact occurrences of a search string in content.
 */
export function findAllMatches(content: string, search: string): EditMatch[] {
  const matches: EditMatch[] = [];
  let pos = 0;

  while ((pos = content.indexOf(search, pos)) !== -1) {
    matches.push({
      start: pos,
      end: pos + search.length,
      line: getLineNumber(content, pos),
      tier: "exact",
    });
    pos += 1;
  }

  return matches;
}

// ===========================================
// TIER 2: SMART QUOTE MATCH (Claude Code)
// ===========================================

/**
 * Try matching after normalizing smart quotes to straight quotes.
 * Returns the ORIGINAL text from the file (not the normalized version).
 */
function findSmartQuoteMatch(
  content: string,
  search: string
): EditMatch | null {
  const normalizedContent = normalizeQuotes(content);
  const normalizedSearch = normalizeQuotes(search);

  // If normalization didn't change anything, skip (already tried exact)
  if (normalizedSearch === search && normalizedContent === content) return null;

  const pos = normalizedContent.indexOf(normalizedSearch);
  if (pos === -1) return null;

  // Check uniqueness in normalized form
  const secondPos = normalizedContent.indexOf(normalizedSearch, pos + 1);
  if (secondPos !== -1) return null; // Multiple matches, not safe

  return {
    start: pos,
    end: pos + search.length,
    line: getLineNumber(content, pos),
    tier: "smart_quote",
  };
}

// ===========================================
// TIER 3: LINE-TRIMMED MATCH (Cline pattern)
// ===========================================

/**
 * Match by trimming each line and comparing.
 * Handles indentation differences between LLM output and actual file.
 */
function findLineTrimmedMatch(
  content: string,
  search: string
): EditMatch | null {
  const contentLines = splitLines(content);
  const searchLines = splitLines(search);

  if (searchLines.length === 0) return null;

  // Slide the search window over the content
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let allMatch = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (contentLines[i + j].trim() !== searchLines[j].trim()) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      // Check uniqueness — look for another match
      let duplicate = false;
      for (
        let k = i + 1;
        k <= contentLines.length - searchLines.length;
        k++
      ) {
        let matches = true;
        for (let j = 0; j < searchLines.length; j++) {
          if (contentLines[k + j].trim() !== searchLines[j].trim()) {
            matches = false;
            break;
          }
        }
        if (matches) {
          duplicate = true;
          break;
        }
      }
      if (duplicate) return null; // Multiple matches

      // Calculate byte position of the match
      const start = contentLines.slice(0, i).join("\n").length + (i > 0 ? 1 : 0);
      const matchedText = contentLines.slice(i, i + searchLines.length).join("\n");
      const end = start + matchedText.length;

      return {
        start,
        end,
        line: i + 1,
        tier: "line_trimmed",
      };
    }
  }

  return null;
}

// ===========================================
// TIER 4: BLOCK ANCHOR MATCH (Cline pattern)
// ===========================================

/**
 * For blocks of 3+ lines, match using first and last lines as anchors.
 * Checks that they appear at the expected distance apart.
 */
function findBlockAnchorMatch(
  content: string,
  search: string
): EditMatch | null {
  const searchLines = splitLines(search);
  if (searchLines.length < 3) return null; // Only for 3+ line blocks

  const contentLines = splitLines(content);
  const firstLine = searchLines[0].trim();
  const lastLine = searchLines[searchLines.length - 1].trim();
  const expectedGap = searchLines.length - 1;

  if (!firstLine || !lastLine) return null;

  let matchStart = -1;
  let matchCount = 0;

  for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].trim() === firstLine) {
      const lastIdx = i + expectedGap;
      if (
        lastIdx < contentLines.length &&
        contentLines[lastIdx].trim() === lastLine
      ) {
        matchCount++;
        if (matchCount > 1) return null; // Multiple anchor matches
        matchStart = i;
      }
    }
  }

  if (matchStart === -1) return null;

  const start =
    contentLines.slice(0, matchStart).join("\n").length +
    (matchStart > 0 ? 1 : 0);
  const matchedText = contentLines
    .slice(matchStart, matchStart + searchLines.length)
    .join("\n");
  const end = start + matchedText.length;

  return {
    start,
    end,
    line: matchStart + 1,
    tier: "block_anchor",
  };
}

// ===========================================
// TIER 5: LEVENSHTEIN FUZZY MATCH (Cline apply_patch)
// ===========================================

const LEVENSHTEIN_THRESHOLD = 0.66;

/**
 * Find the best fuzzy match using Levenshtein distance.
 * Only accepts matches with similarity >= 66%.
 * Slides a window of search.length over the content lines.
 */
function findLevenshteinMatch(
  content: string,
  search: string
): EditMatch | null {
  const contentLines = splitLines(content);
  const searchLines = splitLines(search);

  if (searchLines.length === 0) return null;

  // Limit: don't try fuzzy on very large searches (expensive)
  if (searchLines.length > 50 || contentLines.length > 5000) return null;

  let bestSim = 0;
  let bestStart = -1;

  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    const candidate = contentLines
      .slice(i, i + searchLines.length)
      .join("\n");
    const sim = similarity(candidate, search);

    if (sim > bestSim) {
      bestSim = sim;
      bestStart = i;
    }
  }

  if (bestSim < LEVENSHTEIN_THRESHOLD || bestStart === -1) return null;

  const start =
    contentLines.slice(0, bestStart).join("\n").length +
    (bestStart > 0 ? 1 : 0);
  const matchedText = contentLines
    .slice(bestStart, bestStart + searchLines.length)
    .join("\n");
  const end = start + matchedText.length;

  return {
    start,
    end,
    line: bestStart + 1,
    tier: "levenshtein",
  };
}

// ===========================================
// MULTI-TIER MATCH (tries all tiers in order)
// ===========================================

/**
 * Find a match using all tiers in order of reliability.
 * Returns the first unique match found.
 */
function findBestMatch(
  content: string,
  search: string
): { match: EditMatch | null; allExactMatches?: EditMatch[] } {
  // Tier 1: Exact match
  const exactMatches = findAllMatches(content, search);
  if (exactMatches.length === 1) {
    return { match: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    // Multiple exact matches — return them all so caller can report
    return { match: null, allExactMatches: exactMatches };
  }

  // Tier 2: Smart quote normalization
  const smartQuoteMatch = findSmartQuoteMatch(content, search);
  if (smartQuoteMatch) return { match: smartQuoteMatch };

  // Tier 3: Line-trimmed match
  const lineTrimmedMatch = findLineTrimmedMatch(content, search);
  if (lineTrimmedMatch) return { match: lineTrimmedMatch };

  // Tier 4: Block anchor match
  const blockAnchorMatch = findBlockAnchorMatch(content, search);
  if (blockAnchorMatch) return { match: blockAnchorMatch };

  // Tier 5: Levenshtein fuzzy match
  const levenshteinMatch = findLevenshteinMatch(content, search);
  if (levenshteinMatch) return { match: levenshteinMatch };

  return { match: null };
}

// ===========================================
// APPLY EDIT (single)
// ===========================================

/**
 * Apply an edit by replacing old_string with new_string.
 * Uses multi-tier matching for robustness.
 *
 * For tier > exact, the ACTUAL text from the file is replaced
 * (not the normalized/fuzzy version), ensuring correct output.
 */
export function applyEdit(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false
): EditResult {
  // Handle deletion with trailing newline (Claude Code pattern)
  if (newString === "" && !oldString.endsWith("\n")) {
    if (content.includes(oldString + "\n")) {
      oldString = oldString + "\n";
    }
  }

  // replaceAll mode — only uses exact matching
  if (replaceAll) {
    const matches = findAllMatches(content, oldString);
    if (matches.length === 0) {
      const hint = findCloseMatch(content, oldString);
      return {
        success: false,
        error: "String not found in file.",
        hint,
      };
    }
    const newContent = content.split(oldString).join(newString);
    return {
      success: true,
      content: newContent,
      matchTier: "exact",
    };
  }

  // Single replacement — use multi-tier matching
  const { match, allExactMatches } = findBestMatch(content, oldString);

  // Multiple exact matches
  if (allExactMatches && allExactMatches.length > 1) {
    return {
      success: false,
      error: `Found ${allExactMatches.length} matches at lines ${allExactMatches.map((m) => m.line).join(", ")}. The old_string must be unique. Add more surrounding context to make it unique, or set replace_all to true.`,
      matches: allExactMatches,
    };
  }

  // No match at any tier
  if (!match) {
    const hint = findCloseMatch(content, oldString);
    return {
      success: false,
      error: "String not found in file. The exact text to replace was not found in the file.",
      hint,
    };
  }

  // Apply the replacement using the actual matched text position
  const actualMatchedText = content.slice(match.start, match.end);
  const newContent =
    content.slice(0, match.start) + newString + content.slice(match.end);

  return {
    success: true,
    content: newContent,
    matchTier: match.tier,
  };
}

// ===========================================
// BATCH EDIT (sequential, with safety)
// ===========================================

/**
 * Apply multiple edits to a file sequentially.
 * Each edit sees the result of previous edits.
 *
 * Safety: Prevents editing text that was just inserted by a prior edit
 * (Claude Code pattern — catches LLM mistakes where it targets its own output).
 */
export function applyBatchEdits(
  content: string,
  edits: Array<{ oldString: string; newString: string }>
): BatchEditResult {
  let current = content;
  const previousNewStrings: string[] = [];

  for (let i = 0; i < edits.length; i++) {
    const { oldString, newString } = edits[i];
    const trimmedOld = oldString.replace(/\n+$/, "");

    // Safety: check if old_string targets text from a previous edit's new_string
    if (trimmedOld !== "") {
      for (const prev of previousNewStrings) {
        if (prev.includes(trimmedOld)) {
          return {
            success: false,
            content: current,
            appliedEdits: i,
            failedEdit: {
              index: i,
              error: `Cannot edit: old_string is a substring of text inserted by a previous edit (edit #${i + 1}). This usually means the edit is targeting code that was just added. Re-read the file and adjust.`,
            },
          };
        }
      }
    }

    const result = applyEdit(current, oldString, newString);

    if (!result.success) {
      return {
        success: false,
        content: current,
        appliedEdits: i,
        failedEdit: {
          index: i,
          error: result.error || "Unknown error",
        },
      };
    }

    current = result.content!;
    previousNewStrings.push(newString);
  }

  // Verify something actually changed
  if (current === content) {
    return {
      success: false,
      content: current,
      appliedEdits: edits.length,
      failedEdit: {
        index: -1,
        error: "All edits applied but file content unchanged. Check old_string/new_string values.",
      },
    };
  }

  return {
    success: true,
    content: current,
    appliedEdits: edits.length,
  };
}

// ===========================================
// CLOSE MATCH FINDER (hints for LLM retry)
// ===========================================

/**
 * Try to find a close match when all tiers fail.
 * Returns an actionable hint for the LLM to self-correct.
 */
export function findCloseMatch(
  content: string,
  search: string
): string | undefined {
  const lines = splitLines(content);

  // Strategy 1: Normalize all whitespace and compare single-line
  const normalizedSearch = search.replace(/\s+/g, " ").trim();
  for (let i = 0; i < lines.length; i++) {
    const normalizedLine = lines[i].replace(/\s+/g, " ").trim();
    if (
      normalizedLine.includes(normalizedSearch) ||
      normalizedSearch.includes(normalizedLine)
    ) {
      const contextStart = Math.max(0, i - 1);
      const contextEnd = Math.min(lines.length, i + 2);
      const context = lines.slice(contextStart, contextEnd).join("\n");
      return `Possible match at line ${i + 1} (whitespace may differ). Copy this EXACTLY:\n\`\`\`\n${context}\n\`\`\``;
    }
  }

  // Strategy 2: Match first line of search
  const firstSearchLine = splitLines(search)[0].trim();
  if (firstSearchLine.length > 10) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().includes(firstSearchLine)) {
        const searchLineCount = splitLines(search).length;
        const contextStart = Math.max(0, i - 1);
        const contextEnd = Math.min(lines.length, i + searchLineCount + 1);
        const context = lines.slice(contextStart, contextEnd).join("\n");
        return `First line found at line ${i + 1}. The full block around it:\n\`\`\`\n${context}\n\`\`\`\nCopy the exact text from above.`;
      }
    }
  }

  // Strategy 3: Check if search text exists but with different quotes
  const straightSearch = normalizeQuotes(search);
  if (straightSearch !== search) {
    const pos = content.indexOf(straightSearch);
    if (pos !== -1) {
      const line = getLineNumber(content, pos);
      return `Match found at line ${line} but with different quote characters. Use straight quotes (' and ") instead of curly/smart quotes.`;
    }
  }

  return undefined;
}

// ===========================================
// VALIDATION
// ===========================================

/**
 * Validate that an edit won't break the file.
 * Basic syntax checks for common file types.
 */
export function validateEdit(
  newContent: string,
  filePath: string
): { valid: boolean; error?: string } {
  const ext = filePath.split(".").pop()?.toLowerCase();

  // Check for balanced brackets/braces (basic check)
  // Only for JS/TS/JSON — Python uses parens in docstrings/comments which causes false positives
  if (["ts", "tsx", "js", "jsx", "json"].includes(ext || "")) {
    const openBraces = (newContent.match(/\{/g) || []).length;
    const closeBraces = (newContent.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      return {
        valid: false,
        error: `Unbalanced braces: ${openBraces} opening, ${closeBraces} closing`,
      };
    }

    const openParens = (newContent.match(/\(/g) || []).length;
    const closeParens = (newContent.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return {
        valid: false,
        error: `Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`,
      };
    }

    const openBrackets = (newContent.match(/\[/g) || []).length;
    const closeBrackets = (newContent.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return {
        valid: false,
        error: `Unbalanced brackets: ${openBrackets} opening, ${closeBrackets} closing`,
      };
    }
  }

  // JSON-specific validation
  if (ext === "json") {
    try {
      JSON.parse(newContent);
    } catch (e) {
      return {
        valid: false,
        error: `Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`,
      };
    }
  }

  return { valid: true };
}
