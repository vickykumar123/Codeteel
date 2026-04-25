import { NextResponse } from "next/server";
import { authenticateRepoRequest, isAuthError } from "@/lib/api/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/repos/[id]/commit - Batch commit multiple files in a single commit (Git Trees API)
export async function POST(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;
  const auth = await authenticateRepoRequest(repoId);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { branch, message, files } = body as {
    branch: string;
    message: string;
    files: { path: string; content: string | null }[];
  };

  if (!branch || !message || !files || files.length === 0) {
    return NextResponse.json(
      { error: "branch, message, and files[] required" },
      { status: 400 }
    );
  }

  const [owner, repo] = auth.repo.fullName.split("/");
  const ghHeaders = {
    Authorization: `Bearer ${auth.githubToken}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };

  try {
    // 1. Get the current branch ref → latest commit SHA
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
      { headers: ghHeaders }
    );
    if (!refRes.ok) {
      const err = await refRes.text();
      return NextResponse.json(
        { error: `Failed to get branch ref: ${err}` },
        { status: refRes.status }
      );
    }
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Get the base tree SHA from that commit
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`,
      { headers: ghHeaders }
    );
    if (!commitRes.ok) {
      const err = await commitRes.text();
      return NextResponse.json(
        { error: `Failed to get commit: ${err}` },
        { status: commitRes.status }
      );
    }
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Build tree entries for all file changes
    const treeEntries = files.map((file) => {
      if (file.content === null) {
        // Delete: set sha to null with mode "100644"
        return {
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: null,
        };
      }
      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        content: file.content,
      };
    });

    // 4. Create new tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries,
        }),
      }
    );
    if (!treeRes.ok) {
      const err = await treeRes.text();
      return NextResponse.json(
        { error: `Failed to create tree: ${err}` },
        { status: treeRes.status }
      );
    }
    const treeData = await treeRes.json();

    // 5. Create new commit
    const newCommitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          message,
          tree: treeData.sha,
          parents: [latestCommitSha],
        }),
      }
    );
    if (!newCommitRes.ok) {
      const err = await newCommitRes.text();
      return NextResponse.json(
        { error: `Failed to create commit: ${err}` },
        { status: newCommitRes.status }
      );
    }
    const newCommitData = await newCommitRes.json();

    // 6. Update branch ref to point to new commit
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        method: "PATCH",
        headers: ghHeaders,
        body: JSON.stringify({
          sha: newCommitData.sha,
          force: false,
        }),
      }
    );
    if (!updateRefRes.ok) {
      const err = await updateRefRes.text();
      return NextResponse.json(
        { error: `Failed to update branch: ${err}` },
        { status: updateRefRes.status }
      );
    }

    return NextResponse.json({
      commitSha: newCommitData.sha,
      filesChanged: files.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
