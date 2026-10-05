import { Apple, AppWindow, Monitor } from "lucide-react";
import { PageHero, SectionIsland, SectionShell } from "../../components/marketing/Accents";
import { FunnelDiagram } from "../../components/marketing/Mocks";
import { MarketingShell } from "../../components/marketing/MarketingShell";
import { PageMeta } from "../../components/PageMeta";
import { AppLink } from "../../components/ui/Button";
import { SectionLabel } from "../../components/ui/Reveal";
import { COMPARE_ROWS, SITE } from "../../content/site";

export function ComparePage() {
  return (
    <MarketingShell>
      <PageMeta
        title={`Web vs Desktop - ${SITE.product}`}
        description="Compare Vantage Web and Desktop after GitHub sign-in - private depth, sync, and evidence packs on Desktop."
      />

      <PageHero
        label="Web vs Desktop"
        title="Do I need to install anything?"
        body="Start in the browser. Move to Desktop when private repos, integrations, or evidence packs matter."
      >
        <div className="flex flex-wrap gap-3">
          <AppLink to={SITE.webAppPath} variant="primary">
            Open Vantage Web
          </AppLink>
          <AppLink to={SITE.downloadPath} variant="secondary">
            Download Desktop
          </AppLink>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Monitor size={16} /> Windows
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Apple size={16} /> macOS
          </span>
          <span className="inline-flex items-center gap-1.5">
            <AppWindow size={16} /> Linux
          </span>
        </div>
      </PageHero>

      <SectionIsland>
        <SectionLabel>Funnel</SectionLabel>
        <h2 className="mt-2 mb-5 font-display text-xl font-semibold">From browser to private work</h2>
        <FunnelDiagram />
      </SectionIsland>

      <SectionIsland>
        <SectionLabel>Comparison</SectionLabel>
        <h2 className="mt-2 mb-5 font-display text-xl font-semibold">Capability by surface</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="font-mono text-[12px] text-muted">
              <tr>
                <th className="pb-3 font-medium">Capability</th>
                <th className="pb-3 font-medium">Web</th>
                <th className="pb-3 font-medium">Desktop</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.feature} className="border-t border-border">
                  <td className="py-3 font-semibold text-fg">{row.feature}</td>
                  <td className="py-3 text-muted">{row.web}</td>
                  <td className="py-3 text-muted">{row.desktop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionIsland>

      <SectionShell>
        <div className="flex flex-wrap gap-3">
          <AppLink to={SITE.webAppPath} variant="primary">
            Open Vantage Web
          </AppLink>
          <AppLink to={SITE.downloadPath} variant="secondary">
            Download Desktop
          </AppLink>
        </div>
      </SectionShell>
    </MarketingShell>
  );
}
