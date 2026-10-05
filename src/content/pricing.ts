/** Single source for pricing/limits - change figures here only (NFR-9). */
export const PRICING = {
  currency: "USD" as const,
  currencySymbol: "$",
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    period: "month" as const,
    blurb: "Full feature set. Soft usage meters.",
    highlights: [
      "Public GitHub month reports",
      "Local tasks & AI objectives",
      "Markdown export & share",
      "Soft meters (see table)",
    ],
  },
  paid: {
    id: "paid",
    name: "Paid",
    priceUsd: 14,
    period: "month" as const,
    blurb: "Same features. Meters removed.",
    tag: "Full experience",
    highlights: [
      "Everything in Free",
      "Unlimited reports & AI actions",
      "Evidence packs without caps",
      "Priority Polar checkout",
    ],
  },
  fairnessNote: "No feature paywalls - Paid only removes usage meters.",
  checkoutUrl: "/app/billing",
  limits: [
    { label: "Monthly reports", free: "30", paid: "Unlimited" },
    { label: "GitHub accounts", free: "1", paid: "Unlimited" },
    { label: "AI actions / month", free: "150", paid: "Unlimited" },
    { label: "Integration syncs", free: "Desktop soft-capped", paid: "Unlimited" },
    { label: "Evidence packs", free: "10 / month", paid: "Unlimited" },
  ],
} as const;

export function formatUsd(amount: number): string {
  if (amount === 0) return "$0";
  return `$${amount.toLocaleString("en-US")}`;
}
