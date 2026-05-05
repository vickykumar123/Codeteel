"use client";

import Link from "next/link";

interface SlackInstallation {
  id: string;
  team_id: string;
  team_name: string | null;
  installed_at: string;
}

interface IntegrationsProps {
  slackInstallations: SlackInstallation[];
}

export function Integrations({ slackInstallations }: IntegrationsProps) {
  const hasSlack = slackInstallations.length > 0;

  return (
    <div className="p-6 space-y-4">
      {/* Slack */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-[#292524] rounded-xl hover:border-[#3F3F46] transition-all">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#4A154B] rounded-xl flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
          </div>
          <div>
            <div className="font-medium text-[#FAFAF9] text-sm">Slack</div>
            {hasSlack ? (
              <div className="text-xs text-green-400 flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Connected — {slackInstallations[0].team_name || slackInstallations[0].team_id}
              </div>
            ) : (
              <div className="text-xs text-[#44403C] mt-0.5">Not connected</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/docs/slack"
            className="text-xs px-3 py-1.5 bg-[#292524] text-[#A8A29E] border border-[#3F3F46] rounded-lg hover:bg-[#3F3F46] hover:text-[#FAFAF9] transition-all"
          >
            Docs
          </Link>
          {hasSlack ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#44403C]">
                {new Date(slackInstallations[0].installed_at).toISOString().split("T")[0]}
              </span>
              <a
                href="/api/slack/oauth"
                className="text-xs px-3 py-1.5 bg-[#292524] text-[#A8A29E] border border-[#3F3F46] rounded-lg hover:bg-[#3F3F46] hover:text-[#FAFAF9] transition-all"
              >
                Reinstall
              </a>
            </div>
          ) : (
            <a
              href="/api/slack/oauth"
              className="text-xs px-3 py-1.5 bg-[#4A154B] text-white rounded-lg hover:bg-[#3a1039] transition-colors font-medium"
            >
              Add to Slack
            </a>
          )}
        </div>
      </div>

      {hasSlack && (
        <div className="text-xs text-[#A8A29E] p-3 bg-[#E8A87C]/5 border border-[#E8A87C]/20 rounded-xl">
          <span className="font-medium text-[#E8A87C]">Next:</span> Go to a Slack channel and type <code className="bg-[#292524] px-1 rounded text-[#E8A87C]">/codeteel connect owner/repo</code> to link it.
        </div>
      )}

      {/* Telegram */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-[#292524] rounded-xl hover:border-[#3F3F46] transition-all">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#0088cc] rounded-xl flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </div>
          <div>
            <div className="font-medium text-[#FAFAF9] text-sm">Telegram</div>
            <div className="text-xs text-[#44403C] mt-0.5">Connect from any repo page</div>
          </div>
        </div>

        <Link
          href="/docs/telegram"
          className="text-xs px-3 py-1.5 bg-[#292524] text-[#A8A29E] border border-[#3F3F46] rounded-lg hover:bg-[#3F3F46] hover:text-[#FAFAF9] transition-all"
        >
          Docs
        </Link>
      </div>

      {/* Discord */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-[#292524] rounded-xl hover:border-[#3F3F46] transition-all">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#5865F2] rounded-xl flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
            </svg>
          </div>
          <div>
            <div className="font-medium text-[#FAFAF9] text-sm">Discord</div>
            <div className="text-xs text-[#44403C] mt-0.5">Add bot to server, then connect from repo page</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/docs/discord"
            className="text-xs px-3 py-1.5 bg-[#292524] text-[#A8A29E] border border-[#3F3F46] rounded-lg hover:bg-[#3F3F46] hover:text-[#FAFAF9] transition-all"
          >
            Docs
          </Link>
          {process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ? (
            <a
              href={`https://discord.com/api/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=51200&scope=bot%20applications.commands`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752C4] transition-colors font-medium"
            >
              Add to Discord
            </a>
          ) : (
            <a
              href="/api/discord/oauth"
              className="text-xs px-3 py-1.5 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752C4] transition-colors font-medium"
            >
              Add to Discord
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
