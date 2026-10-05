import type { PrReportItem } from "../../shared/types";

export function parsePrLabel(label: string): { repo: string; number: number } | null {
  const match = label.match(/^(.+)#(\d+)$/);
  if (!match) return null;
  return { repo: match[1]!, number: Number(match[2]) };
}

export function findPrByLabel(prs: PrReportItem[], label: string): PrReportItem | undefined {
  const parsed = parsePrLabel(label);
  if (!parsed) return undefined;
  return prs.find((pr) => pr.repo === parsed.repo && pr.number === parsed.number);
}

export function collectReportPrs(report: {
  mergedPrs: PrReportItem[];
  openPrs: PrReportItem[];
  closedPrs: PrReportItem[];
}): PrReportItem[] {
  return [...report.mergedPrs, ...report.openPrs, ...report.closedPrs];
}
