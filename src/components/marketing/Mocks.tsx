import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { StatusBadge } from "../ui/Reveal";

export function WindowChrome({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[12px] border border-border bg-surface", className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="ml-2 truncate font-mono text-[11px] text-muted">{title}</span>
      </div>
      <div className="p-3 md:p-4">{children}</div>
    </div>
  );
}

/** Compact modular report mock - separate metric cards, clear gaps. */
export function ReportMock({ className }: { className?: string }) {
  const days = Array.from({ length: 28 }, (_, i) => i);
  return (
    <WindowChrome title="vantage - report - 2026-08 - standard" className={className}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] text-muted">@dev - August 2026</p>
            <h3 className="mt-0.5 text-[15px] font-semibold text-fg">Monthly submission</h3>
          </div>
          <StatusBadge status="shipped" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { n: "14", l: "PRs merged" },
            { n: "6", l: "Tasks shipped" },
            { n: "2", l: "Objectives" },
          ].map((m) => (
            <div key={m.l} className="rounded-[8px] border border-border bg-canvas px-2.5 py-2">
              <p className="font-mono text-lg font-semibold text-fg">{m.n}</p>
              <p className="text-[11px] text-muted">{m.l}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[8px] border border-border bg-canvas p-2.5">
          <p className="mb-2 font-mono text-[10px] tracking-wide text-muted uppercase">Activity</p>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => (
              <div
                key={d}
                className={cn(
                  "aspect-square rounded-[2px]",
                  d % 5 === 0 ? "bg-accent/40" : d % 3 === 0 ? "bg-shipped/30" : "bg-raised",
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-[8px] border border-border bg-canvas px-2.5 py-2">
          <p className="truncate text-[13px] text-fg">Fix checkout race</p>
          <StatusBadge status="shipped" />
        </div>
      </div>
    </WindowChrome>
  );
}

export function PlanShippedDiagram() {
  return (
    <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
      <div className="rounded-[12px] border border-border bg-surface p-4">
        <p className="font-mono text-[11px] text-muted uppercase">Task</p>
        <p className="mt-2 text-sm font-semibold text-fg">Ship export formats</p>
        <div className="mt-3">
          <StatusBadge status="planned" />
        </div>
      </div>
      <motion.div
        className="flex items-center justify-center font-mono text-sm text-accent"
        initial={{ opacity: 0.4 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        ?
      </motion.div>
      <div className="rounded-[12px] border border-border bg-surface p-4">
        <p className="font-mono text-[11px] text-muted uppercase">Pull request</p>
        <p className="mt-2 text-sm font-semibold text-fg">feat: pdf + docx export</p>
        <p className="mt-1 font-mono text-[12px] text-muted">#874 - merged</p>
        <div className="mt-3">
          <StatusBadge status="shipped" />
        </div>
      </div>
    </div>
  );
}

export function EvidencePackMock() {
  const files = ["report.md", "links.txt", "metadata.txt"];
  return (
    <div className="rounded-[12px] border border-border bg-surface p-4">
      <p className="font-mono text-[12px] text-muted">evidence-pack.zip</p>
      <ul className="mt-3 space-y-2">
        {files.map((f, i) => (
          <motion.li
            key={f}
            className="flex items-center gap-2 rounded-[8px] border border-border bg-canvas px-3 py-2 font-mono text-[13px] text-fg"
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.06 * i }}
          >
            <FileText size={14} className="shrink-0 text-accent" aria-hidden />
            {f}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export function AutoScopeDiagram() {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <div className="rounded-[12px] border border-border bg-surface p-4">
        <p className="font-mono text-[11px] text-muted uppercase">Brief</p>
        <p className="mt-2 text-sm leading-relaxed text-fg">
          'Ship PDF export on <span className="text-accent">vantage</span> /{" "}
          <span className="text-accent">feat/exports</span>'
        </p>
      </div>
      <div className="text-center font-mono text-sm text-accent">?</div>
      <div className="space-y-2 rounded-[12px] border border-border bg-surface p-4">
        <div>
          <p className="font-mono text-[11px] text-muted">Repo</p>
          <p className="font-mono text-sm text-fg">Taekondainc/vantage</p>
        </div>
        <div>
          <p className="font-mono text-[11px] text-muted">Branch</p>
          <p className="font-mono text-sm text-fg">feat/exports</p>
        </div>
      </div>
    </div>
  );
}

export function DiffSnippet() {
  return (
    <pre className="overflow-x-auto rounded-[12px] border border-border bg-canvas p-4 font-mono text-[12px] leading-relaxed text-fg">
      <code>
        <span className="text-muted">{"// PR #874 - export pipeline\n"}</span>
        <span className="text-risk">{"- saveAsMarkdown(report)\n"}</span>
        <span className="text-shipped">{"+ await exportPdf(report)\n"}</span>
        <span className="text-shipped">{"+ await exportDocx(report)\n"}</span>
        <span className="mt-2 block text-accent">{"? grounded in the diff"}</span>
      </code>
    </pre>
  );
}

export function FunnelDiagram() {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <div className="rounded-[12px] border border-border bg-surface p-4 text-center">
        <p className="font-mono text-[11px] text-muted uppercase">Web</p>
        <p className="mt-2 text-sm font-semibold">Browser - public GitHub</p>
      </div>
      <div className="text-center font-mono text-[12px] text-accent">? private</div>
      <div className="rounded-[12px] border border-border bg-surface p-4 text-center">
        <p className="font-mono text-[11px] text-muted uppercase">Desktop</p>
        <p className="mt-2 text-sm font-semibold">App - OAuth - sync</p>
      </div>
    </div>
  );
}
