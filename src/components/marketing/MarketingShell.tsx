import type { ReactNode } from "react";
import { SiteFooter } from "../SiteFooter";
import { SiteNav } from "../SiteNav";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas font-sans text-fg antialiased">
      <SiteNav />
      <main className="flex flex-col gap-5 pb-10 md:gap-6 md:pb-12">{children}</main>
      <SiteFooter />
    </div>
  );
}
