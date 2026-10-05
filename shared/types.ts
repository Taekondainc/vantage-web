export type ExtractedScope = {
  repo: string | null;
  branchName: string | null;
};

export type ObjectiveKind = "objective" | "target";

export type ObjectiveItemStatus = "not-started" | "in-progress" | "met";

export type ObjectiveItem = {
  id: string;
  text: string;
  status: ObjectiveItemStatus;
  /** Set when this item was also pushed to Jira as its own issue (desktop-app feature). */
  jiraIssueKey?: string | null;
  jiraUrl?: string | null;
};

export type DraftedSet = {
  id: string;
  kind: ObjectiveKind;
  title: string;
  repo: string | null;
  branchName: string | null;
  items: ObjectiveItem[];
  createdAt: string;
};

export type GenerateResponse = {
  title: string;
  items: string[];
  repo: string | null;
  branchName: string | null;
};

export type TaskStatus = "todo" | "in-progress" | "reviewing" | "done";

export type TaskSource = "local" | "linear" | "jira" | "github" | "asana";

export type WebTask = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  repo: string;
  branchName: string;
  createdAt: string;
  expectedFinishAt: string | null;
};

/** Personal task/objective data synced to the cloud so it shows up the same
 * whether it was created from the web app or the desktop app. */
export type CloudTask = {
  id: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  repo: string | null;
  branchName: string | null;
  source: TaskSource;
  issueKey: string | null;
  createdAt: string;
  expectedFinishAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

export type CloudTaskInput = {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  repo?: string | null;
  branchName?: string | null;
  source?: TaskSource;
  issueKey?: string | null;
  createdAt?: string;
  expectedFinishAt?: string | null;
};

export type CloudObjectiveSet = {
  id: string;
  ownerUserId: string;
  kind: ObjectiveKind;
  title: string;
  sourceName: string | null;
  repo: string | null;
  branchName: string | null;
  createdAt: string;
  updatedAt: string;
  items: ObjectiveItem[];
};

export type GithubMonthActivity = {
  username: string;
  name: string;
  avatarUrl: string;
  year: number;
  month: number;
  stats: {
    commits: number;
    pushes: number;
    prsOpened: number;
    prsMerged: number;
    repos: number;
  };
  items: Array<{
    id: string;
    type: string;
    repo: string;
    title: string;
    createdAt: string;
    url: string | null;
  }>;
  truncated: boolean;
};

export type GithubProfileActivity = {
  username: string;
  name: string;
  avatarUrl: string;
  items: GithubMonthActivity["items"];
  truncated: boolean;
};

// --- Full month report (same shape as vantagedestkop/shared/types.ts) ---
// Built from the authenticated Search API (private repos included), unlike
// GithubMonthActivity/GithubProfileActivity above which come from the public
// Events API and are kept only for the signed-out/no-token lookup path.

export type PrState = "merged" | "open" | "closed";

export type PrReportItem = {
  number: number;
  title: string;
  body: string | null;
  repo: string;
  url: string;
  mergedAt: string | null;
  createdAt: string;
  state: PrState;
  additions: number;
  deletions: number;
  changedFiles: number;
  hasDescription: boolean;
  line1: string;
  line2: string;
  advice: string | null;
  baseBranch: string;
  headBranch: string;
};

export type PushCommit = {
  sha: string;
  message: string;
  url: string;
  date: string;
};

export type PushGroup = {
  repo: string;
  date: string;
  commits: PushCommit[];
};

export type DailyCount = {
  date: string;
  count: number;
};

export type MonthStats = {
  prsMerged: number;
  prsOpen: number;
  prsClosed: number;
  commits: number;
  repos: number;
  additions: number;
  deletions: number;
};

export type MonthReport = {
  year: number;
  month: number;
  username: string;
  avatarUrl: string;
  name: string;
  stats: MonthStats;
  dailyCommits: DailyCount[];
  mergedPrs: PrReportItem[];
  openPrs: PrReportItem[];
  closedPrs: PrReportItem[];
  pushes: PushGroup[];
};

export type YearMonthSlice = {
  month: number;
  stats: MonthStats;
};

export type RepoBreakdown = {
  repo: string;
  prs: number;
  commits: number;
};

export type YearReport = {
  year: number;
  username: string;
  avatarUrl: string;
  name: string;
  stats: MonthStats & { monthsActive: number };
  months: YearMonthSlice[];
  mergedPrs: PrReportItem[];
  openPrs: PrReportItem[];
  closedPrs: PrReportItem[];
  pushes: PushGroup[];
  repoBreakdown: RepoBreakdown[];
};

export type CodeRecommendation = {
  title: string;
  severity: "info" | "suggestion" | "important";
  detail: string;
  relatedPrs: string[];
};

export type CodeRisk = {
  message: string;
  prs: PrReportItem[];
};

export type CodeAnalysis = {
  summary: string;
  strengths: string[];
  risks: CodeRisk[];
  recommendations: CodeRecommendation[];
};

export type CloudRole = "lead" | "member";

export type MembershipStatus = "invited" | "active";

export type CloudUser = {
  id: string;
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  githubTokenEnc?: string | null;
};

export type CloudSession = {
  token: string;
  userId: string;
  expiresAt: string;
};

export type CloudProject = {
  id: string;
  name: string;
  description: string;
  leadUserId: string;
  createdAt: string;
};

export type CloudMembership = {
  id: string;
  projectId: string;
  userId: string | null;
  githubLogin: string;
  role: CloudRole;
  status: MembershipStatus;
  invitedAt: string;
};

export type SubmittedReportPr = {
  title: string;
  url: string;
  repo: string;
};

export type SubmittedReportStats = {
  prsMerged: number;
  prsOpen: number;
  prsClosed: number;
  commits: number;
  repos: number;
  additions?: number;
  deletions?: number;
};

export type CloudSubmittedReport = {
  id: string;
  projectId: string;
  authorUserId: string;
  year: number;
  month: number;
  markdown: string;
  stats: SubmittedReportStats;
  mergedPrs: SubmittedReportPr[];
  submittedAt: string;
};

export type CloudRecommendation = {
  id: string;
  projectId: string;
  authorUserId: string;
  targetUserId: string;
  reportId: string | null;
  year: number;
  month: number;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type CloudInvite = {
  id: string;
  projectId: string;
  projectName: string;
  githubLogin: string;
  role: CloudRole;
  invitedAt: string;
};

export type CloudMe = {
  user: CloudUser;
  invites: CloudInvite[];
  billing: import("./billing").BillingState | null;
  email: string | null;
};

export type CloudFileView = {
  id: string;
  projectId: string;
  projectName: string;
  authorUserId: string;
  authorLogin: string;
  reportId: string | null;
  year: number | null;
  month: number | null;
  name: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
};

export type CloudSyncPayload = {
  user: CloudUser;
  invites: CloudInvite[];
  projects: CloudProjectSummary[];
  recommendations: CloudRecommendationView[];
  files: CloudFileView[];
  syncedAt: string;
};

export type CloudAuthResponse = {
  token: string;
  user: CloudUser;
};

export type CloudProjectSummary = CloudProject & {
  role: CloudRole;
  memberCount: number;
};

export type CloudMemberView = CloudMembership & {
  name: string | null;
  avatarUrl: string | null;
};

export type CloudProjectDetail = CloudProject & {
  role: CloudRole;
  members: CloudMemberView[];
};

export type CloudReportView = CloudSubmittedReport & {
  authorLogin: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
};

export type CloudRecommendationView = CloudRecommendation & {
  authorLogin: string;
  authorName: string | null;
  targetLogin: string;
  targetName: string | null;
  projectName: string;
};
