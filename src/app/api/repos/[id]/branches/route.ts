import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/client";
import { createServerSupabaseClient } from "@/lib/db/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Protected branches that cannot be selected as working branch
const PROTECTED_BRANCHES = ["main", "master"];

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
  protected: boolean;
}

interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
  aheadBy?: number;
}

// GET /api/repos/[id]/branches - List branches
export async function GET(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Get repository and user's GitHub token
  const { data: repo, error: repoError } = await adminClient
    .from("repositories")
    .select("id, full_name, default_branch")
    .eq("id", repoId)
    .eq("user_id", user.id)
    .single();

  if (repoError || !repo) {
    return NextResponse.json(
      { error: "Repository not found" },
      { status: 404 }
    );
  }

  // Get user's GitHub token
  const { data: userProfile } = await adminClient
    .from("users")
    .select("github_access_token")
    .eq("id", user.id)
    .single();

  if (!userProfile?.github_access_token) {
    return NextResponse.json(
      { error: "GitHub not connected" },
      { status: 400 }
    );
  }

  const [owner, repoName] = repo.full_name.split("/");

  try {
    // Fetch branches from GitHub
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/branches?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${userProfile.github_access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch branches: ${error}` },
        { status: response.status }
      );
    }

    const githubBranches: GitHubBranch[] = await response.json();

    // Get default branch SHA for comparing ahead/behind
    const defaultBranch = repo.default_branch || "main";
    const defaultBranchData = githubBranches.find(
      (b) => b.name === defaultBranch
    );
    const defaultSha = defaultBranchData?.commit.sha;

    // Map to our format and mark protected branches
    const branches: BranchInfo[] = await Promise.all(
      githubBranches.map(async (branch) => {
        const isProtected =
          PROTECTED_BRANCHES.includes(branch.name) || branch.protected;

        let aheadBy: number | undefined;

        // Get ahead count for non-default branches
        if (defaultSha && branch.name !== defaultBranch) {
          try {
            const compareResponse = await fetch(
              `https://api.github.com/repos/${owner}/${repoName}/compare/${defaultBranch}...${branch.name}`,
              {
                headers: {
                  Authorization: `Bearer ${userProfile.github_access_token}`,
                  Accept: "application/vnd.github.v3+json",
                },
              }
            );

            if (compareResponse.ok) {
              const compareData = await compareResponse.json();
              aheadBy = compareData.ahead_by;
            }
          } catch {
            // Ignore comparison errors
          }
        }

        return {
          name: branch.name,
          sha: branch.commit.sha,
          protected: isProtected,
          aheadBy,
        };
      })
    );

    // Sort: non-protected first, then by name
    branches.sort((a, b) => {
      if (a.protected !== b.protected) {
        return a.protected ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      branches,
      defaultBranch,
      protectedBranches: PROTECTED_BRANCHES,
    });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { error: "Failed to fetch branches" },
      { status: 500 }
    );
  }
}

// POST /api/repos/[id]/branches - Create a new branch
export async function POST(request: Request, { params }: RouteParams) {
  const { id: repoId } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Parse request body
  const body = await request.json();
  const { name, baseBranch } = body as {
    name: string;
    baseBranch?: string;
  };

  if (!name) {
    return NextResponse.json(
      { error: "Branch name is required" },
      { status: 400 }
    );
  }

  // Validate branch name (no spaces, special chars)
  const branchNameRegex = /^[a-zA-Z0-9._/-]+$/;
  if (!branchNameRegex.test(name)) {
    return NextResponse.json(
      { error: "Invalid branch name. Use only letters, numbers, ., _, /, -" },
      { status: 400 }
    );
  }

  // Get repository and user's GitHub token
  const { data: repo, error: repoError } = await adminClient
    .from("repositories")
    .select("id, full_name, default_branch")
    .eq("id", repoId)
    .eq("user_id", user.id)
    .single();

  if (repoError || !repo) {
    return NextResponse.json(
      { error: "Repository not found" },
      { status: 404 }
    );
  }

  // Get user's GitHub token
  const { data: userProfile } = await adminClient
    .from("users")
    .select("github_access_token")
    .eq("id", user.id)
    .single();

  if (!userProfile?.github_access_token) {
    return NextResponse.json(
      { error: "GitHub not connected" },
      { status: 400 }
    );
  }

  const [owner, repoName] = repo.full_name.split("/");
  const base = baseBranch || repo.default_branch || "main";

  try {
    // Get the SHA of the base branch
    const refResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${base}`,
      {
        headers: {
          Authorization: `Bearer ${userProfile.github_access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!refResponse.ok) {
      const error = await refResponse.text();
      return NextResponse.json(
        { error: `Base branch not found: ${error}` },
        { status: 404 }
      );
    }

    const refData = await refResponse.json();
    const sha = refData.object.sha;

    // Create the new branch
    const createResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/refs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userProfile.github_access_token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: `refs/heads/${name}`,
          sha,
        }),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      // Check if branch already exists
      if (createResponse.status === 422) {
        return NextResponse.json(
          { error: "Branch already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `Failed to create branch: ${error}` },
        { status: createResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      branch: {
        name,
        sha,
        baseBranch: base,
      },
    });
  } catch (error) {
    console.error("Error creating branch:", error);
    return NextResponse.json(
      { error: "Failed to create branch" },
      { status: 500 }
    );
  }
}
