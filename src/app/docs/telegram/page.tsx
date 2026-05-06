import { PageHeader, H2, P, CodeBlock, StepList, Callout, ChatExample, NextPage } from "../components";

export default function TelegramPage() {
  return (
    <>
      <PageHeader title="Telegram Integration" description="Connect Codeteel to Telegram for mobile-friendly coding." />

      <H2>Setup</H2>
      <StepList steps={[
        { title: "Generate connect link", description: "On the repo page, click 'Connect Telegram'. A link is generated (valid for 5 minutes)." },
        { title: "Open in Telegram", description: "Click the link — it opens Telegram and starts a chat with @CodeteelBot." },
        { title: "Auto-connected", description: "The bot automatically links your chat to the repository. Start sending messages." },
      ]} />

      <H2>Commands</H2>
      <CodeBlock>{`/status                         # Show connection info
/branch feature/xyz             # Switch branch
/branch create feature/xyz      # Create and switch
/branches                       # List all branches
/reset                          # Clear working branch
/clear                          # Clear conversation history
/security                       # Full security scan
/security src/auth/             # Scoped scan
/security pr 5                  # PR diff scan
/help                           # Show all commands`}</CodeBlock>

      <P>Regular text messages are sent directly to the agent — no special command needed. Just type your question or request.</P>

      <H2>Usage example</H2>
      <ChatExample messages={[
        { role: "user", text: "What validators do we have?" },
        { role: "assistant", text: "Found 3 validator files:\n\n1. `src/validators/email.py` — email format validation\n2. `src/validators/phone.py` — phone number parsing\n3. `src/validators/address.py` — postal address validation\n\nEach uses Pydantic v2 validators..." },
      ]} />

      <H2>Approval</H2>
      <P>Plans show inline keyboard buttons below the message. Tap to approve or reject. Branch selection also uses inline buttons.</P>

      <Callout type="info">
        <strong>Connect link expires in 5 minutes.</strong> Generate a new one from the repo page if it expires. One Telegram chat = one repo.
      </Callout>

      <NextPage href="/docs/discord" label="Discord Guide" />
    </>
  );
}
