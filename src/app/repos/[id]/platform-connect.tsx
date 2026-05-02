"use client";

import { useState } from "react";
import Link from "next/link";

interface PlatformConnection {
  id: string;
  platform: string;
  platform_channel_id: string;
  platform_team_id: string | null;
}

interface PlatformConnectProps {
  repoId: string;
  repoFullName: string;
  connections: PlatformConnection[];
  slackInstalled: boolean;
}

export function PlatformConnect({
  repoId,
  repoFullName,
  connections,
  slackInstalled,
}: PlatformConnectProps) {
  const slackConnection = connections.find(c => c.platform === "slack");
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const disconnectSlack = async () => {
    if (!slackConnection) return;
    setDisconnecting(true);
    try {
      const response = await fetch(`/api/repos/${repoId}/platform`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: slackConnection.id }),
      });
      if (!response.ok) throw new Error("Failed to disconnect");
      setMessage({ type: "success", text: "Slack channel disconnected" });
      // Reload to refresh connections
      window.location.reload();
    } catch {
      setMessage({ type: "error", text: "Failed to disconnect" });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Platform Connections
      </h3>

      {message && (
        <div className={`text-sm p-3 rounded-lg mb-4 ${message.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
          {message.text}
        </div>
      )}

      {/* Slack */}
      <div className="flex items-center justify-between p-4 border rounded-lg border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#4A154B] rounded flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">Slack</div>
            {slackConnection ? (
              <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Connected — Channel: {slackConnection.platform_channel_id}
              </div>
            ) : slackInstalled ? (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Not linked — use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/codeteel connect {repoFullName}</code> in Slack
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Not installed
              </div>
            )}
          </div>
        </div>

        <div>
          {slackConnection ? (
            <button
              onClick={disconnectSlack}
              disabled={disconnecting}
              className="text-xs px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded hover:bg-red-200 disabled:opacity-50"
            >
              {disconnecting ? "..." : "Disconnect"}
            </button>
          ) : !slackInstalled ? (
            <Link
              href="/settings"
              className="text-xs px-3 py-1 bg-[#4A154B] text-white rounded hover:bg-[#3a1039]"
            >
              Setup in Settings
            </Link>
          ) : null}
        </div>
      </div>

      {/* Telegram */}
      <TelegramConnect repoId={repoId} telegramConnection={connections.find(c => c.platform === "telegram")} />
    </div>
  );
}

// ===========================================
// TELEGRAM CONNECT
// ===========================================

function TelegramConnect({ repoId, telegramConnection }: { repoId: string; telegramConnection?: PlatformConnection }) {
  const [connectLink, setConnectLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [tgMessage, setTgMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const generateLink = async () => {
    setGenerating(true);
    setTgMessage(null);
    try {
      const response = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId }),
      });
      if (!response.ok) throw new Error("Failed to generate link");
      const data = await response.json();
      setConnectLink(data.link);
      setExpiresAt(data.expiresAt);
    } catch {
      setTgMessage({ type: "error", text: "Failed to generate connect link" });
    } finally {
      setGenerating(false);
    }
  };

  const disconnectTelegram = async () => {
    if (!telegramConnection) return;
    try {
      await fetch(`/api/repos/${repoId}/platform`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: telegramConnection.id }),
      });
      window.location.reload();
    } catch {
      setTgMessage({ type: "error", text: "Failed to disconnect" });
    }
  };

  return (
    <div className="mt-3">
      {tgMessage && (
        <div className={`text-sm p-2 rounded mb-2 ${tgMessage.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
          {tgMessage.text}
        </div>
      )}

      <div className="flex items-center justify-between p-4 border rounded-lg border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0088cc] rounded flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">Telegram</div>
            {telegramConnection ? (
              <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Connected — Chat: {telegramConnection.platform_channel_id}
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">Not connected</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {telegramConnection ? (
            <button
              onClick={disconnectTelegram}
              className="text-xs px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded hover:bg-red-200"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={generateLink}
              disabled={generating}
              className="text-xs px-3 py-1 bg-[#0088cc] text-white rounded hover:bg-[#006fa3] disabled:opacity-50"
            >
              {generating ? "Generating..." : "Connect Telegram"}
            </button>
          )}
        </div>
      </div>

      {connectLink && (
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
            Open this link in Telegram (expires in 5 minutes):
          </p>
          <a
            href={connectLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-300 underline break-all"
          >
            {connectLink}
          </a>
          {expiresAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Expires: {new Date(expiresAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
