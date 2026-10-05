import type { BillingState, PlanId, UsageKind } from "../../shared/billing";
import { BILLING, limitsFor, meterLabel, usagePeriod } from "../../shared/billing";
import { HttpError } from "./store";
import { getSupabase, supabaseConfigured } from "./supabase";
import { polarConfigured } from "./polar";

type UserBillingRow = {
  id: string;
  plan: string | null;
  polar_customer_id: string | null;
  polar_subscription_id: string | null;
  plan_period_end: string | null;
};

type UsageRow = {
  reports: number;
  ai_actions: number;
  evidence_packs: number;
};

function emptyUsage(period: string): BillingState["usage"] {
  return { period, reports: 0, aiActions: 0, evidencePacks: 0 };
}

function asPlan(value: string | null | undefined): PlanId {
  return value === "paid" ? "paid" : "free";
}

export function planFromPolarStatus(status: string | null | undefined): PlanId {
  const value = (status || "").toLowerCase();
  if (value === "active" || value === "trialing" || value === "past_due") return "paid";
  return "free";
}

export async function getBillingState(userId: string): Promise<BillingState> {
  const period = usagePeriod();
  if (!supabaseConfigured()) {
    return {
      plan: "free",
      periodEnd: null,
      usage: emptyUsage(period),
      limits: { reports: null, githubAccounts: null, aiActions: null, evidencePacks: null },
      polarConfigured: polarConfigured(),
    };
  }

  const sb = getSupabase();
  const userRes = await sb
    .from("vantage_users")
    .select("id, plan, polar_customer_id, polar_subscription_id, plan_period_end")
    .eq("id", userId)
    .maybeSingle();
  const user = userRes.data as UserBillingRow | null;
  const plan = asPlan(user?.plan);
  const usageRes = await sb
    .from("vantage_usage")
    .select("reports, ai_actions, evidence_packs")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();
  const usage = (usageRes.data as UsageRow | null) ?? null;

  return {
    plan,
    periodEnd: user?.plan_period_end ?? null,
    usage: {
      period,
      reports: usage?.reports ?? 0,
      aiActions: usage?.ai_actions ?? 0,
      evidencePacks: usage?.evidence_packs ?? 0,
    },
    limits: limitsFor(plan),
    polarConfigured: polarConfigured(),
  };
}

export async function consumeUsage(userId: string, kind: UsageKind): Promise<BillingState> {
  if (!supabaseConfigured()) return getBillingState(userId);

  const current = await getBillingState(userId);
  const column = kind === "report" ? "reports" : kind === "ai" ? "aiActions" : "evidencePacks";
  const limit = current.limits[column];
  const used = current.usage[column];
  if (limit !== null && used >= limit) {
    throw new HttpError(
      402,
      `Free plan includes ${limit} ${meterLabel(kind)} per month. Upgrade to Paid ($${BILLING.paidPriceUsd}/mo) to continue.`,
    );
  }

  const sb = getSupabase();
  const period = current.usage.period;
  const next = {
    reports: current.usage.reports + (kind === "report" ? 1 : 0),
    ai_actions: current.usage.aiActions + (kind === "ai" ? 1 : 0),
    evidence_packs: current.usage.evidencePacks + (kind === "evidence_pack" ? 1 : 0),
  };
  const { error } = await sb.from("vantage_usage").upsert(
    {
      user_id: userId,
      period,
      ...next,
    },
    { onConflict: "user_id,period" },
  );
  if (error) throw new HttpError(502, `Supabase: ${error.message}`);

  return {
    ...current,
    usage: {
      period,
      reports: next.reports,
      aiActions: next.ai_actions,
      evidencePacks: next.evidence_packs,
    },
  };
}

export async function getUserBillingRow(userId: string): Promise<UserBillingRow | null> {
  if (!supabaseConfigured()) return null;
  const { data, error } = await getSupabase()
    .from("vantage_users")
    .select("id, plan, polar_customer_id, polar_subscription_id, plan_period_end")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  return data as UserBillingRow | null;
}

export async function findUserIdByCustomer(customerId: string): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const { data, error } = await getSupabase()
    .from("vantage_users")
    .select("id")
    .eq("polar_customer_id", customerId)
    .maybeSingle();
  if (error) throw new HttpError(502, `Supabase: ${error.message}`);
  return data?.id ?? null;
}

export async function applySubscription(input: {
  userId?: string | null;
  customerId: string;
  subscriptionId: string | null;
  plan: PlanId;
  periodEnd: string | null;
}) {
  if (!supabaseConfigured()) return;
  const sb = getSupabase();
  let userId = input.userId || null;
  if (!userId && input.customerId) userId = await findUserIdByCustomer(input.customerId);
  if (!userId) return;

  const { error } = await sb
    .from("vantage_users")
    .update({
      plan: input.plan,
      ...(input.customerId ? { polar_customer_id: input.customerId } : {}),
      polar_subscription_id: input.subscriptionId,
      plan_period_end: input.periodEnd,
    })
    .eq("id", userId);
  if (error) throw new HttpError(502, `Supabase: ${error.message}`);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function periodEndIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
  }
  return null;
}

export async function applyPolarEvent(type: string, data: Record<string, unknown>) {
  const customer = asObject(data.customer);
  const metadata = asObject(data.metadata) || asObject(customer?.metadata);
  const userId =
    stringField(metadata?.userId) ||
    stringField(metadata?.user_id) ||
    stringField(data.external_customer_id) ||
    stringField(customer?.external_id) ||
    stringField(asObject(customer?.metadata)?.userId) ||
    stringField(asObject(customer?.metadata)?.user_id);

  const customerId = stringField(data.customer_id) || stringField(customer?.id);
  if (!customerId && !userId) return;

  if (type.startsWith("subscription.")) {
    const status = stringField(data.status);
    await applySubscription({
      userId,
      customerId: customerId || "",
      subscriptionId: stringField(data.id),
      plan: planFromPolarStatus(status),
      periodEnd: periodEndIso(data.current_period_end),
    });
    return;
  }

  if (type.startsWith("order.")) {
    const { upsertPaymentFromOrder } = await import("./payments");
    await upsertPaymentFromOrder({ userId, order: data });
    return;
  }

  if (type === "checkout.updated") {
    const status = stringField(data.status);
    if (status !== "succeeded" && status !== "confirmed") return;
    const nested = asObject(data.subscription) || asObject(data.customer);
    await applySubscription({
      userId,
      customerId: customerId || stringField(nested?.id) || "",
      subscriptionId: stringField(asObject(data.subscription)?.id) || stringField(data.subscription_id),
      plan: "paid",
      periodEnd: periodEndIso(asObject(data.subscription)?.current_period_end),
    });
  }
}
