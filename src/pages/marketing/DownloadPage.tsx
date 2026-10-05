import { Apple, AppWindow, Monitor } from "lucide-react";
import { Link } from "react-router-dom";
import { MarketingShell } from "../../components/marketing/MarketingShell";
import { PageMeta } from "../../components/PageMeta";
import { AppLink, ExtLink } from "../../components/ui/Button";
import { Reveal, SectionLabel } from "../../components/ui/Reveal";
import { SITE } from "../../content/site";

export function DownloadPage() {
  return (
    <MarketingShell>
      <PageMeta
        title={`Download - ${SITE.product}`}
        description="Download Vantage Desktop for Windows, macOS, and Linux."
      />
      <section className="mx-auto max-w-[640px] px-6 py-16 md:px-16 md:py-24">
        <Reveal>
          <SectionLabel>Desktop</SectionLabel>
          <h1 className="font-display text-[36px] font-bold tracking-tight">Get {SITE.product} Desktop</h1>
          <p className="mt-3 text-muted">
            Private repos, integration sync, richer exports, and evidence packs. Sign in with GitHub in the app - this
            site never sees your token.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted">
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
          <div className="mt-8 flex flex-wrap gap-3">
            <ExtLink href={SITE.releasesUrl} target="_blank" rel="noreferrer" variant="primary">
              Open installers
            </ExtLink>
            <AppLink to={SITE.webAppPath} variant="secondary">
              Try Vantage free
            </AppLink>
          </div>
          <Link to="/compare" className="mt-6 inline-block text-sm font-semibold text-accent no-underline">
            Web vs Desktop comparison ?
          </Link>
        </Reveal>
      </section>
    </MarketingShell>
  );
}
