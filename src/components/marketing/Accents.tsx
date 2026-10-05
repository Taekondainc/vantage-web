import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Marquee({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-border bg-surface py-3" aria-hidden>
      <div className="animate-marquee flex w-max gap-10 whitespace-nowrap">
        {loop.map((label, i) => (
          <span key={`${label}-${i}`} className="flex items-center gap-10 font-display text-sm font-semibold text-muted">
            {label}
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function AccentRail({ className }: { className?: string }) {
  return <span className={cn("inline-block h-8 w-1 rounded-full bg-accent", className)} aria-hidden />;
}

export function PhotoCard({
  src,
  alt,
  caption,
  className,
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}) {
  return (
    <motion.div
      className={cn("relative overflow-hidden rounded-[12px] border border-border bg-surface", className)}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
    >
      <motion.img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        initial={{ scale: 1.08 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      {caption ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4">
          <p className="text-sm font-semibold text-white">{caption}</p>
        </div>
      ) : null}
    </motion.div>
  );
}

export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-[12px] border border-border bg-surface p-5"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -3, borderColor: "rgba(91,124,250,0.55)" }}
    >
      <span className="absolute top-0 right-0 h-10 w-10 translate-x-3 -translate-y-3 rounded-full bg-accent/20 blur-xl" aria-hidden />
      <p className="font-mono text-3xl font-semibold text-fg">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </motion.div>
  );
}

export function PageHero({
  label,
  title,
  body,
  children,
}: {
  label: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[1200px] px-6 pt-10 pb-10 md:px-16 md:pt-14 md:pb-12">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-3 flex items-center gap-3">
            <AccentRail className="h-5" />
            <p className="font-mono text-[12px] font-medium tracking-[0.08em] text-accent uppercase">{label}</p>
          </div>
          <h1 className="max-w-[18ch] font-display text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-bold tracking-tight text-fg">
            {title}
          </h1>
          <p className="mt-4 max-w-[48ch] text-[16px] leading-relaxed text-muted">{body}</p>
          {children ? <div className="mt-7">{children}</div> : null}
        </motion.div>
      </div>
      <motion.div
        className="h-1 origin-left bg-accent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />
    </section>
  );
}

export function SectionShell({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto w-full max-w-[1200px] px-6 md:px-16", className)}>
      {children}
    </section>
  );
}

export function SectionIsland({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <SectionShell id={id}>
      <motion.div
        className={cn("rounded-[12px] border border-border bg-surface p-5 md:p-6", className)}
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35 }}
        whileHover={{ borderColor: "rgba(91,124,250,0.35)" }}
      >
        {children}
      </motion.div>
    </SectionShell>
  );
}
