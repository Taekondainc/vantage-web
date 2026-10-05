import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
} as const;

export function Reveal({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      variants={rise}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StatusBadge({ status }: { status: "shipped" | "progress" | "planned" | "risk" }) {
  const map = {
    shipped: { label: "Shipped", className: "bg-shipped/15 text-shipped" },
    progress: { label: "In progress", className: "bg-progress/15 text-progress" },
    planned: { label: "Planned", className: "bg-planned/15 text-planned" },
    risk: { label: "Risk", className: "bg-risk/15 text-risk" },
  } as const;
  const item = map[status];
  return (
    <motion.span
      className={cn("inline-flex rounded-full px-2.5 py-0.5 font-mono text-[12px] font-medium", item.className)}
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
    >
      {item.label}
    </motion.span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">{children}</p>
  );
}
