import "server-only";

export type ProjectMilestone = {
  number: number;
  title: string;
  description: string | null;
  state: "open" | "closed";
  open_issues: number;
  closed_issues: number;
  due_on: string | null;
  html_url: string;
};

export type ProjectCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    } | null;
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
};

type GitHubWorkflowRun = {
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  updated_at: string;
};

type GitHubWorkflowResponse = {
  workflow_runs: GitHubWorkflowRun[];
};

export type ProjectProgressData = {
  repository: string;
  refreshedAt: string;
  progressPercent: number;
  closedIssues: number;
  totalIssues: number;
  milestones: ProjectMilestone[];
  commits: ProjectCommit[];
  latestWorkflow: GitHubWorkflowRun | null;
};

export class GitHubDashboardError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GitHubDashboardError";
  }
}

function getGitHubConfiguration() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;

  if (!repository) {
    throw new GitHubDashboardError("github_repository_missing", 503);
  }
  if (!token) {
    throw new GitHubDashboardError("github_token_missing", 503);
  }

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new GitHubDashboardError("github_repository_invalid", 503);
  }

  const [owner, name] = repository.split("/");
  if (owner === "." || owner === ".." || name === "." || name === "..") {
    throw new GitHubDashboardError("github_repository_invalid", 503);
  }

  return { repository, token };
}

async function fetchGitHubJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new GitHubDashboardError("github_request_failed", response.status);
  }

  return (await response.json()) as T;
}

export async function getProjectProgress(): Promise<ProjectProgressData> {
  const { repository, token } = getGitHubConfiguration();
  const repositoryUrl = `https://api.github.com/repos/${repository}`;
  const [milestones, commits, workflowData] = await Promise.all([
    fetchGitHubJson<ProjectMilestone[]>(
      `${repositoryUrl}/milestones?state=all&per_page=100`,
      token,
    ),
    fetchGitHubJson<ProjectCommit[]>(
      `${repositoryUrl}/commits?per_page=5`,
      token,
    ),
    fetchGitHubJson<GitHubWorkflowResponse>(
      `${repositoryUrl}/actions/runs?per_page=1`,
      token,
    ),
  ]);

  const closedIssues = milestones.reduce(
    (total, milestone) => total + milestone.closed_issues,
    0,
  );
  const totalIssues = milestones.reduce(
    (total, milestone) =>
      total + milestone.open_issues + milestone.closed_issues,
    0,
  );

  return {
    repository,
    refreshedAt: new Date().toISOString(),
    progressPercent:
      totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0,
    closedIssues,
    totalIssues,
    milestones,
    commits,
    latestWorkflow: workflowData.workflow_runs[0] ?? null,
  };
}
