import { PageHero, PhotoCard, SectionIsland, SectionShell } from "../../components/marketing/Accents";
import { MarketingShell } from "../../components/marketing/MarketingShell";
import { PageMeta } from "../../components/PageMeta";
import { AppLink } from "../../components/ui/Button";
import { SectionLabel } from "../../components/ui/Reveal";
import { SITE } from "../../content/site";

export function AboutPage() {
  return (
    <MarketingShell>
      <PageMeta
        title={`About - ${SITE.company}`}
        description={`${SITE.product} is proof-of-work software by ${SITE.company}.`}
      />

      <PageHero
        label="About"
        title={`${SITE.company} builds ${SITE.product}`}
        body={`${SITE.product} is the product name for the submission workflow that turns a month of GitHub activity into reports, plan-vs-shipped receipts, and evidence packs.`}
      >
        <AppLink to={SITE.webAppPath} variant="primary">
          Try Vantage free
        </AppLink>
      </PageHero>

      <SectionIsland>
        <SectionLabel>Brand</SectionLabel>
        <h2 className="mt-2 font-display text-xl font-semibold">Vantage is the product</h2>
        <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-muted">
          {SITE.company} makes tools for developers who need proof of work - not another chat window. The marketing
          site never handles credentials. Auth and tokens stay inside {SITE.product} Web and Desktop.
        </p>
      </SectionIsland>

      <SectionShell>
        <PhotoCard
          src="/photos/git-sticker.png"
          alt="Git sticker - version control branding"
          caption="Grounded in real Git work"
          className="min-h-[240px] max-w-lg"
        />
      </SectionShell>
    </MarketingShell>
  );
}
