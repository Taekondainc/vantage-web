export type PlanId = "free" | "paid";

export type UsageKind = "report" | "ai" | "evidence_pack";

export const BILLING = {
  paidPriceUsd: 14,
  paidPriceCents: 1400,
  productName: "Vantage",
  polarDescription:
    "Vantage is a SaaS product by Taekonda. Developers sign in with GitHub and turn a month of their own work into a submission-ready report: activity calendar, pull-request summaries, plan-versus-shipped tracking, AI-assisted notes, and exportable evidence packs for managers, clients, and invoices. This is a monthly subscription to Vantage at https://vantage.io. Support: support@vantage.io",
  freeLimits: {
    reports: 30,
    githubAccounts: 1,
    aiActions: 150,
    evidencePacks: 10,
  },
} as const;

export type BillingUsage = {
  period: string;
  reports: number;
  aiActions: number;
  evidencePacks: number;
};

export type BillingState = {
  plan: PlanId;
  periodEnd: string | null;
  usage: BillingUsage;
  limits: {
    reports: number | null;
    githubAccounts: number | null;
    aiActions: number | null;
    evidencePacks: number | null;
  };
  polarConfigured: boolean;
};

export function usagePeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function limitsFor(plan: PlanId): BillingState["limits"] {
  if (plan === "paid") {
    return { reports: null, githubAccounts: null, aiActions: null, evidencePacks: null };
  }
  return {
    reports: BILLING.freeLimits.reports,
    githubAccounts: BILLING.freeLimits.githubAccounts,
    aiActions: BILLING.freeLimits.aiActions,
    evidencePacks: BILLING.freeLimits.evidencePacks,
  };
}

export function meterLabel(kind: UsageKind) {
  if (kind === "report") return "monthly reports";
  if (kind === "ai") return "AI actions";
  return "evidence packs";
}

export type PaymentStatus = "pending" | "paid" | "refunded" | "canceled";

export type PaymentDocumentKind = "invoice" | "receipt";

export type PaymentDocument = {
  id: string;
  kind: PaymentDocumentKind;
  name: string;
  mime: string;
  sizeBytes: number;
  url: string | null;
  createdAt: string;
};

export type PaymentRecord = {
  id: string;
  status: PaymentStatus;
  billingReason: string | null;
  amountCents: number;
  currency: string;
  invoiceNumber: string | null;
  receiptNumber: string | null;
  paidAt: string | null;
  createdAt: string;
  documents: PaymentDocument[];
};
