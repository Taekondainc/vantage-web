export type FaqGroup = {
  id: string;
  title: string;
  items: { q: string; a: string }[];
};

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "getting-started",
    title: "Getting started",
    items: [
      {
        q: "Do I need an account to try Vantage?",
        a: "Yes. Sign in with GitHub on Web or Desktop. That unlocks your activity, reports, and saved work.",
      },
      {
        q: "What's the fastest way to see value?",
        a: "Sign in, open a month, generate a Standard report, then export Markdown or share it.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & tokens",
    items: [
      {
        q: "Does the marketing site store my GitHub token?",
        a: "Never. The marketing site does not handle credentials. Auth and tokens live only inside Vantage Web or Desktop after you sign in.",
      },
      {
        q: "Where do tasks and objectives live on the web?",
        a: "With your signed-in session for this app - not on the public marketing pages.",
      },
    ],
  },
  {
    id: "ai",
    title: "AI providers",
    items: [
      {
        q: "Which AI providers does Vantage use?",
        a: "Web objectives/auto-scope can use Groq when configured. Desktop supports additional providers (including Claude Code workflows) for deeper notes. AI assists the submission workflow - it is not the product's core claim.",
      },
      {
        q: "Will AI invent work I didn't do?",
        a: "Vantage is built to ground narratives in activity, diffs, and linked PRs. You remain the author of what you submit.",
      },
    ],
  },
  {
    id: "billing",
    title: "Billing",
    items: [
      {
        q: "What currency is pricing in?",
        a: "Prices are shown in USD. Paid is $14/month through Polar, which is the merchant of record (tax and card processing).",
      },
      {
        q: "What happens when I hit a Free limit?",
        a: "You'll see a soft-limit message (for example: \"You've used 5 of 5 monthly reports\"). Features stay available on Paid once meters are removed - there are no feature paywalls.",
      },
      {
        q: "Can I cancel Paid anytime?",
        a: "Yes. Cancelation stops the next billing cycle; you keep Free meters afterward.",
      },
    ],
  },
  {
    id: "desktop-web",
    title: "Desktop vs Web",
    items: [
      {
        q: "When do I need Desktop?",
        a: "When you need private/org depth, integration sync (Linear / Jira / Asana), richer exports, or evidence packs.",
      },
      {
        q: "Can I start on Web and move to Desktop later?",
        a: "Yes. Sign in on Web first, then download Desktop when private work or sync matters more.",
      },
    ],
  },
];
