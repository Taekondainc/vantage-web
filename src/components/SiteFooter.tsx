import { Link } from "react-router-dom";
import { FOOTER, SITE } from "../content/site";
import { AppLink } from "./ui/Button";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-border bg-surface">
      <div className="mx-auto max-w-[1200px] px-6 py-12 md:px-16">
        <div className="mb-10 flex flex-col gap-4 rounded-[12px] border border-border bg-canvas p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-display text-xl font-semibold text-fg">{SITE.tagline}</p>
            <p className="mt-1 text-sm text-muted">Sign in with GitHub on Web. Download Desktop when you need private depth.</p>
          </div>
          <AppLink to={SITE.webAppPath} variant="primary">
            Try Vantage free
          </AppLink>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-lg font-bold text-fg">{SITE.product}</p>
            <p className="mt-2 text-sm text-muted">
              by {SITE.company}. Proof-of-work software for developers.
            </p>
          </div>
          {(
            [
              ["Product", FOOTER.product],
              ["Company", FOOTER.company],
              ["Legal", FOOTER.legal],
            ] as const
          ).map(([title, links]) => (
            <div key={title}>
              <p className="mb-3 font-mono text-[11px] tracking-[0.08em] text-muted uppercase">{title}</p>
              <ul className="space-y-2">
                {links.map((link) =>
                  "href" in link ? (
                    <li key={link.label}>
                      <a href={link.href} className="text-sm text-fg no-underline hover:text-accent">
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.to}>
                      <Link to={link.to} className="text-sm text-fg no-underline hover:text-accent">
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-between gap-2 border-t border-border pt-6 text-sm text-muted">
          <span>
            © {new Date().getFullYear()} {SITE.company}
          </span>
          <span>Prices in USD.</span>
        </div>
      </div>
    </footer>
  );
}
