import * as Tabs from "@radix-ui/react-tabs";
import { PageHero, PhotoCard, SectionIsland, SectionShell } from "../../components/marketing/Accents";
import { MarketingShell } from "../../components/marketing/MarketingShell";
import { PageMeta } from "../../components/PageMeta";
import { AppLink } from "../../components/ui/Button";
import { Reveal, SectionLabel, StatusBadge } from "../../components/ui/Reveal";
import { SITE, TEMPLATES } from "../../content/site";
import { cn } from "../../lib/cn";

export function TemplatesPage() {
  return (
    <MarketingShell>
      <PageMeta
        title={`Templates - ${SITE.product}`}
        description="Performance review, Standard, and Error-log templates for monthly submissions."
      />

      <PageHero
        label="Templates"
        title="Pick the report your reader expects"
        body="Same submission workflow - different shape for managers, ICs, and incident reviews."
      />

      <SectionShell>
        <div className="grid gap-4 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <Reveal key={t.id}>
              <article
                id={t.id}
                className={cn(
                  "flex h-full flex-col rounded-[12px] border border-border bg-surface p-5",
                  t.id === "error-log" && "border-risk/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[11px] text-muted uppercase">{t.audience}</p>
                  {t.id === "error-log" ? <StatusBadge status="risk" /> : null}
                </div>
                <h2 className="mt-2 font-display text-xl font-semibold text-fg">{t.name}</h2>
                <ul className="mt-4 space-y-1.5 text-sm text-muted">
                  {t.produces.map((p) => (
                    <li key={p}>' {p}</li>
                  ))}
                </ul>
                <div className="mt-4 rounded-[8px] border border-border bg-canvas p-3">
                  <p className="mb-2 font-mono text-[11px] text-muted">Sample sections</p>
                  <div className="flex flex-wrap gap-1.5">
                    {t.sampleSections.map((s) => (
                      <span key={s} className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-fg">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </SectionShell>

      <SectionIsland>
        <SectionLabel>Preview</SectionLabel>
        <h2 className="mt-2 mb-4 font-display text-xl font-semibold">Sample report chrome</h2>
        <Tabs.Root defaultValue="standard">
          <Tabs.List className="mb-4 flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <Tabs.Trigger
                key={t.id}
                value={t.id}
                className="rounded-[8px] border border-border px-3 py-1.5 text-sm font-semibold text-muted data-[state=active]:border-accent data-[state=active]:text-accent"
              >
                {t.name}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {TEMPLATES.map((t) => (
            <Tabs.Content key={t.id} value={t.id}>
              <PhotoCard
                src="/photos/report-ui.png"
                alt={`${t.name} sample report UI`}
                className="min-h-[280px]"
              />
              <p className="mt-3 text-sm text-muted">UI preview for {t.name}. Real screenshots replace placeholders as they land.</p>
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </SectionIsland>

      <SectionShell>
        <AppLink to={SITE.webAppPath} variant="primary">
          Try Vantage free
        </AppLink>
      </SectionShell>
    </MarketingShell>
  );
}
