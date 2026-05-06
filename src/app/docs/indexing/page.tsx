import { PageHeader, H2, H3, P, Code, Callout, StepList, BulletList, NextPage } from "../components";

export default function IndexingPage() {
  return (
    <>
      <PageHeader title="Code Indexing" description="How Codeteel reads, understands, and indexes your codebase." />

      <H2>How it works</H2>
      <StepList steps={[
        { title: "Fetch file list", description: "Codeteel fetches your repository tree from GitHub and filters files (30+ languages supported)." },
        { title: "Generate summaries", description: "Each file is sent to your LLM. It generates a concise summary — what the file does, key functions, and notable patterns." },
        { title: "Create embeddings", description: "The summary is converted to a 1536-dimension vector using your embedding provider. This enables semantic search." },
        { title: "Store results", description: "File content, summary, and embedding are saved to the database. Your codebase is now searchable." },
      ]} />

      <H2>Progress & controls</H2>
      <P>Indexing runs in your browser — you see real-time progress with file count, percentage bar, and the current file being processed. You can:</P>
      <BulletList items={[
        <><strong>Pause/Resume</strong> — stop indexing and continue later from where you left off</>,
        <><strong>Start Fresh</strong> — re-index all files (ignores previous progress)</>,
        <><strong>Cancel</strong> — stop indexing entirely</>,
      ]} />
      <Callout type="warning">
        Don{"'"}t close the browser tab during indexing — progress is driven by the browser.
      </Callout>

      <H2>Large file handling</H2>
      <P>Files over 2,000 lines or 8,000 characters are automatically chunked:</P>
      <BulletList items={[
        "Chunk size: 500 lines (50-line overlap) or 6,000 chars (500-char overlap)",
        "Each chunk is summarized separately",
        "Chunk summaries are combined with a final LLM call",
      ]} />

      <H2>Supported languages</H2>
      <P>JavaScript, TypeScript, Python, Go, Rust, Java, Kotlin, C/C++, C#, Ruby, PHP, Swift, Scala, Shell, Vue, Svelte, Astro, SQL, GraphQL, YAML, TOML, Terraform, HCL, Docker, Makefile, Markdown, and JSON config files.</P>

      <H2>What gets skipped</H2>
      <P>Lock files (<Code>package-lock.json</Code>, <Code>yarn.lock</Code>), build directories (<Code>dist/</Code>, <Code>build/</Code>), <Code>node_modules</Code>, minified files (<Code>*.min.js</Code>), type definitions (<Code>*.d.ts</Code>), source maps, binary assets, <Code>.env</Code> files, and anything over 100KB.</P>

      <H2>Re-indexing</H2>
      <P>Codeteel tracks content hashes — unchanged files are skipped on re-index. GitHub webhooks can detect pushes and PR merges to flag files that need re-indexing.</P>

      <NextPage href="/docs/chat" label="Web Chat" />
    </>
  );
}
