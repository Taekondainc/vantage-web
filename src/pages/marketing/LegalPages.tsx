import { MarketingShell } from "../../components/marketing/MarketingShell";
import { PageMeta } from "../../components/PageMeta";
import { Reveal, SectionLabel } from "../../components/ui/Reveal";
import { SITE } from "../../content/site";

export function PrivacyPage() {
  return (
    <MarketingShell>
      <PageMeta title={`Privacy - ${SITE.company}`} description={`Privacy policy for ${SITE.product} by ${SITE.company}.`} />
      <section className="mx-auto max-w-[720px] px-6 py-14 md:px-16 md:py-20">
        <Reveal>
          <SectionLabel>Legal</SectionLabel>
          <h1 className="font-display text-[36px] font-bold tracking-tight">Privacy</h1>
          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-muted">
            <p>
              The {SITE.product} marketing website does not collect account credentials or GitHub tokens. Browsing
              this site does not require a login.
            </p>
            <p>
              {SITE.product} Web may store tasks and preferences in your browser&apos;s local storage. {SITE.product}{" "}
              Desktop handles OAuth and private data on your machine according to its own privacy practices.
            </p>
            <p>
              Contact{" "}
              <a className="text-accent" href={`mailto:${SITE.contactEmail}`}>
                {SITE.contactEmail}
              </a>{" "}
              for privacy questions. Company of record: {SITE.company}.
            </p>
          </div>
        </Reveal>
      </section>
    </MarketingShell>
  );
}

export function TermsPage() {
  return (
    <MarketingShell>
      <PageMeta title={`Terms - ${SITE.company}`} description={`Terms of use for ${SITE.product} by ${SITE.company}.`} />
      <section className="mx-auto max-w-[720px] px-6 py-14 md:px-16 md:py-20">
        <Reveal>
          <SectionLabel>Legal</SectionLabel>
          <h1 className="font-display text-[36px] font-bold tracking-tight">Terms</h1>
          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-muted">
            <p>
              {SITE.product} is provided by {SITE.company}. The marketing site is informational. Use of {SITE.product}{" "}
              Web and Desktop is subject to the product&apos;s own terms when you use those apps.
            </p>
            <p>
              Prices shown in USD. Paid billing is handled by Polar as merchant of record.
            </p>
            <p>
              Questions:{" "}
              <a className="text-accent" href={`mailto:${SITE.contactEmail}`}>
                {SITE.contactEmail}
              </a>
              .
            </p>
          </div>
        </Reveal>
      </section>
    </MarketingShell>
  );
}
