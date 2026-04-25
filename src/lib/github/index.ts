// GitHub API utilities

interface GitHubFile {
  path: string;
  type: "file" | "dir";
  size: number;
  sha: string;
  url: string;
  download_url: string | null;
}

interface RepoTree {
  sha: string;
  tree: {
    path: string;
    mode: string;
    type: "blob" | "tree";
    sha: string;
    size?: number;
    url: string;
  }[];
  truncated: boolean;
}

// File extensions to index (focused on actual code, not config)
const INDEXABLE_EXTENSIONS = new Set([
  // JavaScript/TypeScript
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  // Python
  ".py", ".pyw",
  // Go
  ".go",
  // Rust
  ".rs",
  // Java/Kotlin
  ".java", ".kt", ".kts",
  // C/C++
  ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx",
  // C#
  ".cs",
  // Ruby
  ".rb", ".rake",
  // PHP
  ".php",
  // Swift
  ".swift",
  // Scala
  ".scala",
  // Shell
  ".sh", ".bash", ".zsh",
  // Web (code only, not pure markup)
  ".vue", ".svelte", ".astro",
  // SQL/Database
  ".sql",
  // GraphQL
  ".graphql", ".gql",
  // Elixir/Erlang
  ".ex", ".exs", ".erl",
  // Haskell
  ".hs",
  // Lua
  ".lua",
  // R
  ".r", ".R",
  // Dart/Flutter
  ".dart",
  // Clojure
  ".clj", ".cljs", ".cljc",
  // Markdown (for documentation understanding)
  ".md", ".mdx",
  // Config/Infrastructure (important for understanding deployment)
  ".yaml", ".yml",  // Docker Compose, K8s, CI/CD, Ansible
  ".toml",          // Cargo.toml, pyproject.toml
  ".json",          // package.json, schemas (lock files excluded in SKIP_FILES)
  // Infrastructure as Code
  ".tf", ".tfvars", // Terraform
  ".hcl",           // HashiCorp config
  // Docker
  "Dockerfile",     // Will be handled by filename check
]);

// Note: Excluded from indexing:
// - .html, .css, .scss (pure markup/styling - usually not code logic)
// - .xml (verbose, usually config/data)
// - Lock files (package-lock.json, yarn.lock, etc.) - in SKIP_FILES

// Directories to skip
const SKIP_DIRECTORIES = new Set([
  // Version control
  ".git", ".svn", ".hg",
  // Dependencies
  "node_modules", "vendor", "bower_components",
  // Python
  "__pycache__", ".pytest_cache", ".mypy_cache", ".tox",
  "venv", ".venv", "env", ".env", "virtualenv",
  "eggs", ".eggs", "*.egg-info", "site-packages",
  // JavaScript/TypeScript builds
  "dist", "build", "out", "output", ".next", ".nuxt", ".svelte-kit",
  ".turbo", ".parcel-cache", ".cache", ".temp", ".tmp",
  // Java/Kotlin/Scala
  "target", ".gradle", ".mvn", "out",
  // C#/.NET
  "bin", "obj", "packages",
  // Rust
  ".cargo",
  // Go
  "pkg",
  // Ruby
  ".bundle",
  // IDE/Editor
  ".idea", ".vscode", ".vs", ".eclipse",
  // Testing
  "coverage", "__snapshots__", ".nyc_output",
  // Infrastructure
  ".terraform", ".serverless",
  // Logs and temp
  "logs", ".logs", "tmp", "temp",
  // Static assets (usually images/fonts)
  "assets", "static", "public", "images", "img", "fonts",
  // Documentation builds
  "_site", ".docusaurus", "docs/_build",
  // Misc
  ".husky", ".github", ".circleci", ".gitlab",
]);

// Specific files to skip (exact match or pattern)
const SKIP_FILES = new Set([
  // Lock files (large, auto-generated)
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "composer.lock",
  "Gemfile.lock",
  "Cargo.lock",
  "poetry.lock",
  "Pipfile.lock",
  "packages.lock.json",
  "go.sum",
  // Config files (not useful for code understanding)
  ".gitignore",
  ".gitattributes",
  ".npmignore",
  ".dockerignore",
  ".editorconfig",
  ".prettierrc",
  ".prettierignore",
  ".eslintignore",
  ".stylelintrc",
  "tsconfig.json",
  "jsconfig.json",
  "babel.config.js",
  "babel.config.json",
  ".babelrc",
  "webpack.config.js",
  "vite.config.js",
  "vite.config.ts",
  "rollup.config.js",
  "postcss.config.js",
  "tailwind.config.js",
  "tailwind.config.ts",
  "jest.config.js",
  "jest.config.ts",
  "vitest.config.ts",
  ".env",
  ".env.local",
  ".env.example",
  ".env.development",
  ".env.production",
  // Auto-generated
  "CHANGELOG.md",
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
]);

// Max file size to index (100KB)
const MAX_FILE_SIZE = 100 * 1024;

export function shouldIndexFile(path: string, size?: number): boolean {
  // Check size
  if (size && size > MAX_FILE_SIZE) {
    return false;
  }

  // Check if in skipped directory
  const parts = path.split("/");
  for (const part of parts) {
    if (SKIP_DIRECTORIES.has(part)) {
      return false;
    }
  }

  // Check filename (exact match)
  const filename = parts[parts.length - 1];
  if (SKIP_FILES.has(filename)) {
    return false;
  }

  // Skip minified/bundled files
  if (filename.includes(".min.") || filename.includes(".bundle.") || filename.includes(".chunk.")) {
    return false;
  }

  // Skip source maps
  if (filename.endsWith(".map")) {
    return false;
  }

  // Skip declaration files (TypeScript .d.ts) - usually auto-generated
  if (filename.endsWith(".d.ts")) {
    return false;
  }

  // Special files without extensions
  const SPECIAL_FILES = new Set([
    "Dockerfile",
    "Makefile",
    "Rakefile",
    "Gemfile",
    "Procfile",
    "Vagrantfile",
  ]);
  if (SPECIAL_FILES.has(filename)) {
    return true;
  }

  // Check extension
  const ext = "." + path.split(".").pop()?.toLowerCase();
  return INDEXABLE_EXTENSIONS.has(ext);
}

export async function getRepoTree(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string = "main"
): Promise<RepoTree> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function getFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<string> {
  const url = new URL(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
  );
  if (ref) {
    url.searchParams.set("ref", ref);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3.raw",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  return response.text();
}

export function getLanguageFromPath(path: string): string | null {
  const filename = path.split("/").pop() || "";
  const ext = path.split(".").pop()?.toLowerCase();

  // Special files without extensions
  const specialFiles: Record<string, string> = {
    Dockerfile: "Docker",
    Makefile: "Makefile",
    Rakefile: "Ruby",
    Gemfile: "Ruby",
    Procfile: "Procfile",
    Vagrantfile: "Ruby",
  };
  if (specialFiles[filename]) {
    return specialFiles[filename];
  }

  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: "JavaScript",
    jsx: "JavaScript",
    ts: "TypeScript",
    tsx: "TypeScript",
    mjs: "JavaScript",
    cjs: "JavaScript",
    // Python
    py: "Python",
    pyw: "Python",
    // Go
    go: "Go",
    // Rust
    rs: "Rust",
    // Java/Kotlin
    java: "Java",
    kt: "Kotlin",
    kts: "Kotlin",
    // C/C++
    c: "C",
    cpp: "C++",
    cc: "C++",
    cxx: "C++",
    h: "C",
    hpp: "C++",
    hxx: "C++",
    // C#
    cs: "C#",
    // Ruby
    rb: "Ruby",
    rake: "Ruby",
    // PHP
    php: "PHP",
    // Swift
    swift: "Swift",
    // Scala
    scala: "Scala",
    // Shell
    sh: "Shell",
    bash: "Shell",
    zsh: "Shell",
    // SQL
    sql: "SQL",
    // GraphQL
    graphql: "GraphQL",
    gql: "GraphQL",
    // Config/Data
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    toml: "TOML",
    // Markdown
    md: "Markdown",
    mdx: "MDX",
    // Frontend frameworks
    vue: "Vue",
    svelte: "Svelte",
    astro: "Astro",
    // Infrastructure
    tf: "Terraform",
    tfvars: "Terraform",
    hcl: "HCL",
    // Other languages
    ex: "Elixir",
    exs: "Elixir",
    erl: "Erlang",
    hs: "Haskell",
    lua: "Lua",
    r: "R",
    dart: "Dart",
    clj: "Clojure",
    cljs: "ClojureScript",
    cljc: "Clojure",
  };

  return ext ? languageMap[ext] || null : null;
}

// ===========================================
// CHANGE DETECTION (Webhooks + Compare API)
// ===========================================

export interface ChangedFile {
  path: string;
  status: "added" | "modified" | "removed" | "renamed";
  previous_filename?: string;
}

// Compare two commits/refs and return changed files
export async function compareCommits(
  accessToken: string,
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<{ files: ChangedFile[]; ahead_by: number; behind_by: number; head_sha: string }> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub compare failed: ${response.status} - ${error}`);
  }

  const data = await response.json();

  const files: ChangedFile[] = (data.files || []).map(
    (f: { filename: string; status: string; previous_filename?: string }) => ({
      path: f.filename,
      status: f.status as ChangedFile["status"],
      previous_filename: f.previous_filename,
    })
  );

  return {
    files,
    ahead_by: data.ahead_by || 0,
    behind_by: data.behind_by || 0,
    head_sha: data.commits?.length > 0
      ? data.commits[data.commits.length - 1].sha
      : head,
  };
}

// Get the latest commit SHA for a branch
export async function getBranchHeadSha(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get branch HEAD: ${response.status}`);
  }

  const data = await response.json();
  return data.object.sha;
}

// Register a push webhook on a repository
export async function registerWebhook(
  accessToken: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string
): Promise<number> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/hooks`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: {
          url: webhookUrl,
          content_type: "json",
          secret,
        },
        events: ["push"],
        active: true,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to register webhook: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.id; // webhook ID for later deletion
}

// Delete a webhook from a repository
export async function deleteWebhook(
  accessToken: string,
  owner: string,
  repo: string,
  webhookId: number
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/hooks/${webhookId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  // 204 = success, 404 = already deleted — both fine
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete webhook: ${response.status}`);
  }
}
