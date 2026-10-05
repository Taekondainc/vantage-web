import { PageHero, SectionIsland } from "../../components/marketing/Accents";
import { MarketingShell } from "../../components/marketing/MarketingShell";
import { PageMeta } from "../../components/PageMeta";
import { FaqAccordion } from "../../components/ui/FaqAccordion";
import { SectionLabel } from "../../components/ui/Reveal";
import { FAQ_GROUPS } from "../../content/faq";
import { SITE } from "../../content/site";

export function FaqPage() {
  return (
    <MarketingShell>
      <PageMeta
        title={`FAQ - ${SITE.product}`}
        description="Getting started, privacy, AI providers, billing, and Web vs Desktop."
      />

      <PageHero
        label="FAQ"
        title="Questions, answered"
        body={
          SITE.docsUrl
            ? "Full documentation is linked below when available."
            : "Docs site coming later - this FAQ covers the common objections."
        }
      />

      {FAQ_GROUPS.map((group) => (
        <SectionIsland key={group.id}>
          <SectionLabel>{group.id}</SectionLabel>
          <h2 className="mt-2 mb-4 font-display text-xl font-semibold">{group.title}</h2>
          <FaqAccordion items={group.items} />
        </SectionIsland>
      ))}
    </MarketingShell>
  );
}
