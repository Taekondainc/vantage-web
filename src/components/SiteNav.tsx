import * as Dialog from "@radix-ui/react-dialog";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { NAV, SITE } from "../content/site";
import { cn } from "../lib/cn";
import { useTheme } from "../theme/ThemeProvider";
import { AppLink } from "./ui/Button";

const EXTRA = [{ to: "/compare", label: "Web vs Desktop" }] as const;

export function SiteNav() {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const links = [...NAV, ...EXTRA];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-3 md:px-16">
        <Link to="/" className="flex items-center gap-2 font-display text-[1.05rem] font-bold tracking-tight text-fg no-underline">
          <img src="/icon.png" alt="" className="h-7 w-7 rounded-md object-contain" />
          {SITE.product}
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn("text-sm font-medium no-underline", isActive ? "text-accent" : "text-muted hover:text-fg")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="grid h-9 w-9 place-items-center rounded-[8px] border border-border text-muted hover:text-fg"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to={SITE.downloadPath} className="hidden text-sm font-semibold text-muted no-underline hover:text-fg sm:inline">
            Download
          </Link>
          <AppLink to={SITE.webAppPath} variant="primary" size="sm" className="hidden sm:inline-flex">
            Try Vantage free
          </AppLink>

          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-[8px] border border-border text-fg lg:hidden"
                aria-label="Open menu"
              >
                {open ? <X size={16} /> : <Menu size={16} />}
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 lg:hidden" />
              <Dialog.Content className="fixed inset-x-4 top-[68px] z-50 rounded-[12px] border border-border bg-surface p-4 shadow-xl lg:hidden">
                <Dialog.Title className="sr-only">Menu</Dialog.Title>
                <div className="flex flex-col gap-1">
                  {links.map((item) => (
                    <Dialog.Close asChild key={item.to}>
                      <Link to={item.to} className="rounded-[8px] px-3 py-2.5 text-sm font-semibold text-fg no-underline hover:bg-raised">
                        {item.label}
                      </Link>
                    </Dialog.Close>
                  ))}
                  <Dialog.Close asChild>
                    <Link
                      to={SITE.webAppPath}
                      className="mt-2 rounded-[8px] bg-accent px-4 py-3 text-center text-sm font-semibold text-white no-underline"
                    >
                      Try Vantage free
                    </Link>
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
