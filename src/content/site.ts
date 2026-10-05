export const SITE = {
  product: "Vantage",
  company: "Taekonda",
  tagline: "See the month. Ship the proof.",
  subhead:
    "Sign in with GitHub, then turn a month of work into a submission-ready report - with plan-vs-shipped receipts, not vibes.",
  webAppPath: "/app/sign-in",
  downloadPath: "/download",
  releasesUrl: "https://github.com/Taekondainc/vantage-releases",
  contactEmail: "hello@taekonda.com",
  docsUrl: null as string | null,
} as const;

export const NAV = [
  { to: "/features", label: "Features" },
  { to: "/templates", label: "Templates" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
] as const;

export const FOOTER = {
  product: [
    { to: "/features", label: "Features" },
    { to: "/templates", label: "Templates" },
    { to: "/compare", label: "Web vs Desktop" },
    { to: "/pricing", label: "Pricing" },
  ],
  company: [
    { to: "/about", label: "About" },
    { to: "/faq", label: "FAQ" },
    { href: `mailto:${SITE.contactEmail}`, label: "Contact" },
  ],
  legal: [
    { to: "/legal/privacy", label: "Privacy" },
    { to: "/legal/terms", label: "Terms" },
  ],
} as const;

export const PROBLEM = {
  title: "Blank-page reporting is the real tax",
  body: "PRs, Slack threads, and ticket titles don't write themselves into a narrative. Vantage turns live activity into a submission you can send - so the hard part stays the work, not the write-up.",
  points: [
    "Activity isn't the narrative your manager or client needs",
    "Plan items drift from what actually merged",
    "Evidence is scattered across links and screenshots",
  ],
} as const;

export const TEMPLATES = [
  {
    id: "performance",
    name: "Performance review",
    audience: "Managers / HR / self-review",
    produces: ["Impact narrative", "Shipped outcomes", "Growth highlights"],
    sampleSections: ["Summary", "Shipped work", "Collaboration", "Goals next cycle"],
  },
  {
    id: "standard",
    name: "Standard",
    audience: "ICs / contractors / weekly-monthly submit",
    produces: ["Month overview", "Activity calendar", "Task & PR receipts"],
    sampleSections: ["Overview", "Calendar", "Tasks", "Exports"],
  },
  {
    id: "error-log",
    name: "Error logging",
    audience: "Incident / reliability reviews",
    produces: ["Risk flags", "Reverts & hotfixes", "Error themes"],
    sampleSections: ["Incidents", "Risk badges", "Fixes shipped", "Follow-ups"],
  },
] as const;

export const CUSTOMERS = [
  { id: "ic", title: "IC developer", body: "Close the month without staring at a blank doc." },
  { id: "freelancer", title: "Freelancer / contractor", body: "Send evidence packs with the invoice, not excuses." },
  { id: "lead", title: "Team lead", body: "See plan-vs-shipped without chasing status updates." },
  {
    id: "anyone",
    title: "Anyone in email/Slack",
    body: "If your reporting lives in threads, Vantage packages it.",
  },
] as const;

export const COMPARE_ROWS = [
  { feature: "Login", web: "GitHub sign-in", desktop: "GitHub OAuth" },
  { feature: "Repos", web: "Public + authorized repos", desktop: "Public + private / org" },
  { feature: "Tasks & objectives", web: "Synced to your account", desktop: "Local + integrations sync" },
  { feature: "Exports", web: "Markdown / share", desktop: "MD / PDF / Word / TXT + evidence packs" },
  { feature: "AI", web: "Scope + objectives (metered)", desktop: "Full pipeline + code notes" },
  { feature: "Pitch", web: "Start in the browser", desktop: "Private work + sync" },
] as const;

export const FEATURES = [
  {
    id: "reports",
    title: "Submission reports from live GitHub",
    blurb: "Sign in, open a month, and export a report you can share.",
    points: ["Month picker + GitHub activity", "Activity calendar & PR list", "Export Markdown / share"],
    cta: "try" as const,
    photo: "/photos/report-ui.png",
  },
  {
    id: "templates",
    title: "Three audience templates",
    blurb: "Performance, Standard, and Error-log - same workflow, different readers.",
    points: ["Performance review narrative", "Standard month submit", "Error-log with risk flags"],
    cta: "try" as const,
    photo: "/photos/report-review.png",
  },
  {
    id: "plan-shipped",
    title: "Plan vs shipped",
    blurb: "Match what you said you'd do to PRs that actually merged.",
    points: ["Task to PR match", "Status badges that mean something", "Drift detection"],
    cta: "try" as const,
  },
  {
    id: "objectives",
    title: "Objectives & targets from briefs",
    blurb: "Paste a brief; get a checklist of objectives or targets with scope fields.",
    points: ["AI draft from free text", "Checkbox progress", "Shareable checklists"],
    cta: "try" as const,
  },
  {
    id: "ai-diffs",
    title: "AI that reads real work",
    blurb: "Narratives grounded in diffs and activity - not a generic chatbot essay.",
    points: ["Diff-aware notes on Desktop", "You stay the author", "Submission workflow first"],
    cta: "desktop" as const,
  },
  {
    id: "auto-scope",
    title: "Auto-scope",
    blurb: "Free-text labels become repo and branch without fighting the form.",
    points: ["Heuristic + AI detection", "Works on messy briefs", "Editable before generate"],
    cta: "try" as const,
  },
  {
    id: "metrics",
    title: "Activity calendar & metrics",
    blurb: "Day grid and KPI cards that mirror how you already think about a month.",
    points: ["PR / commit density", "Task analysis cards", "Template-aware layout"],
    cta: "try" as const,
  },
  {
    id: "evidence",
    title: "Export, share, evidence packs",
    blurb: "Markdown, share links, and ZIP receipts (report + link list + metadata).",
    points: ["report.md + links.txt + metadata", "MD / PDF / Word / TXT on Desktop", "Gmail-friendly line breaks"],
    cta: "desktop" as const,
    photo: "/photos/git-sticker.png",
  },
  {
    id: "security",
    title: "Security & desktop polish",
    blurb: "GitHub OAuth on Web and Desktop. The marketing site never stores your token.",
    points: ["Sign in with GitHub", "Tokens stay in the app", "Desktop for private/org depth"],
    cta: "desktop" as const,
  },
] as const;
