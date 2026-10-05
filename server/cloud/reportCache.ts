// Persists loaded GitHub month reports and generated AI code reviews to
// Supabase so they survive server restarts/deploys instead of living only in
// memory. Falls back to a short-lived in-process Map when Supabase isn't
// configured (e.g. local dev without it set up), so the app still works.
import type { CodeAnalysis, MonthReport } from "../../shared/types";
import { getSupabase, supabaseConfigured } from "./supabase";

const CURRENT_MONTH_TTL_MS = 5 * 60_000;

type CacheRow = {
  report: MonthReport | null;
  report_updated_at: string | null;
  analysis: CodeAnalysis | null;
  analysis_updated_at: string | null;
};

const memory = new Map<string, CacheRow>();

function key(userId: string, year: number, month: number) {
  return `${userId}:${year}:${month}`;
}

function isPastMonth(year: number, month: number) {
  const now = new Date();
  return year < now.getUTCFullYear() || (year === now.getUTCFullYear() && month < now.getUTCMonth() + 1);
}

async function readRow(userId: string, year: number, month: number): Promise<CacheRow | null> {
  if (!supabaseConfigured()) return memory.get(key(userId, year, month)) ?? null;
  const { data } = await getSupabase()
    .from("vantage_report_cache")
    .select("report, report_updated_at, analysis, analysis_updated_at")
    .eq("user_id", userId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  return (data as CacheRow | null) ?? null;
}

async function upsertRow(userId: string, year: number, month: number, patch: Partial<CacheRow>) {
  if (!supabaseConfigured()) {
    const existing = memory.get(key(userId, year, month)) ?? {
      report: null,
      report_updated_at: null,
      analysis: null,
      analysis_updated_at: null,
    };
    memory.set(key(userId, year, month), { ...existing, ...patch });
    return;
  }
  await getSupabase()
    .from("vantage_report_cache")
    .upsert({ user_id: userId, year, month, ...patch }, { onConflict: "user_id,year,month" });
}

/** A cached report is usable as-is for a past (completed) month — those
 * don't change. For the current month, it's only good for a short TTL since
 * new activity keeps landing. */
export async function getCachedReport(userId: string, year: number, month: number): Promise<MonthReport | null> {
  const row = await readRow(userId, year, month);
  if (!row?.report || !row.report_updated_at) return null;
  if (isPastMonth(year, month)) return row.report;
  const age = Date.now() - new Date(row.report_updated_at).getTime();
  return age < CURRENT_MONTH_TTL_MS ? row.report : null;
}

export async function saveReport(userId: string, year: number, month: number, report: MonthReport): Promise<void> {
  await upsertRow(userId, year, month, { report, report_updated_at: new Date().toISOString() });
}

/** AI analysis is never silently re-generated once saved — it costs AI
 * quota. Callers pass `force: true` only for an explicit "Re-run" click. */
export async function getCachedAnalysis(
  userId: string,
  year: number,
  month: number,
): Promise<CodeAnalysis | null> {
  const row = await readRow(userId, year, month);
  return row?.analysis ?? null;
}

export async function saveAnalysis(
  userId: string,
  year: number,
  month: number,
  analysis: CodeAnalysis,
): Promise<void> {
  await upsertRow(userId, year, month, { analysis, analysis_updated_at: new Date().toISOString() });
}
