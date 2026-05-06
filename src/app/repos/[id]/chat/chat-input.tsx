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
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > 200 ? "auto" : "hidden";
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
      className="border-t border-[#1C1917] bg-[#0C0A09] p-4"
    >
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-3">
          {/* Command suggestions popup */}
          {showCommands && (
            <div
              ref={commandsRef}
              className="absolute bottom-full left-0 right-12 mb-2 max-h-64 overflow-y-auto rounded-xl border border-[#292524] bg-[#1C1917] shadow-xl shadow-black/30 z-10"
            >
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.name}
                  type="button"
                  data-command-item
                  onClick={() => selectCommand(cmd)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
                    i === selectedIndex
                      ? "bg-[#E8A87C]/10 text-[#E8A87C]"
                      : "text-[#A8A29E] hover:bg-[#292524] hover:text-[#FAFAF9]"
                  }`}
                >
                  <span className="font-mono font-medium shrink-0">
                    {cmd.name}
                    {cmd.args && (
                      <span className="text-[#71717A] font-normal"> {cmd.args}</span>
                    )}
                  </span>
                  <span className="text-[#71717A] truncate text-xs">
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
            className="flex-1 resize-none rounded-xl border border-[#292524] bg-[#1C1917] px-4 py-3 text-[#FAFAF9] placeholder-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#E8A87C]/40 focus:border-[#E8A87C]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          />

          {disabled ? (
            /* Stop button while running */
            <button
              type="button"
              onClick={onStop}
              title="Stop generating"
              className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-colors"
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
              className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] flex items-center justify-center hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
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
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="flex justify-between mt-2 text-xs text-[#71717A]">
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
