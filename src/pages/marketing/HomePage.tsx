import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Inbox, Receipt, User, Users } from "lucide-react";
import { Link } from "react-router-dom";
import {
  AccentRail,
  Marquee,
  PhotoCard,
  SectionIsland,
  SectionShell,
  StatCard,
} from "../../components/marketing/Accents";
import { MarketingShell } from "../../components/marketing/MarketingShell";
import { EvidencePackMock, FunnelDiagram, PlanShippedDiagram } from "../../components/marketing/Mocks";
import { PageMeta } from "../../components/PageMeta";
import { AppLink } from "../../components/ui/Button";
import { Reveal, SectionLabel } from "../../components/ui/Reveal";
import { formatUsd, PRICING } from "../../content/pricing";
import { CUSTOMERS, FEATURES, PROBLEM, SITE, TEMPLATES } from "../../content/site";

const customerIcons = {
  ic: User,
  freelancer: Receipt,
  lead: Users,
  anyone: Inbox,
} as const;

export function HomePage() {
  return (
    <MarketingShell>
      <PageMeta title={`${SITE.product} - ${SITE.tagline}`} description={SITE.subhead} />

      <SectionShell className="pt-6 md:pt-8">
        <div className="grid items-center gap-6 md:grid-cols-2 md:gap-8">
          <Reveal>
            <div className="mb-3 flex items-center gap-3">
              <AccentRail className="h-5" />
              <p className="font-mono text-[12px] font-medium tracking-[0.08em] text-accent uppercase">
                Sign in with GitHub
              </p>
            </div>
            <h1 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.08] font-bold tracking-tight text-fg">
              {SITE.tagline}
            </h1>
            <p className="mt-4 max-w-[40ch] text-[16px] leading-relaxed text-muted">{SITE.subhead}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <AppLink to={SITE.webAppPath} variant="primary" size="lg">
                Try Vantage free <ArrowUpRight size={16} />
              </AppLink>
              <AppLink to={SITE.downloadPath} variant="secondary" size="lg">
                Download Desktop
              </AppLink>
            </div>
          </Reveal>
          <Reveal>
            <motion.img
              src="/photos/report-ui.png"
              alt="Vantage monthly submission report UI"
              className="mx-auto w-full max-w-[400px] rounded-[12px] border border-border shadow-[0_20px_50px_rgba(0,0,0,0.35)] md:max-w-none"
              loading="eager"
              initial={{ opacity: 0, y: 24, rotate: -1 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
            />
          </Reveal>
        </div>
      </SectionShell>

      <Marquee items={[...FEATURES.slice(0, 6).map((f) => f.title), "USD pricing", "GitHub sign-in"]} />

      <SectionShell>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard value="3" label="Report templates" />
          <StatCard value={formatUsd(PRICING.paid.priceUsd)} label="Paid / month (USD)" />
          <StatCard value="GitHub" label="Sign-in to start" />
        </div>
      </SectionShell>

      <SectionIsland>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <SectionLabel>Problem</SectionLabel>
            <h2 className="mt-2 max-w-[20ch] font-display text-[26px] font-semibold tracking-tight text-fg md:text-[28px]">
              {PROBLEM.title}
            </h2>
            <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-muted">{PROBLEM.body}</p>
            <ul className="mt-5 max-w-xl">
              {PROBLEM.points.map((p, i) => (
                <motion.li
                  key={p}
                  className="flex justify-between gap-4 border-t border-border py-3 text-sm text-fg first:border-t-0"
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <span>{p}</span>
                  <span className="font-mono text-accent">0{i + 1}</span>
                </motion.li>
              ))}
            </ul>
          </div>
          <PhotoCard
            src="/photos/devs.png"
            alt="Developers at workstations"
            caption="For people who already shipped the hard part."
            className="min-h-[220px]"
          />
        </div>
      </SectionIsland>

      <SectionShell>
        <Reveal className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-start gap-3">
            <AccentRail />
            <div>
              <SectionLabel>Templates</SectionLabel>
              <h2 className="font-display text-[26px] font-semibold text-fg md:text-[28px]">Three ways to submit</h2>
            </div>
          </div>
          <Link to="/templates" className="inline-flex items-center gap-1 text-sm font-semibold text-accent no-underline">
            All templates <ArrowRight size={14} />
          </Link>
        </Reveal>
        <div className="grid gap-3 md:grid-cols-3">
          {TEMPLATES.map((t, i) => (
            <Reveal key={t.id}>
              <Link
                to={`/templates#${t.id}`}
                className="group block h-full rounded-[12px] border border-border bg-surface p-5 no-underline transition-colors hover:border-accent/50 hover:bg-raised"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted uppercase">{t.audience}</span>
                  <span className="font-mono text-accent">0{i + 1}</span>
                </div>
                <h3 className="font-display text-lg font-semibold text-fg">{t.name}</h3>
                <p className="mt-2 text-sm text-muted">{t.produces.join(" / ")}</p>
                <ArrowUpRight
                  size={16}
                  className="mt-4 text-muted transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
                />
              </Link>
            </Reveal>
          ))}
        </div>
      </SectionShell>

      <SectionIsland>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionLabel>Plan vs shipped</SectionLabel>
            <h2 className="mt-2 font-display text-[24px] font-semibold text-fg md:text-[26px]">
              Did it actually merge?
            </h2>
            <p className="mt-2 max-w-[36ch] text-sm text-muted">
              Match the plan to the PR that landed — status badges that mean something.
            </p>
          </div>
          <PlanShippedDiagram />
        </div>
      </SectionIsland>

      <SectionIsland>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionLabel>Evidence packs</SectionLabel>
            <h2 className="mt-2 font-display text-[24px] font-semibold text-fg md:text-[26px]">
              Receipts, not just prose
            </h2>
            <p className="mt-2 max-w-[36ch] text-sm text-muted">
              ZIP with report.md, links.txt, and metadata for leads, clients, and your archive.
            </p>
          </div>
          <EvidencePackMock />
        </div>
      </SectionIsland>

      <SectionIsland>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionLabel>Web vs Desktop</SectionLabel>
            <h2 className="mt-2 font-display text-[24px] font-semibold text-fg md:text-[26px]">
              Same sign-in. More depth on Desktop.
            </h2>
            <Link
              to="/compare"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent no-underline"
            >
              Full comparison <ArrowRight size={14} />
            </Link>
          </div>
          <FunnelDiagram />
        </div>
      </SectionIsland>

      <SectionShell>
        <Reveal className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-start gap-3">
            <AccentRail />
            <div>
              <SectionLabel>Pricing</SectionLabel>
              <h2 className="font-display text-[26px] font-semibold text-fg md:text-[28px]">Full features. Meters on Free.</h2>
              <p className="mt-1 text-sm text-muted">{PRICING.fairnessNote}</p>
            </div>
          </div>
          <Link to="/pricing" className="text-sm font-semibold text-accent no-underline">
            See pricing
          </Link>
        </Reveal>
        <div className="grid gap-3 md:grid-cols-2">
          <Reveal className="rounded-[12px] border border-border bg-surface p-6">
            <p className="font-display text-lg font-semibold">{PRICING.free.name}</p>
            <p className="mt-2 font-mono text-3xl font-semibold">{formatUsd(PRICING.free.priceUsd)}</p>
            <p className="mt-2 text-sm text-muted">{PRICING.free.blurb}</p>
          </Reveal>
          <Reveal className="rounded-[12px] border border-accent bg-surface p-6">
            <p className="font-display text-lg font-semibold">
              {PRICING.paid.name}{" "}
              <span className="ml-1 rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[11px] text-accent">
                {PRICING.paid.tag}
              </span>
            </p>
            <p className="mt-2 font-mono text-3xl font-semibold">
              {formatUsd(PRICING.paid.priceUsd)}
              <span className="text-base text-muted">/mo USD</span>
            </p>
            <p className="mt-2 text-sm text-muted">{PRICING.paid.blurb}</p>
          </Reveal>
        </div>
      </SectionShell>

      <SectionShell>
        <Reveal className="mb-4 flex items-start gap-3">
          <AccentRail />
          <div>
            <SectionLabel>Who it's for</SectionLabel>
            <h2 className="font-display text-[26px] font-semibold text-fg md:text-[28px]">
              Built for people who already shipped
            </h2>
          </div>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CUSTOMERS.map((c) => {
            const Icon = customerIcons[c.id as keyof typeof customerIcons];
            return (
              <Reveal key={c.id} className="rounded-[12px] border border-border bg-surface p-5">
                <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-accent/15 text-accent">
                  <Icon size={16} />
                </span>
                <h3 className="mt-3 font-display text-base font-semibold text-fg">{c.title}</h3>
                <p className="mt-2 text-sm text-muted">{c.body}</p>
              </Reveal>
            );
          })}
        </div>
      </SectionShell>

      <SectionIsland>
        <div className="grid gap-4 md:grid-cols-2 md:items-center">
          <div>
            <SectionLabel>Proof</SectionLabel>
            <h2 className="mt-2 font-display text-[26px] font-semibold text-fg">Submission-ready packaging</h2>
            <p className="mt-2 text-sm text-muted">Reports and receipts for leads, clients, and your own archive.</p>
          </div>
          <PhotoCard
            src="/photos/report-review.png"
            alt="Team reviewing reports"
            className="min-h-[180px]"
          />
        </div>
      </SectionIsland>
    </MarketingShell>
  );
}
