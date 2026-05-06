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

export function PlatformConnect({ repoId, repoFullName, connections, slackInstalled }: PlatformConnectProps) {
  const slackConnection = connections.find(c => c.platform === "slack");
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const disconnectPlatform = async (connectionId: string) => {
    setDisconnecting(true);
    try {
      const response = await fetch(`/api/repos/${repoId}/platform`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (!response.ok) throw new Error("Failed to disconnect");
      setMessage({ type: "success", text: "Disconnected" });
      window.location.reload();
    } catch {
      setMessage({ type: "error", text: "Failed to disconnect" });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="bg-[#1C1917] border border-[#292524] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#292524] flex items-center gap-3">
        <div className="w-8 h-8 bg-[#292524] rounded-lg flex items-center justify-center text-[#E8A87C] flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-[#FAFAF9]">Platform Connections</h3>
      </div>

      <div className="p-4 space-y-2">
        {message && (
          <div className={`text-xs p-2.5 rounded-xl mb-2 ${message.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
            {message.text}
          </div>
        )}

        {/* Slack */}
        <PlatformRow
          icon={<SlackIcon />}
          bgColor="#4A154B"
          name="Slack"
          connected={!!slackConnection}
          detail={slackConnection ? `Channel: ${slackConnection.platform_channel_id}` : slackInstalled ? "Not linked" : "Not installed"}
          hint={slackInstalled && !slackConnection ? <span>Use <code className="bg-[#292524] px-1 rounded text-[#E8A87C] text-[10px]">/codeteel connect {repoFullName}</code></span> : undefined}
          actions={
            slackConnection ? (
              <button onClick={() => disconnectPlatform(slackConnection.id)} disabled={disconnecting}
                className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 disabled:opacity-50 transition-all">
                Disconnect
              </button>
            ) : !slackInstalled ? (
              <Link href="/settings" className="text-xs px-3 py-1.5 bg-[#292524] text-[#A8A29E] border border-[#3F3F46] rounded-lg hover:bg-[#3F3F46] hover:text-[#FAFAF9] transition-all">
                Setup
              </Link>
            ) : null
          }
        />

        {/* Telegram */}
        <TelegramConnect repoId={repoId} telegramConnection={connections.find(c => c.platform === "telegram")} onDisconnect={disconnectPlatform} />

        {/* Discord */}
        <DiscordConnect repoId={repoId} discordConnection={connections.find(c => c.platform === "discord")} onDisconnect={disconnectPlatform} />
      </div>
    </div>
  );
}

// ===========================================
// PLATFORM ROW
// ===========================================

function PlatformRow({ icon, bgColor, name, connected, detail, hint, actions }: {
  icon: React.ReactNode; bgColor: string; name: string; connected: boolean;
  detail: string; hint?: React.ReactNode; actions: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-3 border border-[#292524] rounded-xl hover:border-[#3F3F46] transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bgColor }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-[#FAFAF9]">{name}</div>
          {connected ? (
            <div className="text-xs text-green-400 flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
              <span className="truncate">{detail}</span>
            </div>
          ) : (
            <div className="text-xs text-[#44403C] mt-0.5">{detail}</div>
          )}
          {hint && <div className="text-[10px] text-[#44403C] mt-0.5">{hint}</div>}
        </div>
      </div>
      <div className="flex-shrink-0 ml-3">{actions}</div>
    </div>
  );
}

// ===========================================
// TELEGRAM CONNECT
// ===========================================

function TelegramConnect({ repoId, telegramConnection, onDisconnect }: { repoId: string; telegramConnection?: PlatformConnection; onDisconnect: (id: string) => void }) {
  const [connectLink, setConnectLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const generateLink = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/platform/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, platform: "telegram" }),
      });
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setConnectLink(data.link);
      setExpiresAt(data.expiresAt);
    } catch { /* ignore */ } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <PlatformRow
        icon={<TelegramIcon />}
        bgColor="#0088cc"
        name="Telegram"
        connected={!!telegramConnection}
        detail={telegramConnection ? `Chat: ${telegramConnection.platform_channel_id}` : "Not connected"}
        actions={
          telegramConnection ? (
            <button onClick={() => onDisconnect(telegramConnection.id)}
              className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all">
              Disconnect
            </button>
          ) : (
            <button onClick={generateLink} disabled={generating}
              className="text-xs px-3 py-1.5 bg-[#E8A87C]/10 text-[#E8A87C] border border-[#E8A87C]/20 rounded-lg hover:bg-[#E8A87C]/20 disabled:opacity-50 transition-all">
              {generating ? "..." : "Connect"}
            </button>
          )
        }
      />
      {connectLink && (
        <div className="ml-11 p-3 bg-[#E8A87C]/5 border border-[#E8A87C]/20 rounded-xl">
          <p className="text-xs text-[#A8A29E] mb-2">Open in Telegram (expires in 5 min):</p>
          <a href={connectLink} target="_blank" rel="noopener noreferrer" className="text-xs text-[#E8A87C] underline break-all">
            {connectLink}
          </a>
          {expiresAt && <p className="text-[10px] text-[#44403C] mt-1">Expires: {new Date(expiresAt).toLocaleTimeString()}</p>}
        </div>
      )}
    </>
  );
}

// ===========================================
// DISCORD CONNECT
// ===========================================

function DiscordConnect({ repoId, discordConnection, onDisconnect }: { repoId: string; discordConnection?: PlatformConnection; onDisconnect: (id: string) => void }) {
  const [connectLink, setConnectLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const generateLink = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/platform/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, platform: "discord" }),
      });
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setConnectLink(data.link);
      setExpiresAt(data.expiresAt);
    } catch { /* ignore */ } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <PlatformRow
        icon={<DiscordIcon />}
        bgColor="#5865F2"
        name="Discord"
        connected={!!discordConnection}
        detail={discordConnection ? `Channel: ${discordConnection.platform_channel_id}` : "Not connected"}
        actions={
          discordConnection ? (
            <button onClick={() => onDisconnect(discordConnection.id)}
              className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all">
              Disconnect
            </button>
          ) : (
            <button onClick={generateLink} disabled={generating}
              className="text-xs px-3 py-1.5 bg-[#E8A87C]/10 text-[#E8A87C] border border-[#E8A87C]/20 rounded-lg hover:bg-[#E8A87C]/20 disabled:opacity-50 transition-all">
              {generating ? "..." : "Connect"}
            </button>
          )
        }
      />
      {connectLink && (
        <div className="ml-11 space-y-2">
          <div className="p-3 bg-[#292524] border border-[#3F3F46] rounded-xl">
            <p className="text-[10px] text-[#44403C] mb-1.5">
              Step 1:{" "}
              <a
                href={`https://discord.com/api/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || ""}&permissions=51200&scope=bot%20applications.commands`}
                target="_blank" rel="noopener noreferrer" className="text-[#E8A87C] underline"
              >
                Add bot to your server
              </a>
            </p>
            <p className="text-[10px] text-[#44403C]">
              Step 2: Type <code className="bg-[#1C1917] px-1 rounded text-[#E8A87C]">/connect</code> in Discord and paste this token:
            </p>
          </div>
          <div className="p-3 bg-[#E8A87C]/5 border border-[#E8A87C]/20 rounded-xl flex items-center gap-2">
            <code className="flex-1 text-xs text-[#E8A87C] font-mono break-all select-all">
              {connectLink.split("start=")[1] || connectLink}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(connectLink.split("start=")[1] || connectLink)}
              className="text-[10px] px-2 py-1 bg-[#292524] text-[#A8A29E] border border-[#3F3F46] rounded-lg hover:bg-[#3F3F46] hover:text-[#FAFAF9] transition-all flex-shrink-0"
            >
              Copy
            </button>
          </div>
          {expiresAt && <p className="text-[10px] text-[#44403C] ml-1">Expires: {new Date(expiresAt).toLocaleTimeString()}</p>}
        </div>
      )}
    </>
  );
}

// ===========================================
// ICONS
// ===========================================

function SlackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-white" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-white" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-white" fill="currentColor">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
    </svg>
  );
}
