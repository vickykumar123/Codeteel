"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const MAX_CHARS = 10_000;

// ===========================================
// COMMAND DEFINITIONS
// ===========================================

const COMMANDS = [
  { name: "/help", description: "Show available commands" },
  { name: "/branch", description: "Switch branch or open selector", args: "[name]" },
  { name: "/branches", description: "List available branches" },
  { name: "/reset", description: "Clear execution state" },
  { name: "/clear", description: "Start a new conversation" },
  { name: "/security", description: "Security scan", args: "[path | pr N]" },
  { name: "/review", description: "Review a PR or list PRs", args: "pr [N]" },
  { name: "/compact", description: "Compress conversation" },
  { name: "/pr", description: "Create PR for changes" },
  { name: "/diff", description: "Show changed files" },
  { name: "/undo", description: "Revert last file change" },
];

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  placeholder?: string;
  onStop?: () => void;
}

export function ChatInput({ onSend, disabled, placeholder, onStop }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(COMMANDS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandsRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  // Filter commands as user types
  useEffect(() => {
    if (message.startsWith("/") && !message.includes(" ")) {
      const query = message.toLowerCase();
      const matches = COMMANDS.filter((cmd) => cmd.name.startsWith(query));
      setFilteredCommands(matches);
      setShowCommands(matches.length > 0);
      setSelectedIndex(0);
    } else {
      setShowCommands(false);
    }
  }, [message]);

  // Scroll selected item into view
  useEffect(() => {
    if (!showCommands || !commandsRef.current) return;
    const items = commandsRef.current.querySelectorAll("[data-command-item]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, showCommands]);

  const selectCommand = useCallback(
    (cmd: (typeof COMMANDS)[number]) => {
      setMessage(cmd.name + " ");
      setShowCommands(false);
      textareaRef.current?.focus();
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
      setShowCommands(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Command suggestion navigation
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        selectCommand(filteredCommands[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowCommands(false);
        return;
      }
    }

    // Normal Enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
    >
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-3">
          {/* Command suggestions popup */}
          {showCommands && (
            <div
              ref={commandsRef}
              className="absolute bottom-full left-0 mb-2 w-80 max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg z-10"
            >
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.name}
                  type="button"
                  data-command-item
                  onClick={() => selectCommand(cmd)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
                    i === selectedIndex
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                  }`}
                >
                  <span className="font-mono font-medium shrink-0">
                    {cmd.name}
                    {cmd.args && (
                      <span className="text-gray-400 dark:text-gray-500 font-normal"> {cmd.args}</span>
                    )}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 truncate text-xs">
                    {cmd.description}
                  </span>
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) {
                setMessage(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Type a message or / for commands..."}
            disabled={disabled}
            maxLength={MAX_CHARS}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {disabled ? (
            /* Stop button while running */
            <button
              type="button"
              onClick={onStop}
              title="Stop generating"
              className="flex-shrink-0 w-12 h-12 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            /* Send button */
            <button
              type="submit"
              disabled={!message.trim()}
              className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {disabled
              ? "Agent is working..."
              : "Press Enter to send, Shift+Enter for new line, / for commands"}
          </span>
          {!disabled && message.length > MAX_CHARS * 0.8 && (
            <span className={message.length >= MAX_CHARS ? "text-red-500" : ""}>
              {message.length.toLocaleString()}/{MAX_CHARS.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
