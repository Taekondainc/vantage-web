import { MarketingShell } from "../../components/marketing/MarketingShell";
import { PageMeta } from "../../components/PageMeta";
import { AppLink } from "../../components/ui/Button";
import { SITE } from "../../content/site";

export function NotFoundPage() {
  return (
    <MarketingShell>
      <PageMeta title={`404 - ${SITE.product}`} description="Page not found." />
      <section className="mx-auto max-w-[560px] px-6 py-24 text-center md:px-16">
        <p className="font-mono text-sm text-accent">404</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">This page didn't ship</h1>
        <p className="mt-3 text-muted">No report here - just a missing route. Head home or try the web app.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <AppLink to="/" variant="secondary">
            Home
          </AppLink>
          <AppLink to={SITE.webAppPath} variant="primary">
            Try Vantage free
          </AppLink>
        </div>
      </section>
    </MarketingShell>
  );
}
