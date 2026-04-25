"use client";

import { useState } from "react";

interface FileItem {
  id: string;
  path: string;
  language: string | null;
  size: number | null;
  summary: string | null;
}

interface FileListProps {
  files: FileItem[];
  totalCount: number;
}

export function FileList({ files, totalCount }: FileListProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getLanguageColor = (language: string | null) => {
    const colors: Record<string, string> = {
      TypeScript: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      JavaScript: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      Python: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      Go: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
      Rust: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      Java: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      "C++": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      C: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    };
    return colors[language || ""] || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
  };

  return (
    <div>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {files.map((file) => (
          <li key={file.id} className="p-4">
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -m-4 p-4 rounded"
              onClick={() =>
                setExpandedFile(expandedFile === file.id ? null : file.id)
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedFile === file.id ? "rotate-90" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span className="font-mono text-sm text-gray-900 dark:text-white truncate">
                  {file.path}
                </span>
                {file.language && (
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${getLanguageColor(
                      file.language
                    )}`}
                  >
                    {file.language}
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-4">
                {formatSize(file.size)}
              </span>
            </div>

            {expandedFile === file.id && file.summary && (
              <div className="mt-4 ml-7 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                  AI Summary
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {file.summary}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {totalCount > files.length && (
        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          Showing {files.length} of {totalCount} files
        </div>
      )}
    </div>
  );
}
