"use client";

import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Highlight, themes } from "prism-react-renderer";

interface FileItem {
  id: string;
  path: string;
  language: string | null;
  size: number | null;
  summary: string | null;
  code: string | null;
}

interface FileListProps {
  files: FileItem[];
  totalCount: number;
}

// ===========================================
// TREE BUILDER
// ===========================================

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
  file?: FileItem;
}

function buildTree(files: FileItem[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const pathSoFar = parts.slice(0, i + 1).join("/");

      let node = current.find((n) => n.name === name);
      if (!node) {
        node = {
          name,
          path: pathSoFar,
          isFolder: !isLast,
          children: [],
          file: isLast ? file : undefined,
        };
        current.push(node);
      }
      current = node.children;
    }
  }

  // Sort: folders first, then files, alphabetically
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(root);

  return root;
}

// ===========================================
// LANGUAGE COLORS
// ===========================================

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#DEA584",
  Java: "#B07219",
  "C++": "#F34B7D",
  C: "#555555",
  Ruby: "#CC342D",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Scala: "#DC322F",
  Shell: "#89E051",
  SQL: "#E38C00",
  Markdown: "#083FA1",
  YAML: "#CB171E",
  JSON: "#292929",
};

function getLangDot(language: string | null) {
  if (!language) return null;
  const color = LANG_COLORS[language] || "#A8A29E";
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />;
}

// ===========================================
// MARKDOWN COMPONENTS
// ===========================================

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="text-sm text-[#A8A29E] leading-relaxed mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="text-[#FAFAF9] font-medium">{children}</strong>,
  code: ({ children }: { children?: React.ReactNode }) => <code className="px-1 py-0.5 bg-[#292524] rounded text-xs text-[#E8A87C] font-mono">{children}</code>,
  pre: ({ children }: { children?: React.ReactNode }) => <pre className="bg-[#292524] rounded-lg p-3 my-2 overflow-x-auto text-xs">{children}</pre>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside text-sm text-[#A8A29E] space-y-0.5 mb-2">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside text-sm text-[#A8A29E] space-y-0.5 mb-2">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="text-sm text-[#A8A29E]">{children}</li>,
  h1: ({ children }: { children?: React.ReactNode }) => <h4 className="text-sm font-semibold text-[#FAFAF9] mb-1">{children}</h4>,
  h2: ({ children }: { children?: React.ReactNode }) => <h4 className="text-sm font-semibold text-[#FAFAF9] mb-1">{children}</h4>,
  h3: ({ children }: { children?: React.ReactNode }) => <h4 className="text-sm font-medium text-[#FAFAF9] mb-1">{children}</h4>,
};

// ===========================================
// MAIN COMPONENT
// ===========================================

export function FileList({ files, totalCount }: FileListProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filteredFiles = useMemo(() => {
    if (!search) return files;
    const q = search.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, search]);

  const tree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);

  const toggleFolder = (path: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      {/* Search */}
      <div className="px-6 py-3 border-b border-[#292524]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files..."
          className="w-full px-4 py-2 bg-[#0C0A09] border border-[#292524] rounded-xl text-[#FAFAF9] placeholder-[#44403C] text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A87C]/40 focus:border-[#E8A87C]/40 transition-all"
        />
      </div>

      {/* Tree */}
      <div className="px-4 py-2">
        {tree.length > 0 ? (
          tree.map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              expandedFile={expandedFile}
              setExpandedFile={setExpandedFile}
              collapsedFolders={collapsedFolders}
              toggleFolder={toggleFolder}
              formatSize={formatSize}
            />
          ))
        ) : (
          <div className="py-8 text-center text-sm text-[#44403C]">
            {search ? "No files match your search" : "No files"}
          </div>
        )}
      </div>

      {totalCount > files.length && (
        <div className="px-6 py-3 text-center text-xs text-[#44403C] border-t border-[#292524]">
          Showing {files.length} of {totalCount} files
        </div>
      )}
    </div>
  );
}

// ===========================================
// TREE ROW (recursive)
// ===========================================

function TreeRow({
  node,
  depth,
  expandedFile,
  setExpandedFile,
  collapsedFolders,
  toggleFolder,
  formatSize,
}: {
  node: TreeNode;
  depth: number;
  expandedFile: string | null;
  setExpandedFile: (id: string | null) => void;
  collapsedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  formatSize: (bytes: number | null) => string;
}) {
  const isCollapsed = collapsedFolders.has(node.path);
  const isExpanded = expandedFile === node.file?.id;
  const paddingLeft = depth * 20 + 12;

  if (node.isFolder) {
    return (
      <>
        <button
          onClick={() => toggleFolder(node.path)}
          className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-[#1C1917] rounded-lg transition-colors group cursor-pointer"
          style={{ paddingLeft }}
        >
          <svg
            className={`w-3.5 h-3.5 text-[#44403C] transition-transform ${isCollapsed ? "" : "rotate-90"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4 text-[#E8A87C]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            )}
          </svg>
          <span className="text-sm text-[#FAFAF9] font-medium">{node.name}</span>
          <span className="text-[10px] text-[#44403C] ml-1">{node.children.length}</span>
        </button>
        {!isCollapsed &&
          node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedFile={expandedFile}
              setExpandedFile={setExpandedFile}
              collapsedFolders={collapsedFolders}
              toggleFolder={toggleFolder}
              formatSize={formatSize}
            />
          ))}
      </>
    );
  }

  // File node
  return (
    <>
      <button
        onClick={() => setExpandedFile(isExpanded ? null : node.file!.id)}
        className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-[#1C1917] rounded-lg transition-colors group cursor-pointer"
        style={{ paddingLeft }}
      >
        {/* File icon */}
        <svg className="w-4 h-4 text-[#44403C] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <span className="text-sm text-[#A8A29E] font-mono truncate group-hover:text-[#FAFAF9] transition-colors">
          {node.name}
        </span>
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          {node.file?.language && (
            <span className="flex items-center gap-1">
              {getLangDot(node.file.language)}
              <span className="text-[10px] text-[#44403C]">{node.file.language}</span>
            </span>
          )}
          {node.file?.size && (
            <span className="text-[10px] text-[#44403C]">{formatSize(node.file.size)}</span>
          )}
          {node.file?.summary && (
            <svg
              className={`w-3.5 h-3.5 text-[#44403C] transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded panel: Summary + Code split */}
      {isExpanded && (node.file?.summary || node.file?.code) && (
        <ExpandedFilePanel
          file={node.file!}
          marginLeft={paddingLeft + 24}
        />
      )}
    </>
  );
}

// ===========================================
// EXPANDED FILE PANEL (Summary + Code split)
// ===========================================

// Map file language to Prism language identifier
const PRISM_LANG_MAP: Record<string, string> = {
  TypeScript: "typescript", JavaScript: "javascript", Python: "python",
  Go: "go", Rust: "rust", Java: "java", Kotlin: "kotlin",
  "C++": "cpp", C: "c", "C#": "csharp", Ruby: "ruby",
  PHP: "php", Swift: "swift", Scala: "scala", Shell: "bash",
  SQL: "sql", YAML: "yaml", JSON: "json", Markdown: "markdown",
  HTML: "html", CSS: "css", Dockerfile: "docker", Makefile: "makefile",
  GraphQL: "graphql", TOML: "toml",
};

function ExpandedFilePanel({ file, marginLeft }: { file: FileItem; marginLeft: number }) {
  const [activeTab, setActiveTab] = useState<"summary" | "code">(file.summary ? "summary" : "code");
  const lineCount = file.code ? file.code.split("\n").length : 0;
  const prismLang = PRISM_LANG_MAP[file.language || ""] || "typescript";

  return (
    <div
      className="mb-2 bg-[#0C0A09] border border-[#292524] rounded-xl overflow-hidden"
      style={{ marginLeft }}
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#292524] bg-[#1C1917]">
        {file.summary && (
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === "summary"
                ? "bg-[#E8A87C]/10 text-[#E8A87C]"
                : "text-[#71717A] hover:text-[#A8A29E]"
            }`}
          >
            AI Summary
          </button>
        )}
        {file.code && (
          <button
            onClick={() => setActiveTab("code")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === "code"
                ? "bg-[#E8A87C]/10 text-[#E8A87C]"
                : "text-[#71717A] hover:text-[#A8A29E]"
            }`}
          >
            Code
          </button>
        )}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-[#71717A]">
          {file.language && <span>{file.language}</span>}
          {lineCount > 0 && <span>{lineCount} lines</span>}
        </div>
      </div>

      {/* Content */}
      {activeTab === "summary" && file.summary && (
        <div className="p-4">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents as Record<string, React.ComponentType>}
          >
            {file.summary}
          </ReactMarkdown>
        </div>
      )}

      {activeTab === "code" && file.code && (
        <Highlight theme={themes.oneDark} code={file.code} language={prismLang}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs font-mono">
                <tbody>
                  {tokens.map((line, i) => (
                    <tr key={i} {...getLineProps({ line })} className="hover:bg-[#1C1917]">
                      <td className="px-3 py-0 text-right text-[#3F3F46] select-none w-10 sticky left-0 bg-[#0C0A09]">
                        {i + 1}
                      </td>
                      <td className="px-3 py-0 whitespace-pre">
                        {line.map((token, j) => (
                          <span key={j} {...getTokenProps({ token })} />
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Highlight>
      )}
    </div>
  );
}
