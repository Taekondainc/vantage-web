import { MarketingShell } from "../../components/marketing/MarketingShell";
import { PageHero, SectionIsland, SectionShell } from "../../components/marketing/Accents";
import { PageMeta } from "../../components/PageMeta";
import { AppLink } from "../../components/ui/Button";
import { FaqAccordion } from "../../components/ui/FaqAccordion";
import { Reveal, SectionLabel } from "../../components/ui/Reveal";
import { formatUsd, PRICING } from "../../content/pricing";
import { SITE } from "../../content/site";
import { FAQ_GROUPS } from "../../content/faq";

export function PricingPage() {
  const billingFaq = FAQ_GROUPS.find((g) => g.id === "billing")?.items ?? [];

  return (
    <MarketingShell>
      <PageMeta
        title={`Pricing - ${SITE.product}`}
        description={`Free or ${formatUsd(PRICING.paid.priceUsd)}/month Paid (USD). No feature paywalls - meters only.`}
      />

      <PageHero
        label="Pricing"
        title="Same product. Meters optional."
        body={PRICING.fairnessNote}
      >
        <div className="flex flex-wrap gap-3">
          <AppLink to={SITE.webAppPath} variant="primary">
            Start free
          </AppLink>
          <AppLink to={PRICING.checkoutUrl} variant="secondary">
            Upgrade to Paid
          </AppLink>
        </div>
      </PageHero>

      <SectionShell>
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal className="flex h-full flex-col rounded-[12px] border border-border bg-surface p-6">
            <h2 className="font-display text-xl font-semibold">{PRICING.free.name}</h2>
            <p className="mt-3 font-mono text-4xl font-semibold">{formatUsd(PRICING.free.priceUsd)}</p>
            <p className="mt-2 text-sm text-muted">{PRICING.free.blurb}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted">
              {PRICING.free.highlights.map((h) => (
                <li key={h}>' {h}</li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              <AppLink to={SITE.webAppPath} variant="primary" className="w-full">
                Start free
              </AppLink>
            </div>
          </Reveal>
          <Reveal className="flex h-full flex-col rounded-[12px] border border-accent bg-surface p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold">{PRICING.paid.name}</h2>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[11px] text-accent">
                {PRICING.paid.tag}
              </span>
            </div>
            <p className="mt-3 font-mono text-4xl font-semibold">
              {formatUsd(PRICING.paid.priceUsd)}
              <span className="text-base font-medium text-muted">/mo USD</span>
            </p>
            <p className="mt-2 text-sm text-muted">{PRICING.paid.blurb}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted">
              {PRICING.paid.highlights.map((h) => (
                <li key={h}>' {h}</li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              <AppLink to={PRICING.checkoutUrl} variant="secondary" className="w-full">
                Upgrade to Paid
              </AppLink>
            </div>
          </Reveal>
        </div>
      </SectionShell>

      <SectionIsland>
        <SectionLabel>Limits</SectionLabel>
        <h2 className="mt-2 font-display text-xl font-semibold">What Free meters vs Paid</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="font-mono text-[12px] text-muted">
              <tr>
                <th className="pb-3 font-medium">Meter</th>
                <th className="pb-3 font-medium">Free</th>
                <th className="pb-3 font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {PRICING.limits.map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <td className="py-3 text-fg">{row.label}</td>
                  <td className="py-3 font-mono text-muted">{row.free}</td>
                  <td className="py-3 font-mono text-shipped">{row.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionIsland>

      <SectionIsland id="upgrade">
        <SectionLabel>Billing FAQ</SectionLabel>
        <h2 className="mt-2 mb-5 font-display text-xl font-semibold">Common questions</h2>
        <FaqAccordion items={billingFaq} />
        <p className="mt-6 text-sm text-muted">
          Paid is billed by Polar at {formatUsd(PRICING.paid.priceUsd)}/month USD. Sign in to upgrade, or email{" "}
          <a className="text-accent" href={`mailto:${SITE.contactEmail}`}>
            {SITE.contactEmail}
          </a>
          .
        </p>
      </SectionIsland>
    </MarketingShell>
  );
}
