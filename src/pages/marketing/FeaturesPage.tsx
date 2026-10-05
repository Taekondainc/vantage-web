import {
  AutoScopeDiagram,
  DiffSnippet,
  EvidencePackMock,
  PlanShippedDiagram,
} from "../../components/marketing/Mocks";
import { Marquee, PageHero, PhotoCard, SectionIsland, SectionShell } from "../../components/marketing/Accents";
import { MarketingShell } from "../../components/marketing/MarketingShell";
import { PageMeta } from "../../components/PageMeta";
import { AppLink } from "../../components/ui/Button";
import { SectionLabel } from "../../components/ui/Reveal";
import { FEATURES, SITE } from "../../content/site";

export function FeaturesPage() {
  return (
    <MarketingShell>
      <PageMeta
        title={`Features - ${SITE.product}`}
        description="Submission reports, plan-vs-shipped, auto-scope, evidence packs, and more."
      />

      <PageHero
        label="Features"
        title="The submission workflow, end to end"
        body="AI assists where it helps. The differentiator is the report you can actually send."
      >
        <AppLink to={SITE.webAppPath} variant="primary">
          Try Vantage free
        </AppLink>
      </PageHero>

      <Marquee items={FEATURES.map((f) => f.title)} />

      <SectionShell>
        <nav className="flex flex-wrap gap-2" aria-label="Feature sections">
          {FEATURES.map((f) => (
            <a
              key={f.id}
              href={`#${f.id}`}
              className="rounded-[8px] border border-border px-3 py-1.5 font-mono text-[12px] text-muted no-underline hover:text-accent"
            >
              {f.title}
            </a>
          ))}
        </nav>
      </SectionShell>

      {FEATURES.map((f) => (
        <SectionIsland key={f.id} id={f.id}>
          <SectionLabel>{f.id}</SectionLabel>
          <h2 className="mt-2 font-display text-[28px] font-semibold text-fg">{f.title}</h2>
          <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-muted">{f.blurb}</p>
          <ul className="mt-4 space-y-1.5 text-sm text-muted">
            {f.points.map((p) => (
              <li key={p}>' {p}</li>
            ))}
          </ul>
          <div className="mt-6">
            {f.cta === "try" ? (
              <AppLink to={SITE.webAppPath} variant="primary">
                Try Vantage free
              </AppLink>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-border px-3 py-1 font-mono text-[12px] text-muted">
                  Available on Desktop
                </span>
                <AppLink to={SITE.downloadPath} variant="secondary" size="sm">
                  Download
                </AppLink>
              </div>
            )}
          </div>
          <div className="mt-8">
            {f.id === "plan-shipped" ? <PlanShippedDiagram /> : null}
            {f.id === "auto-scope" || f.id === "objectives" ? <AutoScopeDiagram /> : null}
            {f.id === "ai-diffs" ? <DiffSnippet /> : null}
            {f.id === "evidence" ? <EvidencePackMock /> : null}
            {"photo" in f && f.photo ? (
              <PhotoCard src={f.photo} alt="" className="mt-2 max-h-[320px] min-h-[200px]" />
            ) : null}
            {f.id === "security" ? (
              <div className="rounded-[8px] border border-border bg-canvas p-4 text-sm text-muted">
                Marketing site never handles credentials. Auth lives in Web/Desktop only.
              </div>
            ) : null}
          </div>
        </SectionIsland>
      ))}
    </MarketingShell>
  );
}
